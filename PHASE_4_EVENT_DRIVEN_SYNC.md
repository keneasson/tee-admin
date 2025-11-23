# Phase 4: Event-Driven Synchronization System

## Overview

Replace manual admin-triggered sync with automated, event-driven bidirectional synchronization between DynamoDB and AWS SES.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     Event-Driven Sync Flow                      │
└─────────────────────────────────────────────────────────────────┘

DynamoDB (tee-schedules)                    AWS SES
       │                                         │
       │ [1] Change Event                        │
       ├──────────────────┐                      │
       │                  │                      │
       │            DynamoDB Streams             │
       │                  │                      │
       │                  ▼                      │
       │         Lambda: SyncToSES               │
       │                  │                      │
       │                  └──────────────────────┤
       │                                         │
       │                        [2] Update Contact
       │                             AttributesData
       │                                         │
       ◄─────────────────────────────────────────┤
              [3] SNS Notification               │
                    (Bounce/Complaint)           │
       │                                         │
       ▼                                         │
  API: /webhook/ses                              │
       │                                         │
       └──────────────────┐                      │
                          │                      │
                    Update DynamoDB              │
                  (Mark bounced/complained)      │
                                                 │
┌──────────────────────────────────────────────────┐
│     EventBridge: Daily Reconciliation Job        │
│  • Compare all records                           │
│  • Detect drift                                  │
│  • Alert on mismatches                           │
│  • Auto-fix safe discrepancies                   │
└──────────────────────────────────────────────────┘
```

## Component Details

### 1. DynamoDB Streams → SES Sync

**Trigger**: DynamoDB Stream on `tee-schedules` table
**Lambda**: `sync-directory-to-ses`
**Runtime**: Node.js 20
**Timeout**: 30 seconds
**Memory**: 512 MB

#### Stream Event Types

| Event Type | Action | SES Operation |
|------------|--------|---------------|
| `INSERT` | New directory record created | Skip (wait for user to subscribe) |
| `MODIFY` | Email, name, or ecclesia changed | Update SES `AttributesData` |
| `REMOVE` | Directory record deleted | Mark as orphaned (keep SES contact) |

#### Lambda Logic

```typescript
// sync-directory-to-ses.ts
import { DynamoDBStreamEvent } from 'aws-lambda'
import { SESv2Client, UpdateContactCommand, GetContactCommand } from '@aws-sdk/client-sesv2'

export async function handler(event: DynamoDBStreamEvent) {
  const sesClient = new SESv2Client({ region: 'us-east-1' })

  for (const record of event.Records) {
    // Only process DIRECTORY#MEMBERS records
    if (record.dynamodb?.Keys?.PK?.S !== 'DIRECTORY#MEMBERS') {
      continue
    }

    const eventName = record.eventName // INSERT | MODIFY | REMOVE
    const newImage = record.dynamodb?.NewImage
    const oldImage = record.dynamodb?.OldImage

    if (eventName === 'MODIFY' && newImage) {
      await syncModifiedRecord(sesClient, newImage, oldImage)
    } else if (eventName === 'REMOVE' && oldImage) {
      await handleDeletedRecord(sesClient, oldImage)
    }
    // Skip INSERT - users subscribe themselves
  }
}

