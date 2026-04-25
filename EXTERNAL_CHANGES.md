# External Changes Required

Changes in this file flag code modifications that require **matching manual updates** in external systems that aren't auto-deployed. Check this file before every deployment.

## How to use
- When you change code that touches an external integration, add an entry below
- Before deploying, review all **pending** entries and complete the manual steps
- After completing, change status to `DONE` with the date

---

## Pending

_(none)_

## Known Issues (not deploy-blocking)

### DynamoDB — Picton service times seed bug
- **Date**: 2026-04-15
- **Code issue**: `scripts/seed-service-times.ts --execute` fails on Picton Ecclesia with `Pass options.removeUndefinedValues=true`. Picton's record has undefined values somewhere in the schedule config that the DynamoDB document client isn't configured to strip.
- **Fix**: Set `marshallOptions: { removeUndefinedValues: true }` on the script's document client (or sanitize input). One-line fix in `scripts/seed-service-times.ts`.
- **Impact**: Picton's service times remain blank in the directory. Toronto East and 36 other ecclesias are correctly seeded — no impact on tonight's business meeting email.

## Completed

### DynamoDB — Seed service times for ecclesias
- **Date**: 2026-03-27
- **Code change**: Unified worship services system — service times moved from hardcoded `schedule-times.ts` to per-ecclesia `scheduleConfig` in DynamoDB (with seasonal schedule support)
- **External action**: Ran `npx tsx scripts/seed-service-times.ts --execute` — 37 of 38 ecclesias seeded successfully. Picton failed due to a script bug (now tracked separately above).
- **Status**: DONE 2026-04-15
- **Verified**: Dry-run on 2026-04-15 reports Toronto East and 36 others "already has serviceTime for all enabled types"

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
