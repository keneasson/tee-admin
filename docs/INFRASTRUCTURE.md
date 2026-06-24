# TEE Admin Infrastructure Guide

> **Purpose**: Infrastructure setup, email scheduling, and AWS service configuration
> **Audience**: Developers managing deployment and infrastructure

> 🧭 **For accounts, CLI scoping, and how to deploy each brand, read
> [`CLOUD_ACCOUNTS_AND_DEPLOYMENT.md`](./CLOUD_ACCOUNTS_AND_DEPLOYMENT.md) first.**
> It is the authoritative runbook for *which* AWS account / Vercel team / project to use
> and how to verify scope before running anything. This file covers email scheduling and
> service details.

---

## Current Email Scheduling System

TEE Admin uses **Vercel cron jobs** for scheduled email delivery.

### Current Schedule
| Day | Time | Endpoint | Purpose |
|-----|------|----------|---------|
| Thursday | 9:30 PM | `/api/email/test-thursday` | Test newsletter (test list only) |

### Configuration
Located in `apps/next/vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/email/test-thursday",
      "schedule": "30 21 * * 4"
    }
  ]
}
```

### Security
- All email endpoints require `EMAIL_SENDER_SECRET` authentication
- Vercel automatically includes this in cron requests
- Manual testing:
```bash
curl -H "Authorization: Bearer $EMAIL_SENDER_SECRET" \
  https://your-domain.vercel.app/api/email/test-thursday
```

### Available Email Types
| Type | Template |
|------|----------|
| `newsletter` | Weekly newsletter |
| `bible-class` | Bible class reminder |
| `sunday-school` | Sunday school reminder |
| `recap` | Memorial service recap |
| `custom` | Custom email content |
| `event-announcement` | Event announcements |
| `inter-ecclesia` | Inter-ecclesia communications |

---

## Future: AWS EventBridge Scheduler

> **Status**: Not currently implemented. Documented for future scalability.

### Why EventBridge?
| Feature | Vercel Cron | EventBridge |
|---------|-------------|-------------|
| Free tier | 1 job | 14M invocations/month |
| Flexibility | Basic cron | Complex scheduling |
| Already using | No | Yes (DynamoDB, SES) |

### Implementation Steps (When Ready)

#### 1. Create IAM Role
```bash
# Create trust policy
cat > eventbridge-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Service": "scheduler.amazonaws.com"},
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name EventBridgeSchedulerHttpRole \
  --assume-role-policy-document file://eventbridge-trust-policy.json

# Attach policy
aws iam attach-role-policy \
  --role-name EventBridgeSchedulerHttpRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEventBridgeSchedulerFullAccess
```

#### 2. Create Schedule
```bash
aws scheduler create-schedule \
  --name tee-email-queue-processor \
  --schedule-expression "rate(15 minutes)" \
  --target '{
    "Arn": "arn:aws:scheduler:::aws-sdk:http:invoke",
    "RoleArn": "YOUR_ROLE_ARN",
    "Input": "{
      \"Method\": \"GET\",
      \"Url\": \"https://YOUR_DOMAIN/api/cron/email-queue\",
      \"Headers\": {
        \"Authorization\": [\"Bearer YOUR_EMAIL_SENDER_SECRET\"]
      }
    }"
  }' \
  --flexible-time-window '{"Mode": "OFF"}'
```

#### 3. Management Commands
```bash
# List schedules
aws scheduler list-schedules

# Disable temporarily
aws scheduler update-schedule --name tee-email-queue-processor --state DISABLED

# Re-enable
aws scheduler update-schedule --name tee-email-queue-processor --state ENABLED

# Delete
aws scheduler delete-schedule --name tee-email-queue-processor
```

### Migration Checklist
- [ ] Generate and set `EMAIL_SENDER_SECRET` in Vercel
- [ ] Create IAM role for EventBridge
- [ ] Create EventBridge schedule
- [ ] Test endpoint manually
- [ ] Monitor first 24 hours
- [ ] Remove Vercel cron (if fully migrating)

---

## Deployment

> **Scope first.** `vercel switch ken-eassons-projects` and verify AWS is account
> `911911532459` (`aws sts get-caller-identity`) before deploying. Two projects build from
> this repo — `tee-admin` (brand `tee`, www.tee-admin.com) and `echadhub` (brand `echadhub`,
> echadhub.org). Both auto-deploy previews on `git push` and production on merge to `main`.
> Full details + the Echad Hub preview flow: [`CLOUD_ACCOUNTS_AND_DEPLOYMENT.md`](./CLOUD_ACCOUNTS_AND_DEPLOYMENT.md).

### Commands
```bash
vercel switch ken-eassons-projects   # ← always scope first

# Preview (deploys to whatever .vercel links → tee-admin by default)
cd apps/next && vercel deploy

# Production deployment (after testing preview)
cd apps/next && vercel deploy --prod
```

### Environment Variables (Vercel Dashboard)
| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | AWS authentication |
| `AWS_SECRET_ACCESS_KEY` | AWS authentication |
| `AWS_REGION` | AWS region |
| `NEXTAUTH_SECRET` | NextAuth session encryption |
| `NEXT_PUBLIC_GOOGLE_CLIENTID` | Google OAuth client |
| `NEXT_PUBLIC_GOOGLE_ACCOUNT_SECRET` | Google OAuth secret |
| `WEBHOOK_SECRET` | Google Sheets webhook verification |
| `EMAIL_SENDER_SECRET` | Email endpoint authentication |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full Google service-account JSON on one line (creds + `sheet_ids`); no committed file |
| `NEXT_PUBLIC_BRAND` | `tee` or `echadhub` — selects brand at build time (set per Vercel project) |

### Build Configuration (Vercel)
- **Root Directory**: `apps/next`
- **Install Command**: `yarn set version berry && yarn install`
- **Build Command**: default

---

## AWS Services Used

> **Account `911911532459`, region `ca-central-1`** (IAM user `user/tee`; local `default`
> profile). Verify with `aws sts get-caller-identity` before any mutating command — see the
> runbook for why scoping matters on this machine.

### DynamoDB
- **Tables**: `tee-admin`, `tee-schedules`, `tee-sync-status`
- **Region**: `ca-central-1` (via `AWS_REGION`)
- **Access**: Via repository pattern (see ARCHITECTURE.md)
- **Shared**: one production DB across *all* domains/deploys — previews are not isolated.

### SES (Simple Email Service)
- **Purpose**: Email delivery
- **Templates**: React Email (`apps/email-builder/`)
- **Configuration**: AWS credentials in environment
- **Check sends**: `aws ses get-send-quota` → `SentLast24Hours`

### S3
- **Purpose**: File uploads (news/event attachments, generated PDF thumbnails)
- **Bucket**: `tee-admin-files` (default; override via `FILE_STORAGE_BUCKET`)

### Lambda / SAM
- **`aws-monitor`**: API health checks, deployed from `apps/next/aws-monitor/`
  (`sam build && sam deploy`)

### EventBridge (Future)
- **Purpose**: Advanced email scheduling
- **Status**: Documented, not implemented

---

## Related Files

| File | Purpose |
|------|---------|
| `apps/next/vercel.json` | Vercel cron configuration |
| `apps/next/app/api/cron/email-queue/route.ts` | Email queue processor |
| `packages/app/provider/dynamodb/` | Database access |
| `packages/app/provider/email/` | Email service |
| `apps/email-builder/` | Email templates |

---

*Consolidated from AWS_EVENTBRIDGE_SETUP.md and email scheduling documentation*
