# TEE Admin Architecture

A map of the system as the code stands. It says where things are and which
rules hold; the reasons live in the ADRs (`docs/adr/`) and design docs linked
below. If this page and the code disagree, the code is right and this page is
a bug.

---

## 1. Repository layout

Turborepo + Yarn workspaces.

| Path | What it is |
|------|-----------|
| `apps/next/` | The web app and every API route (Next.js App Router). `app/` = pages + `app/api/**/route.ts`; `utils/` = server-only code (auth, email, mailing lists, file storage); `hooks/` = Next-specific hooks; `tests/` = Vitest. |
| `apps/expo/` | React Native app (shares `packages/`). |
| `apps/email-builder/` | React Email templates (`emails/Newsletter`, `Memorial`, `BibleClass`, `SundaySchool`, `CustomEmail`, …), imported as `email-builder/emails/*` by `apps/next/utils/email/get-email-content.tsx`. |
| `apps/next/aws-monitor/` | SAM template + code for the `tee-admin-health-check` Lambda (section 7). |
| `packages/app/` | Shared logic: `features/` (screens), `provider/dynamodb/` (repositories, access-pattern registry, people index), `provider/sync/` (Sheets sync), `config/` (tenants, brand, Sheets config, service times), `types/`. |
| `packages/ui/` | Shared Tamagui components (`@my/ui`). |
| `packages/config/` | Tamagui config. |
| `scripts/` | Owner-run maintenance and migration scripts (backfills, audits). Not on any request path. |

**UI layering:** [ADR-0003](adr/0003-ui-layering-and-the-design-language-seam.md).
`page.tsx` is a mount point; screens live in `packages/app/features/`;
platform dependencies (next-auth, next/navigation) stay in `apps/next/` and
reach shared code as props or render-prop slots. Shared packages never import
from an app.

---

## 2. Tenancy

One deployment, one database, several tenants. The tenant is resolved from the
request `Host` (`packages/app/config/tenants.ts`): `tee-admin.com` → `tee`,
`echadhub.org` / `echadhub.com` → `echadhub` (the hub, not a peer tenant). The
tenant decides sender domain and branding. Model:
[ADR-0001](adr/0001-tenancy-model.md).

---

## 3. Authentication and people

- **NextAuth v5**, configured in `apps/next/utils/auth.ts` (exports `auth`,
  `handlers`, `signIn`, `signOut`). Session strategy **JWT**.
- Providers: Google, Credentials (email + password, minimum 12 characters),
  a Credentials one-time-code path, and Facebook when configured.
- The JWT carries `personId` (the PersonRecord) and `signInEmail` (the address
  actually proven at sign-in), plus `role`, `ecclesia`, `isRecordingBrother`,
  `assuranceLevel`, `authTime`. When one address belongs to several people the
  session asks "who are you?" and switches `personId` via `update()`.
- **People = PersonRecords**, and nothing else
  ([ADR-0006](adr/0006-one-source-of-truth-for-people.md)):
  `PERSON#<id>` / `PROFILE` plus one `EMAIL#<addr>` item per address (and
  `PHONE#`), found by address through `personByEmail` (gsi1). Repository:
  `packages/app/provider/dynamodb/repositories/person-repository.ts`.
  Read projections (cards, rosters, typeahead) live in
  `provider/dynamodb/people-index/` and are derived from the PersonRecord.
- The legacy `USER#` store (`user-repository.ts`,
  `utils/dynamodb/credentials-users.ts`, `get-user.ts`) and `DIRECTORY#MEMBERS`
  (`admin-repository.ts`) still exist and are scheduled for deletion (R8 in
  [legacy-people-retirement-plan](legacy-people-retirement-plan.md)). Do not
  add readers.
- Roles: owner › admin › rep › member › guest, stored on the PersonRecord
  (`packages/app/provider/auth/auth-roles.ts`). Recording Brother is a
  designation (`isRecordingBrother`), not a role.
  Assurance / step-up / PII redaction:
  [ASSURANCE_PII_AND_VERIFY](ASSURANCE_PII_AND_VERIFY.md),
  [ADR-0005](adr/0005-never-silently-withhold.md).

---

## 4. DynamoDB

All environments use the same production tables in `ca-central-1`. Client and
table names: `packages/app/provider/dynamodb/config.ts`.

| Table | Keys | Indexes | Holds |
|-------|------|---------|-------|
| `tee-admin` | `pkey` / `skey` (lowercase) | `gsi1`..`gsi4` on `gsiNpk` / `gsiNsk`, generic and overloaded, projection ALL | Single table: people, ecclesias, offices, posts, meetings, mailing lists + subscriptions, send records, tokens, feature flags, settings, legacy `USER#` |
| `tee-schedules` | `PK` / `SK` (uppercase) | `GSI1` (`GSI1PK`/`GSI1SK`), `GSI2` (`GSI2PK`/`GSI2SK`) | Schedules synced from Google Sheets (`SCHEDULE#<TYPE>` / `<date>#<id>`), events, news |
| `tee-sync-status` | `PK` / `SK` | none | Sheet sync status, `SYNC#<TYPE>` / `STATUS` |
| `tee-send-queue` | `PK` / `SK` | `StatusIndex` (`GSI1PK`/`GSI1SK`) | Email schedules (`SCHEDULE` / `<type>#<day>#<time>`) and queue entries (`QUEUE` / `<type>#<date>#<time>`) |

