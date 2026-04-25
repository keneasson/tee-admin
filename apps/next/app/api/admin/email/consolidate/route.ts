import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { getContacts, updateContact, addContact } from '@/utils/email/contact'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  GetCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import { EmailListTypeKeys, EmailListTypes } from '@my/app/types'
import { SubscriptionStatus } from '@aws-sdk/client-sesv2'

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})
const docClient = DynamoDBDocumentClient.from(dynamoClient)

type DirectoryRecord = {
  PK: string
  SK: string
  firstName?: string
  lastName?: string
  email?: string
  address?: string
  phone?: string
  ecclesia?: string
  children?: string
  lastUpdated?: string
}

/**
 * POST: Handle contact consolidation operations
 * Body must include { operation: 'merge' | 'migrate' | 'reorder' | 'unsubscribe-all', ...params }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication - admin/owner only
    const session = await auth()
    if (!session || !['admin', 'owner'].includes((session.user as any)?.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { operation } = body

    switch (operation) {
      case 'merge':
        return await handleMergeContacts(body, session)
      case 'merge-persons':
        return await handleMergePersons(body, session)
      case 'migrate':
        return await handleMigrateEmail(body, session)
      case 'reorder':
        return await handleReorderEmails(body, session)
      case 'unsubscribe-all':
        return await handleUnsubscribeAll(body, session)
      case 'archive-email':
        return await handleArchiveEmail(body, session)
      case 'unarchive-email':
        return await handleUnarchiveEmail(body, session)
      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 })
    }
  } catch (error) {
    console.error('❌ Error in consolidation API:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * MERGE CONTACTS: Merge two contact records into one
 * Body: { operation: 'merge', sourcePK, sourceSK, targetPK, targetSK }
 */