async function syncModifiedRecord(sesClient, newImage, oldImage) {
  const email = newImage.email?.S
  if (!email) return

  // Split multiple emails (semicolon-separated)
  const emails = email.split(/[;,|\s]/).map(e => e.trim()).filter(e => e)

  for (const emailAddress of emails) {
    try {
      // Get existing SES contact
      const getCmd = new GetContactCommand({
        ContactListName: 'tee-admin-contacts',
        EmailAddress: emailAddress
      })
      const contact = await sesClient.send(getCmd)

      // Build updated attributes
      const attributes = {
        firstName: newImage.firstName?.S || '',
        lastName: newImage.lastName?.S || '',
        displayName: `${newImage.firstName?.S || ''} ${newImage.lastName?.S || ''}`.trim(),
        dynamodbSK: newImage.SK?.S || '',
        ecclesia: newImage.ecclesia?.S || '',
        isMember: newImage.ecclesia?.S?.toLowerCase() === 'tee'
      }

      // Update SES contact
      const updateCmd = new UpdateContactCommand({
        ContactListName: 'tee-admin-contacts',
        EmailAddress: emailAddress,
        TopicPreferences: contact.TopicPreferences, // Preserve subscriptions
        AttributesData: JSON.stringify(attributes)
      })
      await sesClient.send(updateCmd)

      console.log(`✅ Synced ${emailAddress} to SES`)

      // Log to audit trail
      await logSyncEvent({
        type: 'directory-to-ses',
        email: emailAddress,
        changes: getChanges(oldImage, newImage),
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      if (error.name === 'NotFoundException') {
        // Email not in SES yet - skip (they haven't subscribed)
        console.log(`⏭️ ${emailAddress} not in SES - skipping`)
      } else {
        console.error(`❌ Failed to sync ${emailAddress}:`, error)
        // Send alert to CloudWatch/SNS
        await sendAlert('SES Sync Failed', { email: emailAddress, error })
      }
    }
  }
}

async function handleDeletedRecord(sesClient, oldImage) {
  // Don't delete from SES - just remove dynamodbSK link
  const email = oldImage.email?.S
  if (!email) return

  const emails = email.split(/[;,|\s]/).map(e => e.trim()).filter(e => e)

  for (const emailAddress of emails) {
    try {
      const getCmd = new GetContactCommand({
        ContactListName: 'tee-admin-contacts',
        EmailAddress: emailAddress
      })
      const contact = await sesClient.send(getCmd)

      // Parse existing attributes
      let attributes = {}
      try {
        attributes = JSON.parse(contact.AttributesData || '{}')
      } catch {}

      // Remove directory link
      delete attributes.dynamodbSK
      attributes.orphaned = true
      attributes.orphanedAt = new Date().toISOString()

      // Update SES
      const updateCmd = new UpdateContactCommand({
        ContactListName: 'tee-admin-contacts',
        EmailAddress: emailAddress,
        TopicPreferences: contact.TopicPreferences,
        AttributesData: JSON.stringify(attributes)
      })
      await sesClient.send(updateCmd)

      console.log(`🔗 Unlinked ${emailAddress} from directory`)
    } catch (error) {
      console.error(`❌ Failed to unlink ${emailAddress}:`, error)
    }
  }
}
```

### 2. SES Webhook Handler (Bounces, Complaints, Unsubscribes)

**Endpoint**: `/api/webhook/ses`
**Method**: POST
**Auth**: SNS signature verification

#### SNS Topics to Subscribe

1. **Bounces** - Email delivery failures
2. **Complaints** - Spam reports
3. **Unsubscribes** - Global opt-out
4. **Delivery** - Successful sends (optional, for metrics)

#### Webhook Logic

```typescript
// /api/webhook/ses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import crypto from 'crypto'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }))

export async function POST(request: NextRequest) {
  const body = await request.text()
  const message = JSON.parse(body)

  // Verify SNS signature
  if (!verifySNSSignature(message)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Handle SNS subscription confirmation
  if (message.Type === 'SubscriptionConfirmation') {
    await fetch(message.SubscribeURL)
    return NextResponse.json({ message: 'Subscription confirmed' })
  }

  // Handle notification
  if (message.Type === 'Notification') {
    const payload = JSON.parse(message.Message)
    const eventType = payload.eventType // 'Bounce', 'Complaint', 'Send', etc.

    switch (eventType) {
      case 'Bounce':
        await handleBounce(payload)
        break
      case 'Complaint':
        await handleComplaint(payload)
        break
      case 'Delivery':
        await handleDelivery(payload)
        break
    }
  }

  return NextResponse.json({ message: 'Webhook processed' })
}

async function handleBounce(payload: any) {
  const { bounce, mail } = payload
  const bounceType = bounce.bounceType // 'Permanent' | 'Transient'

  for (const recipient of bounce.bouncedRecipients) {
    const email = recipient.emailAddress

    // Log bounce event
    await docClient.send(new PutCommand({
      TableName: 'tee-schedules',
      Item: {
        PK: 'EMAIL_EVENTS#BOUNCE',
        SK: `${new Date().toISOString()}#${email}`,
        email,
        bounceType,
        diagnosticCode: recipient.diagnosticCode,
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
      }
    }))

    // If permanent bounce, mark email as invalid in directory
    if (bounceType === 'Permanent') {
      await markEmailInvalid(email, 'bounce')
    }

    console.log(`📧 ${bounceType} bounce: ${email}`)
  }
}

async function handleComplaint(payload: any) {
  const { complaint } = payload

  for (const recipient of complaint.complainedRecipients) {
    const email = recipient.emailAddress

    // Log complaint
    await docClient.send(new PutCommand({
      TableName: 'tee-schedules',
      Item: {
        PK: 'EMAIL_EVENTS#COMPLAINT',
        SK: `${new Date().toISOString()}#${email}`,
        email,
        complaintFeedbackType: complaint.complaintFeedbackType,
        timestamp: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
      }
    }))

    // Mark as complained
    await markEmailInvalid(email, 'complaint')

    console.log(`⚠️ Complaint: ${email}`)
  }
}

async function markEmailInvalid(email: string, reason: 'bounce' | 'complaint') {
  // Find directory record with this email
  const queryCmd = new QueryCommand({
    TableName: 'tee-schedules',
    IndexName: 'EmailIndex', // Need to create GSI on email field
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email
    }
  })

  const result = await docClient.send(queryCmd)

  if (result.Items && result.Items.length > 0) {
    for (const item of result.Items) {
      await docClient.send(new UpdateCommand({
        TableName: 'tee-schedules',
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: 'SET emailStatus = :status, emailStatusReason = :reason, emailStatusUpdated = :timestamp',
        ExpressionAttributeValues: {
          ':status': 'invalid',
          ':reason': reason,
          ':timestamp': new Date().toISOString()
        }
      }))
    }
  }
}

function verifySNSSignature(message: any): boolean {
  // Verify SNS message signature
  const signatureVersion = message.SignatureVersion
  if (signatureVersion !== '1') return false

  const stringToSign = buildStringToSign(message)
  const signature = Buffer.from(message.Signature, 'base64')

  const verifier = crypto.createVerify('SHA1')
  verifier.update(stringToSign)

  // Get signing cert from message.SigningCertURL
  // Cache the cert for performance
  // Return verifier.verify(cert, signature)

  return true // Simplified - implement full verification
}
```

### 3. EventBridge Daily Reconciliation

**Schedule**: Daily at 2:00 AM EST
**Lambda**: `daily-reconciliation`
**Timeout**: 15 minutes
**Memory**: 1024 MB

#### Reconciliation Logic

```typescript
// daily-reconciliation.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { SESv2Client, ListContactsCommand, GetContactCommand } from '@aws-sdk/client-sesv2'

export async function handler() {
  console.log('🔄 Starting daily reconciliation...')

  const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
  const sesClient = new SESv2Client({})

  // 1. Fetch all directory records
  const directoryRecords = await fetchAllDirectoryRecords(dynamoClient)

  // 2. Fetch all SES contacts
  const sesContacts = await fetchAllSESContacts(sesClient)

  // 3. Build comparison maps
  const directoryEmails = new Map()
  directoryRecords.forEach(record => {
    const emails = (record.email || '').split(/[;,|\s]/).map(e => e.trim()).filter(e => e)
    emails.forEach(email => {
      directoryEmails.set(email, record)
    })
  })

  const sesEmails = new Map()
  sesContacts.forEach(contact => {
    sesEmails.set(contact.EmailAddress, contact)
  })

  // 4. Detect discrepancies
  const issues = {
    directoryOnly: [],
    sesOnly: [],
    attributeMismatch: [],
    orphaned: []
  }

  // Check directory → SES
  for (const [email, record] of directoryEmails) {
    if (!sesEmails.has(email)) {
      issues.directoryOnly.push({ email, record })
    } else {
      const sesContact = sesEmails.get(email)
      const mismatch = checkAttributeMismatch(record, sesContact)
      if (mismatch) {
        issues.attributeMismatch.push({ email, mismatch })
      }
    }
  }

  // Check SES → directory
  for (const [email, contact] of sesEmails) {
    if (!directoryEmails.has(email)) {
      const attributes = parseAttributes(contact)
      if (attributes.dynamodbSK) {
        // Has dynamodbSK but directory record doesn't exist
        issues.orphaned.push({ email, dynamodbSK: attributes.dynamodbSK })
      } else {
        // No dynamodbSK - legitimate SES-only contact
        issues.sesOnly.push({ email, contact })
      }
    }
  }

  // 5. Auto-fix safe issues
  const autoFixes = []
  for (const issue of issues.attributeMismatch) {
    if (isAutoFixable(issue.mismatch)) {
      await autoFixAttributeMismatch(sesClient, issue)
      autoFixes.push(issue.email)
    }
  }

  // 6. Generate report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalDirectory: directoryRecords.length,
      totalSES: sesContacts.length,
      directoryOnly: issues.directoryOnly.length,
      sesOnly: issues.sesOnly.length,
      attributeMismatch: issues.attributeMismatch.length,
      orphaned: issues.orphaned.length,
      autoFixed: autoFixes.length
    },
    issues,
    autoFixes
  }

  // 7. Store report in DynamoDB
  await storeReconciliationReport(dynamoClient, report)

  // 8. Alert if critical issues
  if (issues.orphaned.length > 0 || issues.attributeMismatch.length > 10) {
    await sendAlert('Sync Drift Detected', report.summary)
  }

  console.log('✅ Reconciliation complete:', report.summary)

  return report
}

