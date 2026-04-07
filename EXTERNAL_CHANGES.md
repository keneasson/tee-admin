# External Changes Required

Changes in this file flag code modifications that require **matching manual updates** in external systems that aren't auto-deployed. Check this file before every deployment.

## How to use
- When you change code that touches an external integration, add an entry below
- Before deploying, review all **pending** entries and complete the manual steps
- After completing, change status to `DONE` with the date

---

## Pending

### DynamoDB — Seed service times for Toronto East
- **Date**: 2026-03-27
- **Code change**: Unified worship services system — service times moved from hardcoded `schedule-times.ts` to per-ecclesia `scheduleConfig` in DynamoDB (with seasonal schedule support)
- **External action**: After deploying, run the migration script to seed Toronto East's service times:
  ```bash
  npx tsx scripts/seed-service-times.ts --dry-run   # Preview
  npx tsx scripts/seed-service-times.ts --execute    # Apply
  ```
- **Status**: PENDING
- **Impact if missed**: Service times will be blank in the directory and email templates will fall back to empty strings. The schedule page and newsletter are unaffected (they read from Google Sheets data, not the config).

## Completed

### DynamoDB — Enable TTL on tee-admin table
- **Date**: 2026-03-17
- **Code change**: Added `NotificationRecord` with `ttl` field to `packages/app/provider/dynamodb/types.ts`
- **External action**: Enabled TTL on the `tee-admin` table with attribute `ttl`
- **Status**: DONE 2026-03-25
- **Verified**: TTL active, 49 backlog expired items (TEST#, TOKEN#) pending auto-deletion

### Google Apps Script — webhook auth header
- **Date**: 2026-03-13
- **Commit**: `7fcec0c` (checkpoint with Ecclesia Directory and Contact List)
- **Code change**: Added `WEBHOOK_SECRET` auth check to `apps/next/app/api/webhook/route.ts`
- **External action**: Updated Google Apps Script `sendWebhook()` to include `'x-webhook-secret': WEBHOOK_SECRET` header
- **Status**: DONE 2026-03-13
- **Impact if missed**: Webhook returns 401, Google Sheets edits stop syncing to DynamoDB

---

## External Systems Reference

| System | Where to find it | Who can edit |
|--------|-----------------|--------------|
| Google Apps Script (schedule sync) | Google Sheet → Extensions → Apps Script | Sheet owner |
| Vercel environment variables | Vercel dashboard → Settings → Environment Variables | Project admin |
| AWS DynamoDB tables | AWS Console → DynamoDB | AWS account owner |
| AWS SES configuration | AWS Console → SES | AWS account owner |
| DNS / Domain settings | Domain registrar | Domain owner |
| Vercel cron jobs | `apps/next/vercel.json` (auto-deployed) | Via code |