async function handleMergeContacts(body: any, session: any) {
  const { sourcePK, sourceSK, targetPK, targetSK } = body

  if (!sourcePK || !sourceSK || !targetPK || !targetSK) {
    return NextResponse.json(
      { error: 'Missing required fields: sourcePK, sourceSK, targetPK, targetSK' },
      { status: 400 }
    )
  }

  console.log(`🔀 Merging contacts: ${sourceSK} → ${targetSK}`)

  // Detect SES-only contacts (PK starts with 'SES#')
  const sourceIsSESOnly = sourcePK.startsWith('SES#')
  const targetIsSESOnly = targetPK.startsWith('SES#')

  // Cannot merge two SES-only contacts
  if (sourceIsSESOnly && targetIsSESOnly) {
    return NextResponse.json(
      { error: 'Cannot merge two SES-only contacts. At least one must be a directory record.' },
      { status: 400 }
    )
  }

  // Handle SES-only contact: Add the SES email to the directory person
  if (sourceIsSESOnly || targetIsSESOnly) {
    const sesEmail = sourceIsSESOnly ? sourcePK.replace('SES#', '') : targetPK.replace('SES#', '')
    const directoryPK = sourceIsSESOnly ? targetPK : sourcePK
    const directorySK = sourceIsSESOnly ? targetSK : sourceSK

    console.log(`📧 Adding SES-only email ${sesEmail} to directory person ${directorySK}`)

    // Check if email is unsubscribed in SES
    let isUnsubscribed = false
    try {
      const sesContact = await getContacts({ nextPageToken: undefined })
      const matchingContact = sesContact?.Contacts?.find(
        (c) => c.EmailAddress?.toLowerCase() === sesEmail.toLowerCase()
      )
      if (matchingContact) {
        const contact = matchingContact
        // Email is unsubscribed if it has no topic preferences or all are OPT_OUT
        isUnsubscribed =
          !contact.TopicPreferences ||
          contact.TopicPreferences.length === 0 ||
          contact.TopicPreferences.every((pref) => pref.SubscriptionStatus === 'OPT_OUT')
      }
    } catch (error) {
      console.warn(`⚠️ Could not check SES subscription status for ${sesEmail}:`, error)
      // Continue with default behavior if SES check fails
    }

    if (isUnsubscribed) {
      console.log(`📦 Email ${sesEmail} is unsubscribed - will add as ARCHIVED`)
    }

    // Get the directory record
    const directoryRecord = await docClient.send(
      new GetCommand({
        TableName: 'tee-schedules',
        Key: { PK: directoryPK, SK: directorySK },
      })
    )

    if (!directoryRecord.Item) {
      return NextResponse.json({ error: 'Directory record not found' }, { status: 404 })
    }

    const directoryPerson = directoryRecord.Item as DirectoryRecord

    // Count existing ACTIVE emails for directory person
    const baseKey = directorySK.split('#EMAIL')[0]
    const existingEmailsQuery = await docClient.send(
      new QueryCommand({
        TableName: 'tee-schedules',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': directoryPK,
          ':sk': baseKey,
        },
      })
    )

    const existingEmails = existingEmailsQuery.Items || []
    const activeEmailCount = existingEmails.filter(
      (item) => !item.status || item.status === 'active'
    ).length

    // Check if email already exists
    if (existingEmails.some((item) => item.email?.toLowerCase() === sesEmail.toLowerCase())) {
      return NextResponse.json(
        { error: 'This email already exists for this person' },
        { status: 400 }
      )
    }

    // If email is unsubscribed, add as archived (doesn't count against 2-active limit)
    // If email has subscriptions, check 2-active limit
    if (!isUnsubscribed && activeEmailCount >= 2) {
      return NextResponse.json(
        {
          error: 'Directory person already has maximum of 2 active emails. Archive an email first.',
        },
        { status: 400 }
      )
    }

    // Add SES email to directory person
    const totalEmailCount = existingEmails.length
    const newEmailIndex = totalEmailCount
    const newSK = newEmailIndex === 0 ? directorySK : `${baseKey}#EMAIL${newEmailIndex}`
    // If unsubscribed → archived, else if <2 active → active, else → archived
    const emailStatus = isUnsubscribed ? 'archived' : activeEmailCount < 2 ? 'active' : 'archived'

    await docClient.send(
      new PutCommand({
        TableName: 'tee-schedules',
        Item: {
          PK: directoryPK,
          SK: newSK,
          firstName: directoryPerson.firstName,
          lastName: directoryPerson.lastName,
          email: sesEmail,
          status: emailStatus,
          address: directoryPerson.address,
          phone: directoryPerson.phone,
          ecclesia: directoryPerson.ecclesia,
          children: directoryPerson.children,
          lastUpdated: new Date().toISOString(),
          addedFromSES: true,
          addedBy: session.user.email,
          addedAt: new Date().toISOString(),
        },
      })
    )

    // Audit trail
    await logAuditEvent({
      operation: 'add-ses-email-to-directory',
      admin: session.user.email,
      directoryPK,
      directorySK,
      sesEmail,
      newSK,
      emailStatus,
      timestamp: new Date().toISOString(),
    })

    console.log(`✅ Added SES email ${sesEmail} to directory person ${directorySK}`)

    return NextResponse.json({
      message: 'SES email added to directory person successfully',
      addedEmail: sesEmail,
      status: emailStatus,
    })
  }

  // Both are directory records - proceed with normal merge
  const [sourceRecord, targetRecord] = await Promise.all([
    docClient.send(
      new GetCommand({
        TableName: 'tee-schedules',
        Key: { PK: sourcePK, SK: sourceSK },
      })
    ),
    docClient.send(
      new GetCommand({
        TableName: 'tee-schedules',
        Key: { PK: targetPK, SK: targetSK },
      })
    ),
  ])

  if (!sourceRecord.Item || !targetRecord.Item) {
    return NextResponse.json({ error: 'Source or target record not found' }, { status: 404 })
  }

  const source = sourceRecord.Item as DirectoryRecord
  const target = targetRecord.Item as DirectoryRecord

  // Count existing ACTIVE emails for target (max 2 active allowed, unlimited archived)
  const targetBaseKey = targetSK.split('#EMAIL')[0]
  const existingEmailsQuery = await docClient.send(
    new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': targetPK,
        ':sk': targetBaseKey,
      },
    })
  )

  const existingEmails = existingEmailsQuery.Items || []
  const activeEmailCount = existingEmails.filter(
    (item) => !item.status || item.status === 'active'
  ).length
  if (activeEmailCount >= 2) {
    return NextResponse.json(
      { error: 'Target contact already has maximum of 2 active emails. Archive an email first.' },
      { status: 400 }
    )
  }

  // Merge: Add source email to target (marked as active if <2 active, else archived)
  const totalEmailCount = existingEmails.length
  const newEmailIndex = totalEmailCount
  const newSK = newEmailIndex === 0 ? targetSK : `${targetBaseKey}#EMAIL${newEmailIndex}`
  const emailStatus = activeEmailCount < 2 ? 'active' : 'archived'

  await docClient.send(
    new PutCommand({
      TableName: 'tee-schedules',
      Item: {
        PK: targetPK,
        SK: newSK,
        firstName: target.firstName,
        lastName: target.lastName,
        email: source.email,
        status: emailStatus,
        address: target.address || source.address,
        phone: target.phone || source.phone,
        ecclesia: target.ecclesia || source.ecclesia,
        children: target.children || source.children,
        lastUpdated: new Date().toISOString(),
        mergedFrom: sourceSK,
        mergedBy: session.user.email,
        mergedAt: new Date().toISOString(),
      },
    })
  )

  // Delete source record
  await docClient.send(
    new DeleteCommand({
      TableName: 'tee-schedules',
      Key: { PK: sourcePK, SK: sourceSK },
    })
  )

  // Audit trail
  await logAuditEvent({
    operation: 'merge',
    admin: session.user.email,
    sourceEmail: source.email,
    targetEmail: target.email,
    sourceSK,
    targetSK,
    timestamp: new Date().toISOString(),
  })

  console.log(`✅ Merged ${sourceSK} into ${targetSK}`)

  return NextResponse.json({
    success: true,
    message: 'Contacts merged successfully',
    newSK,
  })
}