function checkAttributeMismatch(directoryRecord: any, sesContact: any) {
  const attributes = parseAttributes(sesContact)

  const mismatches = []

  if (attributes.firstName !== directoryRecord.firstName) {
    mismatches.push({ field: 'firstName', directory: directoryRecord.firstName, ses: attributes.firstName })
  }

  if (attributes.lastName !== directoryRecord.lastName) {
    mismatches.push({ field: 'lastName', directory: directoryRecord.lastName, ses: attributes.lastName })
  }

  const directoryIsMember = directoryRecord.ecclesia?.toLowerCase() === 'tee'
  if (attributes.isMember !== directoryIsMember) {
    mismatches.push({ field: 'isMember', directory: directoryIsMember, ses: attributes.isMember })
  }

  return mismatches.length > 0 ? mismatches : null
}

function isAutoFixable(mismatches: any[]): boolean {
  // Only auto-fix if all mismatches are name-related (not member status)
  return mismatches.every(m => m.field === 'firstName' || m.field === 'lastName')
}
```

## Implementation Plan

### Step 1: Enable DynamoDB Streams (1 hour)

```bash
# AWS CLI
aws dynamodb update-table \
  --table-name tee-schedules \
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES
```

**Terraform Alternative:**
```hcl
resource "aws_dynamodb_table" "tee_schedules" {
  name           = "tee-schedules"

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"
}
```

### Step 2: Create Lambda Functions (4 hours)

1. **sync-directory-to-ses**
   - IAM Role: DynamoDB Stream read, SES full access
   - Trigger: DynamoDB Stream
   - Environment: `CONTACT_LIST_NAME=tee-admin-contacts`

2. **ses-webhook-handler**
   - Deploy as Next.js API route (already in app)
   - No Lambda needed

3. **daily-reconciliation**
   - IAM Role: DynamoDB read, SES read, SNS publish
   - Trigger: EventBridge rule (cron: `0 7 * * ? *` - 2 AM EST)

### Step 3: Configure SES Event Publishing (2 hours)

```bash
# Create SNS topics
aws sns create-topic --name ses-bounces
aws sns create-topic --name ses-complaints