Do not rename keys on existing tables. A new table would use `PK`/`SK`.

### Access-pattern registry

`packages/app/provider/dynamodb/access-patterns.ts` is the one list of how
every table is read. Each entry names its table, index, key shape, and the one
file that writes its key attributes. Callers build queries with
`patternQuery(PATTERNS.<name>, args)`; writers add index entries with
`ENTRIES.*` / `patternEntry`. Background: plan §7–§8.

Rules, enforced by `apps/next/tests/access-pattern-registry.test.ts` (scans
`packages/app` and `apps/next`, skipping tests and `scripts/`):

1. **No Scan on a request path.** Read by key or Query a registered pattern.
   (A Scan returns 1 MB and stops; `tee-admin` is ~2.7 MB, so a Scan silently
   misses rows.) `ScanCommand`, `.scan(` and `.scanAll(` fail the test.
2. **No raw index names outside the registry.** `IndexName: 'gsi1'` fails;
   `IndexName: PATTERNS.x.index` passes.
3. **No new GSIs.** A new access pattern overloads an existing GSI with a new
   sparse key prefix, adds its writer, and ships a dry-run-by-default backfill
   for existing items (model: `scripts/backfill-access-patterns.ts`, which
   only ever SETs index attributes and refuses any account but 911911532459).

The test's allowlist accepts only two reasons: `R8 deletes:` (a legacy store
being removed) or `maintenance:` (a named owner-run job that paginates).

---

## 5. Email

SES v2 in `ca-central-1`. One sender per brand: `@tee-admin.com` for TEE,
`@echadhub.org` for the hub (`utils/email/resolve-brand-profile.ts`,
`buildEmailEnvelope`). Content is rendered by `getEmailContent` →
`[html, text, subject?]`; the core send is `emailSend` in
`apps/next/utils/email/email-send.tsx`.

### Who receives a send: the mailing-list registry

Every broadcast names a mailing list (`listId`, resolved in
`utils/mailing-lists/send-target.ts`). Recipients come only from the registry
(`utils/mailing-lists/registry-send.ts`):

opt-in `LISTSUB#<listId>` rows + the list's default opt-in
− SES account suppression list (bounces / complaints)
− unverified `EMAIL#` rows
− addresses whose SES contact has UnsubscribeAll.

There is no fallback to an SES topic's audience. A bridged list that is not
cut over, or a cut-over list that resolves to nobody, refuses to send.
`/email-preferences` writes the registry (and UnsubscribeAll) only.

**SES topics are a safety net, not the audience.** Each send names one topic
as a final gate: `safetyNetDefault` once the stored setting
`MAILING_LIST_SETTINGS / SAFETY_NET` is on (`utils/mailing-lists/safety-net.ts`),
else the bridged list's legacy topic. The account suppression list is separate
and always applies. SES contact-list edits wipe `TopicPreferences`: back up
first (CLAUDE.md).

### Send paths

| Path | Trigger | Route |
|------|---------|-------|
| Scheduled | EventBridge (section 7) | `GET /api/cron/email-queue` — reads schedules from `tee-send-queue`, materialises queue entries up to 2 h ahead, sends from the scheduled minute through +3 h, claims each entry by conditional status update so overlapping ticks cannot double-send, retries `failed` entries |
| Post / news / meeting | Admin presses send | `/api/admin/posts/[id]/send`, `/api/admin/news/[newsId]/send-alert`, `/api/admin/meetings/[meetingId]/send` |
| One person | Admin, permission-gated | `/api/email/send-one` — one explicitly requesting recipient, not a broadcast |
| Exhorter heads-up | EventBridge, Saturdays | `POST /api/cron/exhorter-heads-up` — currently redirects the email to the Recording Brother for review; never emails the speaker |
| Test | Manual call only | `/api/email/test-thursday` (no schedule calls it) |

Schedules are edited at `/api/email-schedules`. Per-recipient tracking writes
`SEND#<campaign>` / `RECIPIENT#<email>` (off with
`RECIPIENT_TRACKING_ENABLED=false`); SES events arrive via SNS at
`/api/ses/bounce-webhook`, which also marks bounced/complained `EMAIL#` rows.
Cron and webhook endpoints authenticate with `Authorization: Bearer
$EMAIL_SENDER_SECRET`.

Design background: [OFFICES_AUDIENCES_AND_SENDING_REDESIGN](OFFICES_AUDIENCES_AND_SENDING_REDESIGN.md).

---

## 6. Feature flags