/**
 * MERGE PERSONS: Merge all emails from source person to target person (drag-and-drop merge)
 * Body: { operation: 'merge-persons', source: PersonEntry, target: PersonEntry }
 * This is designed for the drag-and-drop interface where entire person entries are merged
 */
async function handleMergePersons(body: any, session: any) {
  const { source, target } = body

  if (!source || !target) {
    return NextResponse.json({ error: 'Missing required fields: source, target' }, { status: 400 })
  }

  console.log(
    `🔀 Merging persons: ${source.firstName} ${source.lastName} → ${target.firstName} ${target.lastName}`
  )

  // Determine if source is SES-only or directory entry
  const sourceIsSESOnly = source.type === 'ses-only'
  const targetIsSESOnly = target.type === 'ses-only'

  // Cannot merge into an SES-only contact
  if (targetIsSESOnly) {
    return NextResponse.json(
      { error: 'Cannot merge into an SES-only contact. The target must be a directory entry.' },
      { status: 400 }
    )
  }

  // Get target's existing emails
  const targetBaseSkey = target.baseSkey
  const targetPK = 'DIRECTORY#MEMBERS'

  const existingEmailsQuery = await docClient.send(
    new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': targetPK,
        ':sk': targetBaseSkey,
      },
    })
  )

  const existingTargetRecords = existingEmailsQuery.Items || []
  const existingTargetEmails = new Set(
    existingTargetRecords.map((item) => (item.email || '').toLowerCase()).filter((e) => e)
  )

  // Get source emails to add
  const sourceEmails = source.emails
    .map((e: any) => e.email?.toLowerCase())
    .filter((e: string) => e && !existingTargetEmails.has(e))

  if (sourceEmails.length === 0) {
    return NextResponse.json(
      { error: 'No new emails to merge. Source emails already exist on target.' },
      { status: 400 }
    )
  }

  // Get target record for copying fields
  const targetRecord = existingTargetRecords[0] as DirectoryRecord | undefined
  if (!targetRecord) {
    return NextResponse.json({ error: 'Target directory record not found' }, { status: 404 })
  }

  // Add each source email to target
  let currentEmailCount = existingTargetRecords.length
  const addedEmails: string[] = []

  for (const email of sourceEmails) {
    const newSK =
      currentEmailCount === 0 ? targetBaseSkey : `${targetBaseSkey}#EMAIL${currentEmailCount}`

    await docClient.send(
      new PutCommand({
        TableName: 'tee-schedules',
        Item: {
          PK: targetPK,
          SK: newSK,
          firstName: targetRecord.firstName,
          lastName: targetRecord.lastName,
          email: email,
          status: 'active',
          address: targetRecord.address,
          phone: targetRecord.phone,
          ecclesia: targetRecord.ecclesia,
          children: targetRecord.children,
          lastUpdated: new Date().toISOString(),
          mergedFrom: sourceIsSESOnly ? 'SES' : source.baseSkey,
          mergedBy: session.user.email,
          mergedAt: new Date().toISOString(),
        },
      })
    )

    addedEmails.push(email)
    currentEmailCount++
    console.log(`  ✅ Added email: ${email}`)
  }

  // Delete source records (if directory entry)
  if (!sourceIsSESOnly && source.baseSkey) {
    // Query and delete all records for source person
    const sourceRecordsQuery = await docClient.send(
      new QueryCommand({
        TableName: 'tee-schedules',
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': 'DIRECTORY#MEMBERS',
          ':sk': source.baseSkey,
        },
      })
    )

    for (const record of sourceRecordsQuery.Items || []) {
      await docClient.send(
        new DeleteCommand({
          TableName: 'tee-schedules',
          Key: { PK: record.PK, SK: record.SK },
        })
      )
      console.log(`  🗑️ Deleted source record: ${record.SK}`)
    }
  }

  // Audit trail
  await logAuditEvent({
    operation: 'merge-persons',
    admin: session.user.email,
    sourceName: `${source.firstName || ''} ${source.lastName || ''}`.trim() || source.sesOnlyEmail,
    targetName: `${target.firstName} ${target.lastName}`,
    sourceType: source.type,
    addedEmails,
    timestamp: new Date().toISOString(),
  })

  console.log(
    `✅ Merged ${addedEmails.length} emails from ${source.firstName || source.sesOnlyEmail} to ${target.firstName} ${target.lastName}`
  )

  return NextResponse.json({
    success: true,
    message: 'Persons merged successfully',
    addedEmails,
    targetName: `${target.firstName} ${target.lastName}`,
  })
}