# Subscribe API endpoint to topics
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:ses-bounces \
  --protocol https \
  --notification-endpoint https://tee-admin.com/api/webhook/ses

# Configure SES to publish events
aws sesv2 put-configuration-set-event-destination \
  --configuration-set-name tee-events \
  --event-destination-name bounce-handler \
  --event-destination '{
    "Enabled": true,
    "MatchingEventTypes": ["BOUNCE", "COMPLAINT"],
    "SnsDestination": {
      "TopicArn": "arn:aws:sns:us-east-1:ACCOUNT:ses-bounces"
    }
  }'
```

### Step 4: Add GSI for Email Lookup (1 hour)

**Required for webhook bounce/complaint handling**

```bash
aws dynamodb update-table \
  --table-name tee-schedules \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --global-secondary-index-updates '[
    {
      "Create": {
        "IndexName": "EmailIndex",
        "KeySchema": [{"AttributeName": "email", "KeyType": "HASH"}],
        "Projection": {"ProjectionType": "ALL"},
        "ProvisionedThroughput": {"ReadCapacityUnits": 5, "WriteCapacityUnits": 5}
      }
    }
  ]'
```

### Step 5: Deploy Monitoring & Alerts (2 hours)

**CloudWatch Alarms:**
- Lambda errors > 5 in 5 minutes
- Reconciliation drift > 10 records
- Permanent bounces detected

**SNS Alert Topics:**
```bash
aws sns create-topic --name tee-admin-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT:tee-admin-alerts \
  --protocol email \
  --notification-endpoint admin@tee.org
