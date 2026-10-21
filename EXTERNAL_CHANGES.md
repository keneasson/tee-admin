# External Changes Required

Changes in this file flag code modifications that require **matching manual updates** in external systems that aren't auto-deployed. Check this file before every deployment.

## How to use
- When you change code that touches an external integration, add an entry below
- Before deploying, review all **pending** entries and complete the manual steps
- After completing, change status to `DONE` with the date

---

## Pending

### Prod data — ecclesia offices (R3, owner-run, Sunday–Tuesday, after this deploys)
- **Date**: 2026-10-20
- **Branch**: `feat/office-rb-rep-slots` (PR #282)
- **Code change**: every ecclesia gets a Recording Brother office and zero or more Rep offices (`ECCLESIA_ID#<id> / OFFICE#<role>`). Setting a Recording Brother (nomination, or Admin → Recording Brothers) writes the RB office; the "ecclesia mail goes to" choice is the office's own address, never a person's email. Inter-ecclesia sends switch to the offices only when the `inter_ecclesia_from_offices` flag is `everyone` AND the offices marker exists; until then they send from the `interEcclesia` registry list, unchanged.
- **External action** (each step is read-only unless it says `--apply`):
  1. `npx tsx scripts/propose-office-assignments.ts --out ~/office-proposal.json` — drafts the assignments from today's data into a private file (outside the repo). Nameless records become office addresses, never holders; they are listed to retire in R8. Review the file.
  2. `npx tsx scripts/backfill-office-assignments.ts --input ~/office-proposal.json` — dry run: planned writes and the recipient diff against the `interEcclesia` list. Dry run 2026-10-20: 55 rows, 0 errors; 36 addresses the same; 1 only today (a subscriber at "Montreal Ecclesia", which has no ecclesia record); 4 only on offices (Brampton's RB and three Reps with no list row).
  3. `npx tsx scripts/backfill-office-assignments.ts --input ~/office-proposal.json --apply --accept-diff` — backs up to `s3://tee-admin-backups/backups/<date>-office-assignments/`, writes through `officeRepository`, re-plans to verify, writes the offices marker.
  4. `npx tsx scripts/diff-inter-ecclesia-recipients.ts` — confirm the same differences, then set the `inter_ecclesia_from_offices` flag to `everyone`.
- **Status**: PENDING

### Prod data — relationships move to person keys, and the password sign-in flag (R7, run IMMEDIATELY after this deploys)
- **Date**: 2026-10-18
- **Branch**: `fix/r7-password-primary-relationships`
- **Code change**: family relationships are read and written as `PERSON#<id> / REL#<targetId>#<type>` (both directions in one transaction). The legacy `USER#<email> / RELATIONSHIP#…` rows are no longer read, so **from the moment this deploys until step 2 runs, every family list is empty** (hidden, not lost: the legacy rows are untouched). Run steps 1–2 right after the prod deploy finishes. Password sign-in and the password step-up check the PersonRecord behind the new `person_password_signin` flag (default **off**).
- **External action** (as soon as the merge to `main` has deployed to prod — families are hidden until step 2):
  1. `npx tsx scripts/migrate-relationships-to-person.ts` (dry run; counts and person ids; per-row detail goes to a local temp file). Dry run on 2026-10-18: 23 legacy rows → 11 pairs, 0 unresolved, 1 resolved by the sign-in rule.
  2. `npx tsx scripts/migrate-relationships-to-person.ts --apply --after-deploy` — backs up to `s3://tee-admin-backups/backups/<date>-relationships-to-person/`, writes, verifies. Check your own Family tab. **Do not leave a gap between the deploy and this step.**
  3. `npx tsx scripts/migrate-relationships-to-person.ts --apply --after-deploy --delete-legacy` — deletes the legacy rows of verified pairs only.
  4. Owner: `/admin/evolution/feature-flags` → `person_password_signin` → **owner**; sign in with your password (and a step-up) on your own account; then **everyone**.
- **Status**: DONE 2026-10-20 — steps 1–3 applied and verified (23 legacy rows → 11 pairs, legacy deleted; backup `2026-10-20-relationships-to-person`). Step 4: the owner signed in with a password through the PersonRecord, and the `person_password_signin` flag was then removed (person password sign-in is the default for everyone).

### SES + prod data — finish R5: safety-net topics, retire topic fields (owner-run, in order)
- **Date**: 2026-10-18
- **Branch**: `feat/r5-finish`
- **Code change**: every send names a mailing-list `listId`; `/email-preferences` writes only the registry (+ UnsubscribeAll); all SES topic writers and `cron/sync-ses-contacts` are deleted; sends name the SES safety-net topic once the stored setting `MAILING_LIST_SETTINGS / SAFETY_NET` is on (until then, each bridged list's legacy topic). Sends never fall back to an SES topic's audience: a bridged list that is not cut over REFUSES to send (400 on manual sends; the cron marks the entry failed with the reason), as does a cut-over list that resolves 0 recipients.
- **Why the order matters**: (1) with topic writes gone, a preference change only reaches delivery for a list that sends from the registry, so all 7 lists must be cut over before this merges — otherwise that list's sends are refused (the code enforces it; nobody is mis-sent, but the send does not go out); (2) `update-contact-list` wipes every contact's TopicPreferences, so it runs only after cutover and a backup, and a send naming a deleted topic fails.
- **External action**:
  1. Before merge: `npx tsx apps/next/utils/mailing-lists/mailing-list-ops.ts parity`, then `cutover --topic <t> --to registry --apply` for every list still on SES (Sunday–Tuesday).
  2. After deploy: one test-list send from the Email Sender.
  3. Sunday–Tuesday, no manual sends running: `npx tsx scripts/ses-safety-net-topics.ts` (dry run), then `--apply` (backs up to `s3://tee-admin-backups/backups/<date>-ses-safety-net/`, marks the setting `switching` so every send refuses, replaces the topics with `safetyNetDefault`, checks and re-applies UnsubscribeAll and refuses to go on if any stop is missing, only then flips the setting on, verifies).
  4. Sunday–Tuesday: `npx tsx scripts/ses-merge-case-duplicates.ts` (dry run), then `--apply` (refuses until step 3 is verified; backs up the affected contacts to `s3://tee-admin-backups/backups/<date>-ses-case-duplicates/`, merges the 8 letter-case duplicates onto the lower-case address keeping UnsubscribeAll, verifies).
  5. `npx tsx scripts/retire-ses-topic-fields.ts` (dry run), then `--apply`; re-run dry to confirm 0 remain.
  6. Vercel: no app code reads `CRON_SECRET` any more (only the deleted `cron/sync-ses-contacts` did); removing it is optional.
- **Status**: DONE 2026-10-19 — steps 1–5 applied and verified (backups under `s3://tee-admin-backups/backups/2026-10-19-*`); step 6 optional.

### Vercel — echadhub production email turned ON (`EMAILS_ENABLED=true`)
- **Date**: 2026-10-13
- **Branch**: `chore/echadhub-emails-enabled` (config only, no code change)
- **What changed**: On the **echadhub** Vercel project, `EMAILS_ENABLED` was `false` for Production + Preview since 2026-04-25 (commit `476bcdb8`, a kill switch from when echadhub was a parallel test copy sharing the live DB/SES). It was never re-enabled after echadhub.org went live, so **every email from echadhub.org was silently skipped**: login codes, email verification, email-change codes, suggestion and connection notices. Found when an owner's OTP to `ken.easson+hacker@gmail.com` never arrived (log: `[sendEmail] Skipped — EMAILS_ENABLED=false (deployment=echadhub …)`).
- **Action taken**: Production set to `EMAILS_ENABLED=true` (sensitive var) and production redeployed. **Preview stays `false`**: PR preview builds also run against the live DB and must not email real members.
- **Why it's safe**: no scheduled job targets echadhub. Vercel crons are empty; all EventBridge API destinations (`tee-email-cron-dest`, `tee-email-queue-endpoint`, `tee-exhorter-headsup-dest`) call `https://www.tee-admin.com`, so nothing can double-send. SES identity `echadhub.org` is verified with DKIM `SUCCESS`. echadhub.org now only sends when a person there acts (asks for a code, an admin presses send).
- **Status**: DONE (2026-10-13).
### Prod data — people-index backfill for #275 (run AFTER this deploys), then the sign-in flag
- **Date**: 2026-10-17
- **Branch**: `feat/people-access-patterns`
- **Code change**: new derived projection items on `tee-admin` (person `CARD`, `NAMETOK#…`; `ECCLESIA_ID#<id>` directory/alias). Also a new OFFICE source entity (`ECCLESIA_ID#<id> / OFFICE#<role>`, `officeRepository`); no office data is migrated yet. `PersonRepository` and `locations.ts` keep them in sync on every write. Readers (`/api/people`, `/api/people/guests`, the ecclesia list/picker, `/api/people/typeahead`) switch to them **only once the backfill marker `PEOPLE_INDEX#META/BUILD` exists**; before that they keep the legacy Scans.
- **External action** (after the merge to `main` has deployed to prod):
  1. `npx tsx scripts/rebuild-people-projections.ts` (dry run; counts only).
  2. `npx tsx scripts/rebuild-people-projections.ts --apply --after-deploy` — backs up PERSON#/ECCLESIA/ECCLESIA_ID# to `s3://tee-admin-backups/backups/<date>-people-index-backfill/`, writes only projection items, re-verifies (0 differences), then writes the marker.
  3. Owner, when ready: `/admin/evolution/feature-flags` → `people_index_signin` → **everyone**. Until then the sign-in Recording Brother check for a brand-new address keeps the table Scan.
- **Kill switches** (Vercel env, no code change): `PEOPLE_INDEX_READS=off` (all readers back to legacy), `PEOPLE_INDEX_WRITES=off` (stop the projection writer; re-run the script afterwards to repair).
- **Status**: PENDING

### Prod data — household shared email for issue #267 (run AFTER this deploys)
- **Date**: 2026-10-17
- **Branch**: `fix/267-household-email-headsup-resend`
- **Code change**: `getByEmail` now resolves an address held as primary by several people **deterministically** (`chooseSignInHolder`: drops `loginExcluded` rows, then lowest personId), and `scripts/join-shared-household-email.ts` makes a shared household address a person's primary, marked `loginExcluded`.
- **Why the order matters**: before this code is live, two PROFILEs on one address make sign-in pick a person **arbitrarily**. The data step must run only after the deploy.
- **External action** (after the merge to `main` has deployed to prod):
  1. Backup is already taken: `s3://tee-admin-backups/backups/2026-10-17-amos-household-email-267/`.
  2. `aws configure export-credentials --format env-no-export > /tmp/aws.env` (account 911911532459), then:
     `npx tsx --env-file=/tmp/aws.env scripts/join-shared-household-email.ts --person 837ffa40-d7dc-4cb9-a8ae-f1ece844ec15 --address <household address> --retire <dead work address>` (dry run), then re-run with `--apply --after-deploy`. The addresses are in the #267 thread with the owner, not in the repo.
  3. Confirm the script's last line says sign-in resolves to `4981a5c7-93df-4c02-aa46-a2849b9998dd`.
  4. Owner: open `/admin/exhorter-heads-up` → **Prepare a corrected copy** → check the QA copy → send from its link.
- **Status**: PENDING

### GitHub Actions — secrets for the weekly Vercel deployment-prune job
- **Date**: 2026-09-04
- **Branch**: `chore/vercel-deploy-prune`
- **Code change**: Added `.github/workflows/vercel-deployment-prune.yml` (weekly cron + manual `workflow_dispatch`) running `scripts/prune-vercel-deployments.mjs`, which keeps the live production deployment + the newest 5 per project and deletes the rest. Prevents recurrence of the "Deployment Storage 100% of 10 GB" incident (184 retained builds).
- **Why it matters**: Vercel never auto-deletes deployments; without this job they accumulate until the free-tier storage cap is hit again. The job needs two repo secrets to authenticate to the Vercel API — until they're set it will simply fail with "VERCEL_TOKEN and VERCEL_TEAM_ID are required. Nothing deleted." (safe: it never deletes without them).
- **External action** (site owner, GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**):
  1. `VERCEL_TOKEN` — a Vercel access token (Vercel dashboard → **Account Settings → Tokens**, scoped to the **`ken-eassons-projects`** team). Treat like a password.
  2. `VERCEL_TEAM_ID` — `team_vwApqYX2oh48OUB9tx1TTTgR`.
  3. (Optional) Verify with a manual run: **Actions → "Prune old Vercel deployments" → Run workflow** with **dry_run = true** — it logs what it *would* delete without deleting.
- **Status**: DONE 2026-09-04 — both secrets added; the job has run every Monday since (it prunes tee-admin and echadhub alike, e.g. 13 + 13 deleted on 2026-10-05).

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

## GOOGLE_PLACES_API_KEY — missing in production (2026-09-08)

**Symptom:** the address lookup when adding an ecclesia returns nothing, with no
error shown.

**Cause:** `GOOGLE_PLACES_API_KEY` is not set on the Vercel `tee-admin` project.
`/api/places/autocomplete` and `/api/places/details` both check for it and return
`{ success: true, configured: false, predictions: [] }` — a SILENT no-op that is
indistinguishable in the UI from "no matches found".

**Consequence:** with no address parsed, province and city were left empty, and
the ecclesia create path (which required only `name`) wrote a record whose key
is `ECCLESIA#CA|` + `#Grand River` — successfully saved and permanently
invisible, because every directory read filters on the geographic prefix.

**Action required (outside the repo):**
1. Create a Google Places API key and add `GOOGLE_PLACES_API_KEY` to the Vercel
   `tee-admin` project (Production + Preview).
2. Until then the lookup stays unavailable; the form now says so rather than
   silently returning no results, and province/city must be entered by hand.

Validation is fixed in-repo regardless (province/city are required at both the
route and the write), so a failed lookup can no longer produce an invisible
record. Google Places was always listed as deferred — design Slice 10, #224.

---

## EventBridge schedule for the exhorter heads-up (#124, slice B) — 2026-09-12

**What is in the repo:** `GET|POST /api/cron/exhorter-heads-up`, Bearer-authenticated
with `EMAIL_SENDER_SECRET` like the other cron endpoints. It resolves who is
exhorting three Sundays out, renders the email, and **redirects that exact email
to the Recording Brother** for QA in a real inbox — same subject, same body,
with one appended footer block carrying a link. **It never emails the exhorter**
— that happens only when a person presses the button on the page that link
opens. Going live means changing the `To:` and dropping the footer block.

**DONE — created 2026-09-13** in `ca-central-1` (account 911911532459). Three
resources, all NEW; nothing existing was modified:

- **Rule** `tee-exhorter-heads-up` — `cron(0 14 ? * SAT *)`, ENABLED.
- **API destination** `tee-exhorter-headsup-dest` — `POST
  https://www.tee-admin.com/api/cron/exhorter-heads-up`, rate-limited to 1/sec,
  reusing the existing `tee-email-auth-connection` (which already carries
  `Authorization: Bearer <EMAIL_SENDER_SECRET>`; the secret was never handled
  directly).
- **Role** `tee-scheduler-exhorter-role` — trusts `events.amazonaws.com`,
  permitted `events:InvokeApiDestination` on THAT destination only.
- **Retry:** 1 attempt, 1-hour max age. A re-run is safe (it mints a new QA copy
  and sends nothing to the speaker) but there is no value in hammering.

**The time is UTC, and that is a real limitation.** EventBridge *Scheduler*
supports `ScheduleExpressionTimezone`, but it does NOT support API destinations
as targets — that is a Rules feature, and classic Rules are UTC-only. So the
schedule is fixed at **14:00 UTC = 10:00 EDT in summer, 9:00 EST in winter**.
For a Saturday-morning QA copy an hour's seasonal drift is immaterial; if it
ever matters, the fix is a Lambda in front (Scheduler → Lambda → fetch), not a
second rule per season.

**Why the send date matters:** the job computes the target Sunday itself
(`computeNextTargetSunday`, +15 days / three Sundays). Do NOT pass a `date`
parameter on the schedule; the notice period must live in ONE place. The
`?date=` parameter exists only for re-running a specific Sunday by hand.

**First fire:** Sat 2026-09-19 10:00 EDT, targeting the exhortation on Sunday
2026-10-04.

`POST /api/admin/exhorter-heads-up` (owner/admin) still triggers or re-sends a
QA copy by hand at any time — that is how you re-test after correcting the
Program.

**Deferred deliberately:** there is no auto-send path at all, so there is no
flag to forget to turn off. Removing the review step after a few weeks of solid
tests is a code change, reviewed like any other.

### Follow-on: tracking for the 1:1 heads-up depends on the existing config set

The heads-up now sends with `ConfigurationSetName: 'tee-email-tracking'` and a
`Campaign` message tag, which is how `/api/ses/bounce-webhook` attributes
Delivery / Open / Bounce / Complaint back to the recipient row. The webhook
already handles all four.

**Worth confirming once in the AWS console:** that the `tee-email-tracking`
configuration set's event destination publishes **Delivery** and **Open**, not
only Bounce and Complaint. If it publishes only failures, the review page will
correctly report a bounce but will never be able to say "delivered" — it will
sit on "not confirmed yet" forever, which looks like a bug and is not one.

Open tracking also requires "Open and click tracking" to be enabled on that
configuration set.

No code change either way; this is a console setting the feature reads through.