/**
 * MIGRATE EMAIL: Copy subscriptions from old email to new email
 * Body: { operation: 'migrate', oldEmail, newEmail, pkey, skey }
 */
async function handleMigrateEmail(body: any, session: any) {
  const { oldEmail, newEmail, pkey, skey } = body

  if (!oldEmail || !newEmail || !pkey || !skey) {
    return NextResponse.json(
      { error: 'Missing required fields: oldEmail, newEmail, pkey, skey' },
      { status: 400 }
    )
  }

  console.log(`📧 Migrating email: ${oldEmail} → ${newEmail}`)

  // Validate max 2 active emails (unlimited archived allowed)
  const baseKey = skey.split('#EMAIL')[0]
  const existingEmailsQuery = await docClient.send(
    new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': pkey,
        ':sk': baseKey,
      },
    })
  )

  const existingEmails = existingEmailsQuery.Items || []
  const activeEmails = existingEmails.filter((item) => !item.status || item.status === 'active')
  if (activeEmails.length >= 2 && !existingEmails.some((item) => item.email === oldEmail)) {
    return NextResponse.json(
      { error: 'Maximum of 2 active emails per person. Archive an email first.' },
      { status: 400 }
    )
  }

  try {
    // 1. Get old email's subscriptions from SES
    let oldSubscriptions: { [key in EmailListTypeKeys]?: boolean } = {}
    const allContacts = await getContacts({ nextPageToken: undefined })

    const oldContact = allContacts.Contacts?.find(
      (c) => c.EmailAddress?.toLowerCase() === oldEmail.toLowerCase()
    )

    if (oldContact && oldContact.TopicPreferences) {
      oldContact.TopicPreferences.forEach((pref) => {
        oldSubscriptions[pref.TopicName as EmailListTypeKeys] = pref.SubscriptionStatus === 'OPT_IN'
      })
    }

    // 2. Add new email to SES with copied subscriptions
    await addContact({
      email: newEmail,
      lists: oldSubscriptions as any,
    })

    // 3. Unsubscribe old email from all lists
    const unsubscribedLists = Object.keys(EmailListTypes).reduce(
      (acc, key) => {
        acc[key as EmailListTypeKeys] = false
        return acc
      },
      {} as { [key in EmailListTypeKeys]: boolean }
    )

    await updateContact({
      email: oldEmail,
      lists: unsubscribedLists as any,
    })

    // 4. Update DynamoDB - set new email as primary (first position) and mark as active
    await docClient.send(
      new UpdateCommand({
        TableName: 'tee-schedules',
        Key: { PK: pkey, SK: baseKey }, // Update base record
        UpdateExpression:
          'SET email = :newEmail, #status = :status, lastUpdated = :timestamp, migratedFrom = :oldEmail, migratedBy = :admin',
        ExpressionAttributeNames: {
          '#status': 'status', // 'status' is a reserved word in DynamoDB
        },
        ExpressionAttributeValues: {
          ':newEmail': newEmail,
          ':status': 'active',
          ':timestamp': new Date().toISOString(),
          ':oldEmail': oldEmail,
          ':admin': session.user.email,
        },
      })
    )

    // 5. Send notification email (TODO: implement email sending)
    console.log(`📬 Would send notification to ${newEmail}`)

    // 6. Audit trail
    await logAuditEvent({
      operation: 'migrate',
      admin: session.user.email,
      oldEmail,
      newEmail,
      subscriptionsCopied: Object.keys(oldSubscriptions).filter(
        (k) => oldSubscriptions[k as EmailListTypeKeys]
      ),
      timestamp: new Date().toISOString(),
    })

    console.log(`✅ Migrated email ${oldEmail} → ${newEmail}`)

    return NextResponse.json({
      success: true,
      message: 'Email migrated successfully',
      oldEmail,
      newEmail,
      subscriptionsCopied: Object.keys(oldSubscriptions).filter(
        (k) => oldSubscriptions[k as EmailListTypeKeys]
      ),
    })
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

/**
 * REORDER EMAILS: Change email order (first = primary)
 * Body: { operation: 'reorder', pkey, emails: ['email1', 'email2'] }
 */
async function handleReorderEmails(body: any, session: any) {
  const { pkey, emails } = body

  if (!pkey || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json(
      { error: 'Missing required fields: pkey, emails (array)' },
      { status: 400 }
    )
  }

  if (emails.length > 2) {
    return NextResponse.json({ error: 'Maximum of 2 emails per person' }, { status: 400 })
  }

  console.log(`🔄 Reordering emails for ${pkey}:`, emails)

  // Get current directory record to preserve other fields
  const baseKey = pkey.split('#')[1] || 'MEMBER'
  const currentRecord = await docClient.send(
    new GetCommand({
      TableName: 'tee-schedules',
      Key: { PK: pkey, SK: baseKey },
    })
  )

  if (!currentRecord.Item) {
    return NextResponse.json({ error: 'Contact record not found' }, { status: 404 })
  }

  const record = currentRecord.Item as DirectoryRecord

  // Update primary email (first in list)
  await docClient.send(
    new UpdateCommand({
      TableName: 'tee-schedules',
      Key: { PK: pkey, SK: baseKey },
      UpdateExpression: 'SET email = :email, lastUpdated = :timestamp',
      ExpressionAttributeValues: {
        ':email': emails[0],
        ':timestamp': new Date().toISOString(),
      },
    })
  )

  // If there's a second email, ensure it exists
  if (emails.length === 2) {
    await docClient.send(
      new PutCommand({
        TableName: 'tee-schedules',
        Item: {
          PK: pkey,
          SK: `${baseKey}#EMAIL1`,
          firstName: record.firstName,
          lastName: record.lastName,
          email: emails[1],
          address: record.address,
          phone: record.phone,
          ecclesia: record.ecclesia,
          lastUpdated: new Date().toISOString(),
        },
      })
    )
  }

  // Audit trail
  await logAuditEvent({
    operation: 'reorder',
    admin: session.user.email,
    pkey,
    newOrder: emails,
    timestamp: new Date().toISOString(),
  })

  console.log(`✅ Reordered emails for ${pkey}`)

  return NextResponse.json({
    success: true,
    message: 'Emails reordered successfully',
    primaryEmail: emails[0],
  })
}

/**
 * UNSUBSCRIBE ALL: Global unsubscribe (compliance)
 * Body: { operation: 'unsubscribe-all', email }
 */
async function handleUnsubscribeAll(body: any, session: any) {
  const { email } = body

  if (!email) {
    return NextResponse.json({ error: 'Missing required field: email' }, { status: 400 })
  }

  console.log(`🚫 Global unsubscribe: ${email}`)

  // Unsubscribe from all lists in SES
  const unsubscribedLists = Object.keys(EmailListTypes).reduce(
    (acc, key) => {
      acc[key as EmailListTypeKeys] = false
      return acc
    },
    {} as { [key in EmailListTypeKeys]: boolean }
  )

  await updateContact({
    email,
    lists: unsubscribedLists as any,
  })

  // Audit trail (compliance requirement)
  await logAuditEvent({
    operation: 'unsubscribe-all',
    admin: session.user.email,
    email,
    timestamp: new Date().toISOString(),
    compliance: true,
    listsUnsubscribed: Object.keys(EmailListTypes),
  })

  console.log(`✅ Globally unsubscribed: ${email}`)

  return NextResponse.json({
    success: true,
    message: 'Email unsubscribed from all lists',
    email,
    listsUnsubscribed: Object.keys(EmailListTypes),
  })
}

/**
 * ARCHIVE EMAIL: Mark email as archived (no longer receives SES emails)
 * Body: { operation: 'archive-email', pkey, email }
 */
async function handleArchiveEmail(body: any, session: any) {
  const { pkey, email } = body

  if (!pkey || !email) {
    return NextResponse.json({ error: 'Missing required fields: pkey, email' }, { status: 400 })
  }

  console.log(`📦 Archiving email: ${email}`)

  // Find the email record
  const baseKey = pkey.split('#')[1] || 'MEMBER'
  const existingEmailsQuery = await docClient.send(
    new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': pkey,
        ':sk': baseKey,
      },
    })
  )

  const existingEmails = existingEmailsQuery.Items || []
  const emailRecord = existingEmails.find((item) => item.email === email)

  if (!emailRecord) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  // Update status to archived
  await docClient.send(
    new UpdateCommand({
      TableName: 'tee-schedules',
      Key: { PK: pkey, SK: emailRecord.SK },
      UpdateExpression: 'SET #status = :status, lastUpdated = :timestamp',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'archived',
        ':timestamp': new Date().toISOString(),
      },
    })
  )

  // Audit trail
  await logAuditEvent({
    operation: 'archive-email',
    admin: session.user.email,
    pkey,
    email,
    timestamp: new Date().toISOString(),
  })

  console.log(`✅ Archived email: ${email}`)

  return NextResponse.json({
    success: true,
    message: 'Email archived successfully',
    email,
  })
}

