# External Changes Required

Changes in this file flag code modifications that require **matching manual updates** in external systems that aren't auto-deployed. Check this file before every deployment.

## How to use
- When you change code that touches an external integration, add an entry below
- Before deploying, review all **pending** entries and complete the manual steps
- After completing, change status to `DONE` with the date

---

## Pending

### GitHub Actions — secrets for the weekly Vercel deployment-prune job
- **Date**: 2026-09-04
- **Branch**: `chore/vercel-deploy-prune`
- **Code change**: Added `.github/workflows/vercel-deployment-prune.yml` (weekly cron + manual `workflow_dispatch`) running `scripts/prune-vercel-deployments.mjs`, which keeps the live production deployment + the newest 5 per project and deletes the rest. Prevents recurrence of the "Deployment Storage 100% of 10 GB" incident (184 retained builds).
- **Why it matters**: Vercel never auto-deletes deployments; without this job they accumulate until the free-tier storage cap is hit again. The job needs two repo secrets to authenticate to the Vercel API — until they're set it will simply fail with "VERCEL_TOKEN and VERCEL_TEAM_ID are required. Nothing deleted." (safe: it never deletes without them).
- **External action** (site owner, GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**):
  1. `VERCEL_TOKEN` — a Vercel access token (Vercel dashboard → **Account Settings → Tokens**, scoped to the **`ken-eassons-projects`** team). Treat like a password.
  2. `VERCEL_TEAM_ID` — `team_vwApqYX2oh48OUB9tx1TTTgR`.
  3. (Optional) Verify with a manual run: **Actions → "Prune old Vercel deployments" → Run workflow** with **dry_run = true** — it logs what it *would* delete without deleting.
- **Status**: PENDING — secrets not yet added. The workflow is merged but is a no-op (fails safely) until the two secrets exist.

### Vercel — Node.js runtime bump 22 → 24 (deprecation of Node 20)
- **Date**: 2026-08-14
- **Branch**: `chore/node-24`
- **Code change**: `engines.node` → `"24.x"` (a **range**, not an exact pin — Vercel only honours a major/range from `engines.node`; the previous exact `"22.17.0"` can be ignored, which is likely why a Node 20 deprecation notice appeared) and `.nvmrc` → `24`.
- **Why it matters**: Vercel is deprecating Node 20. With `engines.node = "24.x"` the deploy should build on Node 24 automatically — the PR's **preview build log** will state the Node version it used; confirm it reads `24.x` before merging to prod.
- **External action** (site owner, Vercel dashboard — belt-and-suspenders in case the dashboard setting overrides `engines`):
  1. `vercel switch` to scope **`ken-eassons-projects`**.
  2. For **both** projects — `tee-admin` and `echadhub` — open **Settings → Build & Deployment → Node.js Version** and set it to **24.x** (if it was pinned to 20/22 in the dashboard, that pin can win over `engines.node`).
  3. Redeploy prod (merging to `main` triggers it) and confirm the build log shows Node 24.
- **Status**: DONE (2026-08-15). Dashboard **Node.js Version set to 24.x on both `tee-admin` and `echadhub`** (confirmed via API). A preview rebuilt on Node 24 — build log: *"Skipping build cache since Node.js version changed from 20.x to 24.x"*, and the Node-20 deprecation error is gone. Repo pins (`engines.node` + `.nvmrc`) set to the exact current LTS `24.19.0`.

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
