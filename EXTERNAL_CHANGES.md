# External Changes Required

Changes in this file flag code modifications that require **matching manual updates** in external systems that aren't auto-deployed. Check this file before every deployment.

## How to use
- When you change code that touches an external integration, add an entry below
- Before deploying, review all **pending** entries and complete the manual steps
- After completing, change status to `DONE` with the date

---

## Pending

### Meta / Facebook Login — OAuth provider for sign-in + step-up "Confirm it's you"
- **Date**: 2026-08-10
- **Branch**: `feat/verify-modal-and-facebook`
- **Code change**: Added a conditional `FacebookProvider` to `apps/next/utils/auth.ts` (registered ONLY when both `FACEBOOK_CLIENT_ID` and `FACEBOOK_CLIENT_SECRET` are set) and a "Continue with Facebook" button in the `<Verify>` step-up modal (`apps/next/components/verify/verify.tsx`), gated on the client flag `NEXT_PUBLIC_FACEBOOK_ENABLED === 'true'`.
- **Why it's safe today**: With the env vars unset the provider is not registered (no `/api/auth/callback/facebook` route, nothing to break at build or runtime) and the button stays hidden. Nothing ships to prod as a dead button.
- **External action** (done by the site owner on the Meta side):
  1. Create a Meta/Facebook app at https://developers.facebook.com → add the **Facebook Login** product.
  2. Set **Valid OAuth Redirect URIs**:
     - `https://tee-admin.com/api/auth/callback/facebook`
     - `https://echadhub.org/api/auth/callback/facebook`
     - Vercel preview pattern: `https://*.vercel.app/api/auth/callback/facebook` (Meta may not accept a wildcard — if so, add each preview URL you actively test, e.g. `https://tee-admin-<hash>-ken-eassons-projects.vercel.app/api/auth/callback/facebook`).
  3. Copy the **App ID** and **App Secret** from Settings → Basic.
  4. On **BOTH** Vercel projects (`tee-admin` and `echadhub`), set:
     - `FACEBOOK_CLIENT_ID` = App ID
     - `FACEBOOK_CLIENT_SECRET` = App Secret
     - `NEXT_PUBLIC_FACEBOOK_ENABLED` = `true`
     Then redeploy each project so the provider registers and the button appears.
- **Impact if missed**: None until you finish setup — provider absent, button hidden. Once env vars are set, both the sign-in and step-up flows offer Facebook. Note the app must be taken **Live** (not Development mode) in the Meta dashboard for non-test users to sign in.
- **Status**: PENDING

## Known Issues (not deploy-blocking)

### DynamoDB — Picton service times seed bug
- **Date**: 2026-04-15
- **Code issue**: `scripts/seed-service-times.ts --execute` fails on Picton Ecclesia with `Pass options.removeUndefinedValues=true`. Picton's record has undefined values somewhere in the schedule config that the DynamoDB document client isn't configured to strip.
- **Fix**: Set `marshallOptions: { removeUndefinedValues: true }` on the script's document client (or sanitize input). One-line fix in `scripts/seed-service-times.ts`.
- **Impact**: Picton's service times remain blank in the directory. Toronto East and 36 other ecclesias are correctly seeded — no impact on tonight's business meeting email.

## Completed

### AWS Lambda — Health monitor: Sunday School recess suppression
- **Date**: 2026-06-18
- **Code change**: `apps/next/aws-monitor/health-check.js` now treats an empty `sundaySchool` schedule as healthy during the summer recess window (default `06-15` → `09-01`, UTC, recurring yearly). Other failures (non-200, bad JSON, missing structure) still alert year-round.
- **External action**: Redeployed the `tee-admin-health-check` Lambda via `sam build && sam deploy` (stack `tee-admin-health-monitor`, ca-central-1). Window is overridable without code changes via Lambda env vars `SUNDAY_SCHOOL_RECESS_START` / `SUNDAY_SCHOOL_RECESS_END` (format `MM-DD`).
- **Status**: DONE 2026-06-18
- **Verified**: Manual trigger returns 5/5 passed; Sunday School healthy with `count: 0` + "in recess" note; no alert email sent.

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