Code defaults in `packages/app/features/feature-flags/feature-flags.ts`
(`DEFAULT_FEATURE_FLAG_CONFIGS`). Stored overrides are `tee-admin` rows
`FEATURE_FLAG#<name>` / `CONFIG`, read by key for each flag the code knows (no
Scan) and merged over the defaults, cached 60 s
(`repositories/feature-flag-repository.ts`). A flag gates at the API/UI; it
never changes a shared query path or data format.

---

## 7. Scheduled jobs

**There are no Vercel crons.** `apps/next/vercel.json` holds only an
`installCommand`. Every schedule is an EventBridge rule in account
911911532459, `ca-central-1`. Rules are UTC-only. The three email rules are
**not defined in the repo** (created by hand; see `EXTERNAL_CHANGES.md`); the
health check is defined in `apps/next/aws-monitor/template.yaml`.

Verified read-only on 2026-10-25:

| Rule | Schedule | Target | Calls |
|------|----------|--------|-------|
| `tee-email-cron` | `rate(5 minutes)` | API destination `tee-email-cron-dest` (connection `tee-email-cron-conn`, role `tee-scheduler-email-role`) | `GET https://www.tee-admin.com/api/cron/email-queue` |
| `tee-email-queue-processor` | `rate(1 hour)` | API destination `tee-email-queue-endpoint` (connection `tee-email-auth-connection`, role `EventBridgeSchedulerHttpRole`, 2 retries / 1 h) | `GET https://www.tee-admin.com/api/cron/email-queue` (same endpoint; redundant with the 5-minute tick, harmless because entries are claimed) |
| `tee-exhorter-heads-up` | `cron(0 14 ? * SAT *)` (10:00 EDT / 9:00 EST) | API destination `tee-exhorter-headsup-dest` (connection `tee-email-auth-connection`, role `tee-scheduler-exhorter-role`, 1 retry / 1 h) | `POST https://www.tee-admin.com/api/cron/exhorter-heads-up` |
| `tee-admin-health-check-schedule` | `rate(6 hours)` | Lambda `tee-admin-health-check` (nodejs18.x) | The Lambda GETs public pages and `/api/upcoming-program`, `/api/enhanced-schedule` on `www.tee-admin.com` and emails an alert via SES on failure |

Both connections send `Authorization` (API key = `Bearer <EMAIL_SENDER_SECRET>`).
Nothing scheduled calls `echadhub.org`. EventBridge Scheduler holds no
schedules. Other rules in the account (`cruiter-*`) belong to another project.

Inspect with:
`aws events list-rules --region ca-central-1` and
`aws events list-targets-by-rule --rule <name> --region ca-central-1`.

---

## 8. External dependencies

| Dependency | Use | Where |
|-----------|-----|-------|
| Google Sheets | **Schedules and programs only** (memorial, Bible class, Sunday school, …). Never members or contacts. | `packages/app/config/google-sheets.ts`, `packages/app/provider/sync/`; credentials + sheet ids in the `GOOGLE_SERVICE_ACCOUNT_KEY` env var (one-line JSON) |
| Google Apps Script | Sheet edit → webhook `POST /api/sheets/webhook` (also `/api/webhook`), authenticated with `WEBHOOK_SECRET` (Bearer, `x-webhook-secret`, or HMAC `x-webhook-signature`) → `WebhookSyncService` → `tee-schedules` | Script source copy: `scripts/google-apps-script-webhook.js`; the live script is in the Sheet |
| AWS SES | All mail; contact list + topics (safety net); account suppression list | `apps/next/utils/email/` |
| AWS SNS | SES bounce/complaint/delivery events → `/api/ses/bounce-webhook` | |
| AWS S3 | Uploaded files: bucket `tee-admin-files` (override `FILE_STORAGE_BUCKET`). Backups (SES exports etc.): private `tee-admin-backups` | `apps/next/utils/file-storage/` |
| AWS EventBridge / Lambda | Section 7 | |
| Vercel | Projects `tee-admin` (→ tee-admin.com) and `echadhub` (→ echadhub.org), scope `ken-eassons-projects`, both rooted at `apps/next`, same code and same database. Preview on push, production on merge to `main`. | |

Changes that need a matching external update (Apps Script, Vercel env, AWS)
are recorded in `EXTERNAL_CHANGES.md`.

---

## Further reading

- [docs/adr/](adr/README.md) — decisions (tenancy, privilege escalation, UI layering, rich text, never silently withhold, one source for people, behaviour specs)
- [legacy-people-retirement-plan](legacy-people-retirement-plan.md) — people index, access patterns, R-steps
- [UNIFIED_POST_MODEL_DESIGN](UNIFIED_POST_MODEL_DESIGN.md), [cms-rework-design](cms-rework-design.md) — posts / events / news
- [DEVELOPMENT](DEVELOPMENT.md), [INFRASTRUCTURE](INFRASTRUCTURE.md), [DYNAMODB_CONFIGURATION](DYNAMODB_CONFIGURATION.md)