/**
 * UNARCHIVE EMAIL: Mark email as active (can receive SES emails again)
 * Body: { operation: 'unarchive-email', pkey, email }
 */
async function handleUnarchiveEmail(body: any, session: any) {
  const { pkey, email } = body

  if (!pkey || !email) {
    return NextResponse.json({ error: 'Missing required fields: pkey, email' }, { status: 400 })
  }

  console.log(`📬 Unarchiving email: ${email}`)

  // Check if there are already 2 active emails
  const baseKey = pkey.split('#')[1] || 'MEMBER'
  const existingEmailsQuery = await docClient.send(
    new QueryCommand({
      TableName: 'tee-schedules',
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': pkey,
        ':sk': baseKey,
      },
    })
  )

  const existingEmails = existingEmailsQuery.Items || []
  const activeEmails = existingEmails.filter((item) => !item.status || item.status === 'active')

  if (activeEmails.length >= 2) {
    return NextResponse.json(
      { error: 'Maximum of 2 active emails. Archive another email first.' },
      { status: 400 }
    )
  }

  const emailRecord = existingEmails.find((item) => item.email === email)

  if (!emailRecord) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  // Update status to active
  await docClient.send(
    new UpdateCommand({
      TableName: 'tee-schedules',
      Key: { PK: pkey, SK: emailRecord.SK },
      UpdateExpression: 'SET #status = :status, lastUpdated = :timestamp',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'active',
        ':timestamp': new Date().toISOString(),
      },
    })
  )

  // Audit trail
  await logAuditEvent({
    operation: 'unarchive-email',
    admin: session.user.email,
    pkey,
    email,
    timestamp: new Date().toISOString(),
  })

  console.log(`✅ Unarchived email: ${email}`)

  return NextResponse.json({
    success: true,
    message: 'Email unarchived successfully',
    email,
  })
}

/**
 * Log audit event to DynamoDB
 */
async function logAuditEvent(event: any) {
  try {
    await docClient.send(
      new PutCommand({
        TableName: 'tee-schedules',
        Item: {
          PK: 'AUDIT#EMAIL',
          SK: `${new Date().toISOString()}#${event.operation}`,
          ...event,
          ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60 * 100, // 100 years (effectively indefinite)
        },
      })
    )
    console.log('📝 Audit event logged:', event.operation)
  } catch (error) {
    console.error('⚠️ Failed to log audit event:', error)
    // Don't fail the operation if audit logging fails
  }
}