```

## Rollout Strategy

### Phase 4.1: Observation Mode (1 week)
- ✅ Deploy all components
- ✅ Enable logging only (no auto-fixes)
- ✅ Monitor reconciliation reports
- ✅ Verify no false positives

### Phase 4.2: Soft Launch (1 week)
- ✅ Enable DynamoDB → SES sync (read-only attributes)
- ✅ Enable bounce/complaint webhooks (logging only)
- ✅ Daily reconciliation with auto-fix for name mismatches

### Phase 4.3: Full Production (Ongoing)
- ✅ Enable all auto-fixes
- ✅ Remove manual sync UI (deprecate old endpoints)
- ✅ Monitor CloudWatch metrics

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Sync Latency (DynamoDB → SES) | < 5 seconds | CloudWatch Lambda duration |
| Drift Rate (Reconciliation) | < 1% | Daily report |
| Bounce/Complaint Processing | < 1 minute | Webhook response time |
| Lambda Error Rate | < 0.1% | CloudWatch errors |

## Cost Estimate

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| DynamoDB Streams | ~1,000 events/day | $0.50 |
| Lambda (sync-to-ses) | ~1,000 invocations/day | $0.20 |
| Lambda (reconciliation) | 1 invocation/day | $0.10 |
| SNS (bounces/complaints) | ~50 notifications/month | $0.05 |
| CloudWatch Logs | 5 GB/month | $2.50 |
| **Total** | | **~$3.35/month** |

## Rollback Plan

If issues arise:
1. Disable DynamoDB Stream trigger (stops auto-sync)
2. Disable EventBridge rule (stops reconciliation)
3. Revert to manual sync UI
4. Review CloudWatch logs for errors
5. Fix and redeploy

## Future Enhancements

### Phase 5 Ideas
- **Real-time Dashboard**: Show sync status in admin UI
- **Conflict Resolution UI**: Manual review of drift issues
- **Batch Operations**: Bulk fixes for reconciliation issues
- **Email Validation**: Real-time validation on directory updates
- **Historical Sync Trends**: Track drift over time

---

## Files to Create

```
apps/next/
├── app/api/webhook/ses/route.ts                    [NEW]
├── utils/ses-signature-verify.ts                   [NEW]
└── utils/reconciliation/
    ├── check-drift.ts                              [NEW]
    └── auto-fix.ts                                 [NEW]

infrastructure/
├── lambda/
│   ├── sync-directory-to-ses/
│   │   ├── index.ts                                [NEW]
│   │   ├── package.json                            [NEW]
│   │   └── tsconfig.json                           [NEW]
│   └── daily-reconciliation/
│       ├── index.ts                                [NEW]
│       ├── package.json                            [NEW]
│       └── tsconfig.json                           [NEW]
├── terraform/
│   ├── dynamodb-streams.tf                         [NEW]
│   ├── lambda-sync.tf                              [NEW]
│   ├── eventbridge-reconciliation.tf               [NEW]
│   └── sns-topics.tf                               [NEW]
└── cloudformation/                                 [ALTERNATIVE]
    └── event-driven-sync-stack.yaml                [NEW]
```

## Next Steps

When ready to implement Phase 4:
1. Review and approve this design
2. Create AWS infrastructure (Terraform/CloudFormation)
3. Implement Lambda functions
4. Add webhook endpoint
5. Deploy in observation mode
6. Gradually enable auto-sync features

**Estimated Total Implementation Time**: 12-16 hours over 2-3 weeks
