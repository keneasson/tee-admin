# Retiring the legacy people stores

Epic #270 · Decision: [ADR-0006](adr/0006-one-source-of-truth-for-people.md) · Audit date: 2026-10-17 (read-only)

> This repo is public. This document holds **counts and person ids only**. The per-person review sheet, which contains PII, is stored at `s3://tee-admin-backups/backups/2026-10-17-legacy-people-audit/`:
> - `reconciliation.html`
> - `reconciliation.json`
> - raw exports of every store that was read
> - the scripts that produced them

## 1. Store inventory

All counts come from full paginated scans:
- DynamoDB `scan` is auto-paginated by the CLI. Each table's count matched `describe-table` `ItemCount`.
- SES `list-contacts` is **not** auto-paginated. It returned 50 contacts plus a `NextToken` until it was paginated by hand: 182 contacts.

| Store | Key pattern | Items | Fields | Written by | Read by |
|---|---|---|---|---|---|
| **PersonRecords** (the source) | `tee-admin` `PERSON#<uuid>` / `PROFILE`, `EMAIL#`, `PHONE#`, `ADDRESS#`, `TOKEN#`, `CONTACT_VOTE#` | 180 PROFILEs, 185 partitions, 188 EMAIL#, 108 PHONE#, 77 ADDRESS# | name, primaryEmail, ecclesia, role, memberStatus, credentials | `personRepository` | directory, people, auth (OAuth/OTP), exhorter heads-up |
| Legacy directory | `tee-schedules` `PK=DIRECTORY#MEMBERS`, `SK=USER#<emails>#n[#EMAILn]` or `MEMBER#FIRST#LAST#n` | 143 (123 `USER#`, 20 `MEMBER#`) | firstName, lastName, email (`;`- or newline-separated), phone (free text, labelled), address (free text), ecclesia, status, merge metadata | directory-email-sync, consolidate, scripts | Email Lists, `pages/api/contact`, `/api/directory`, directory-email-sync |
| Legacy users | `tee-admin` `USER#<email>` and `USER#<uuid>` | 57 partitions: 9 `USER` profiles (7 with password), 8 `EMAIL#`, 1 `ADDRESS#`, 1 `PHONE#`, 29 `PRIVACY_SETTINGS`, 23 `RELATIONSHIP#`, 6 `CONNECTION#`, 5 `EDIT_REQUEST#`, 1 `CONTACT_REQUEST#`, 5 `SESSION#`, 2 `ACCOUNT#` | credentials, profile, per-person settings keyed by **email** | credentials-users, userRepository, privacy/relationship/connection/edit-request/contact-request repos | password sign-in, register/reset, profile, people pages |
| SES contact list `TEEAdmin` | contact per address | 182 contacts / 174 unique addresses (8 duplicated only by letter case); 16 carry `AttributesData` | TopicPreferences (7 topics; 4 default OPT_IN), AttributesData `{name, ecclesia}` or `{unsubscribeReason}` | cron `sync-ses-contacts` (from PersonRecords) **plus** about 10 SES-only writers | **every list send** (`emailSend`), Email Lists search |
| SES account suppression list | per address | 7 | reason | SES and the bounce webhook | sends, Email Lists |
| ECCLESIA denormalized people | `tee-admin` `ECCLESIA#…` `recordingBrotherEmail/Name`, `contactEmail` | 13 address fields on 12 ecclesias; 5 carry `recordingBrotherPersonId` | name + email copy | rb-service, `admin/ecclesias` (bypasses rb-service) | auth (RB detection, full scan), exhorter reply-to, notify RBs |
| RB nominations | `RB_NOM#…` `nomineeEmail/Name` | 4 | snapshot | rb-nomination routes | the same |
| Draft members | `DRAFT#<ecclesia>` / `MEMBER#<id>` | 0 today | draft person | people/add, drafts | drafts UI |
| Google Sheets "directory" | sheet tab | n/a | member list | — | auth legacy lookup, verify-otp, `/api/directory` (all fail or fall back) |
| Committed files | `apps/next/data/contact-subscribers{2,3,4}.json`, `contacts-subscribers.json`, `bkup.json`, `subscribed_email_audience_export_*.csv` | 6 files | emails, topics, names | — | `import-inter-ecclesia` (CSV) |
| Caches | `/api/people` cache; `DIRECTORY` cache tag | — | — | — | the people cache is already a PersonRecord projection |

Not people stores, but logs or snapshots that keep an email: `SEND#/RECIPIENT#` (5,170 items, per-send analytics), `TOKEN#`, `EXHORTER_HEADSUP#`. These are fine as event logs. They must not be read back as a source of people.

## 2. Code inventory (readers and writers outside PersonRecords)

About 75 non-test files and about 250 call sites. Paths are relative to the repo root.

### 2a. `DIRECTORY#MEMBERS` (15 files, about 45 call sites)

| file:line | R/W | Live | Replace with |
|---|---|---|---|
| `apps/next/app/api/admin/email/search/route.ts:130-134` | R | **Email Lists** | `searchByName` + `getEmailsByEmail` |
| `apps/next/app/api/admin/email/consolidate/route.ts:147,162,204,249,255,272,300,323,382,424,454,466,517,582,651,665,679,777,796,844,872` | R/W | Email Lists / directory-email-sync | `getEmails`, `addEmail`, `setEmailOrder`, `undoEmailRetire`, new `mergePersons`; delete the legacy branch |
| `apps/next/pages/api/contact/index.ts:58` (`getDirectoryData`; names joined at :91-102) | R | Email Lists | `listAll` / `getByEmail` |
| `packages/app/provider/dynamodb/schedule-service.ts:235-245, 269-295` | R | via callers | delete |
| `apps/next/app/api/directory/route.ts:60,149` | R | reachable, no UI | delete route |
| `apps/next/app/api/contacts/[email]/route.ts:49-54, 66-67` | R/W | reachable, no UI | delete |
| `apps/next/app/api/admin/directory-email-sync/{add-email:49,65; batch-member:56,72; delete:52,67; sync-from-ses:118,147}` | R/W | **Directory Email Sync screen** | delete the screen |
| `packages/app/features/directory-email-sync/index.tsx:435,545,952` | sends legacy keys | UI | delete |
| `packages/app/provider/get-google-sheet-migrated.tsx:123` | R | dead | delete |
| `scripts/migrate-to-unified-people.ts:102`, `scripts/migrate-ecclesia-to-canonical.ts:82,144`, `scripts/populate-dynamodb.ts:231` | R/W | scripts | delete |

### 2b. Legacy `USER#` (about 30 files, about 95 call sites)

**Auth (riskiest):**

| file:line | R/W | Live | Replace with |
|---|---|---|---|
| `apps/next/utils/auth.ts:90` → `apps/next/utils/dynamodb/credentials-users.ts:140-166,204` | R | **every password sign-in** | `personRepository.getCredentialsForVerification` (`person-repository.ts:1358`, unused today) |
| `credentials-users.ts:119-130` ← `app/api/auth/register/route.ts:75` | W | register | `createFromCredentials` (`:1260`) |
| `credentials-users.ts:180` full scan ← `auth.ts:89`, `app/api/ecclesia-contact/route.ts:51` | R | live | `emailExists` / `getByEmail` |
| `register:44`, `forgot-password:32`, `resend-verification:30`, `ecclesia-contact:36` | R | live | `getByEmail` |
| `credentials-users.ts:294-312` (`verify-email`), `:489-507` (`reset-password`), `:242+/:342+/:421+` (`VERIFY_TOKEN#`, `RESET_TOKEN#`, `INVITE_CODE#`) | R/W | live | `tokenRepository` + `markEmailVerified` / `updatePassword` |
| `auth.ts:424,463` → `utils/dynamodb/set-user-role.ts:43-46` | W | Google sign-in | delete |
| `auth.ts:435` → `utils/dynamodb/get-user.ts:44` (scan), `auth.ts:443` | R | only when `UNIFIED_PEOPLE_AUTH` is off | `getByEmailForAuth` |
| `auth.ts:2,203,501-575` (NextAuth adapter + events) | W | dead (adapter commented out) | delete |

**Per-person data keyed by email:**

All of these need new `PERSON#<id>` sub-items, because nothing exists on PersonRecord for them yet.

| file:line | Repository | Replace with |
|---|---|---|
| `app/api/user/privacy/route.ts:28,119`; `people/route.ts:190`; `people/[email]/route.ts:192,442,463`; `connections/route.ts:94`; `contact-requests/route.ts:108` | privacy | `PERSON#/PRIVACY` |
| `app/api/user/relationships/route.ts:33,265,279,345,359`; `people/[email]/route.ts:372`; `people/[email]/contacts/route.ts:331,369,458` | relationship | `PERSON#/REL#<personId>` |
| `app/api/user/connections/route.ts:20-138`; `user/connections/block/route.ts:37-85`; `app/api/connections/route.ts:23-194` | connection | `PERSON#/CONN#` |
| `app/api/contact-requests/route.ts`, `contact-requests/[requestId]/route.ts` | contact request | `PERSON#/…` |
| `app/api/edit-requests/route.ts`, `edit-requests/approve/route.ts`, `edit-requests/[requestId]/route.ts` | edit request | `PERSON#/…` |
| `app/api/user/preferences/route.ts:18,88` | userRepository `PREFERENCES` | `PERSON#/PREFS` |
| `app/api/user/emails/route.ts:78`; `user/emails/verify/route.ts:175,197` | userRepository `EMAIL#` (lazy-migration shim) | delete after drain |
| `user-repository.ts:35-199` (address/phone) | — | dead; delete |
| `packages/app/provider/sync/webhook-sync-service.ts:67` → `admin-repository.ts:211-230` | directory sheet webhook | delete the directory case |

### 2c. SES contact list used as a store (17 mutating files, 6 reading files)

**SES-only writers** (the cron then reverts them, or they overwrite `AttributesData`):
- `apps/next/app/api/subscribe/route.ts:158` (public)
- `pages/api/contact/index.ts:25,39`
- `consolidate/route.ts:566,574,736`
- `directory-email-sync/{create-entry:82, link-contact:62, sync-members-list:140, batch-member:122, add-email:113, delete:81}`
- `contacts/[email]/route.ts:79`
- `import-inter-ecclesia/route.ts:278,328`
- `utils/email/contact.ts:78,103,233`

Each of these should write to the PersonRecord first and let the projection push the change.

**The intended projection, which stays:** `app/api/cron/sync-ses-contacts/route.ts:157,171,306,313`.

**`AttributesData` read as a people source:**
- `admin/email/search/route.ts:245-250,296-305`
- `packages/app/features/email-lists/index.tsx:789-795`
- `admin/metrics/email/[campaignId]/recipients/route.ts:47-49`
- `migrate-inter-ecclesia:143-145`
- `import-inter-ecclesia:268-270`
- `sync-from-ses:97-105`

Replace each with `getByEmail`.

### 2d. Google Sheets "directory" (12 files)

| file:line | Status | Action |
|---|---|---|
| `packages/app/provider/auth/get-user-from-legacy.ts:6` (calls `/api/google-sheets`, which only exists as a `.bak`) ← `auth.ts:338,394,452,459`; `app/api/auth/verify-otp/route.ts:128,162` | always throws | delete. Known side effect today: in the unified Google sign-in branch the RB check and guest-person creation never run. |
| `apps/next/utils/get-google-sheets.ts:35` | `directory` branch | delete the branch |
| `apps/next/utils/user-from-legacy.ts:8` | — | delete |
| `packages/app/provider/dynamodb/data-service.tsx:30,107-111,215` | — | delete |
| `webhook-sync-service.ts:65-67,154,225`, `sheet-transformer.ts:129` | — | delete |
| `packages/app/config/google-sheets.ts:182` | — | delete |
| scripts | — | delete |

### 2e. Files and denormalized copies

- **CSV:** `import-inter-ecclesia/route.ts:132,430` reads the CSV.
  - `utils/email/init/iniSesInitialSubscriberList.ts:4` imports a JSON file (dead).
  - Delete them and purge them from history (#78). `bkup.json` is also tracked and is not listed in #78.
- **ECCLESIA Recording Brother fields:** rb-service writes these from PersonRecord (keep as a projection).
  - `app/api/admin/ecclesias/route.ts:118-119` writes them directly, bypassing rb-service. Route it through rb-service.
  - Readers to move to PersonRecord `isRecordingBrother`:
    - `utils/dynamodb/locations.ts:680-684` (auth scan via `auth.ts:134,256,341`)
    - `exhorter-heads-up.ts:299-300`
    - `notify-rbs-of-shared-event.ts:46,102`
    - `people/rb-nomination/route.ts`
- **RB_NOM:** store `nomineePersonId` instead of name/email.
- **Event `registration.contactEmail/Phone`:** add `contactPerson.personId`, as posts already do.
- **Draft members:** use `create({memberStatus:'draft'})` instead of the `DRAFT#…/MEMBER#…` items.

### 2f. Email send paths

- Every list send (newsletter, recap, bible-class, sunday-school, custom, posts, news alerts, meetings) resolves recipients through `utils/email/email-send.tsx:161-176,226-230` from **SES topics**. SES is therefore the effective send list, and some writes to it bypass PersonRecords (2c).
- `pages/api/email/[reason].ts` (sends to a whole list) and `pages/api/contact/index.ts` have **no auth check**.
- `send-one` and the exhorter heads-up already use PersonRecords.
- The PersonRecord-based `resolveListRecipients` / `mailingListRepository` exists but is only used by the parity check.

## 3. Reconciliation results (Phase 0, read-only)

There are 190 review cards: one per person, household, unmatched SES contact or orphan. Every one of the 180 PROFILEs and every legacy row appears on a card.

| Group | Cards |
|---|---|
| Auto-safe (only MISSING_ON_PERSON, single unambiguous target) | 14 |
| Needs decision | 64 |
| Orphans / duplicates to delete or merge | 37 |
| Nothing to do | 75 |

Field classifications, after removing duplicates across legacy rows:

| Classification | Count |
|---|---|
| SAME | 517 |
| MISSING_ON_PERSON | 64 |
| CONFLICT | 7 |
| UNMATCHED | 38 |
| LEGACY_ONLY_STALE | 8 |

Highlights (ids only):
- **All 143 legacy directory rows match at least one PersonRecord.** Matching ran by email, then phone, then name. Of the 57 legacy `USER#` partitions, 4 match no PersonRecord.
- **17 people exist only in legacy rows.** Each is a household row filed under a spouse's name, with no PersonRecord for that spouse. This is the #267 pattern, found household-wide. For each one the owner decides: create a household member, or drop the row.
- **Same first + last name on two PersonRecords: 0.** The owner's belief holds.
- **Nameless PROFILEs: 33.**
  - 4 are twins of a named record on the same address: `3c3cce97`, `3e718efc`, `618b6a2d`, and `be7f4b35` (the RB office address).
  - 2 split one legacy person across two emails: `03c0176a` and `dc4a80c8`.
  - Most of the rest were created by the 2026-01-27 inter-ecclesia import with no name. Several hold ecclesia office mailboxes, not people.
  - 1 looks like a sign-in orphan of a named person: `93b575c2`.
- **5 PERSON# partitions have no PROFILE.** They hold stale OTP tokens only: `4652a6e8`, `4cc711e6`, `5cf8ec4f`, `8827b3c4`, `be53e808`.
- **Sign-in ambiguity:**
  - 3 addresses are the GSI1 key of 2 PROFILEs each: the three twins.
  - 1 address signs in to a nameless PROFILE even though a named person holds it as a secondary: `be7f4b35`/`5f6c93f5`.
  - The `4981a5c7`/`837ffa40` shared primary is the owner-approved #267 state (`loginExcluded`).
  - The `280d923a`/`8a1ded7d` pair is a secondary holding (deterministic).
- **Households without a family link: 22 people.** Family links today live only in the email-keyed legacy `RELATIONSHIP#` store.
- **Bounced primaries still marked `sesStatus: active`: 3 PersonRecords.**
- **SES:**
  - 28 contacts are subscribed to topics, but no PersonRecord holds the address. They still receive sends.
  - 8 addresses exist twice in SES, differing only by letter case.
  - 25 PersonRecord emails have no SES contact.
- **#267 data step:** `837ffa40`'s bounced work-address `EMAIL#` item is **absent**. The #267 comment says it was archived, but it is not in the table. It survives only in the #267 S3 backup.

## 4. Phased plan

Each phase ends with its own verification. No phase starts until the previous one is verified.

### Phase 1: reconcile the data
1. The owner works through `reconciliation.html` and exports the decisions JSON.
2. Before any write, a fresh full backup goes to `tee-admin-backups`: all PERSON#, USER#, DIRECTORY#MEMBERS, and the SES contacts with topics, attributes and the suppression list.
3. An apply script reads `reconciliation.json` plus the decisions and writes **only** through `personRepository` methods: `addEmail`, `addPhone`, `addAddress`, `updatePerson`. It also creates the approved household members and merges the approved twins. Each write is logged with `personId`. The script has a dry-run mode.
4. Fix the 3 stale `sesStatus` values and the 5 PROFILE-less partitions.

**Verify:** re-run the audit scripts. Expected: 0 MISSING_ON_PERSON with an approved target, 0 twins, 0 GSI1 PROFILE collisions apart from approved households. Every SES subscribed address maps to a PersonRecord, or has been opted out by owner decision.

### Phase 2: move every reader (Email Lists first)
1. **Email Lists:** rebuild search and list on `listAll`/`searchByName` plus `getEmails`, with SES topics and suppression shown as read-only status. Merge, migrate, reorder and archive call `personRepository`. Delete the `tee-schedules` branches.
2. **Subscriptions:** every topic change (public subscribe, the preferences page, Email Lists) writes PersonRecord `sesTopicPreferences` first. The cron, or a synchronous projection call, pushes it to SES. Remove the SES-only writers.
3. **Auth:** move password sign-in, registration, verify and reset onto the PersonRecord credential methods. Do this behind a feature flag. Include a one-time copy of the 7 legacy password hashes; all 7 map to a PersonRecord. Remove the broken Sheets lookup.
4. **Email-keyed per-person data:** move privacy, relationships, connections, edit and contact requests, and preferences to `PERSON#<id>` sub-items, with a one-time copy.
5. **Recording Brother detection and reply-to:** read PersonRecord `isRecordingBrother`. The ECCLESIA fields stay as an rb-service-only projection.
6. **List sends:** switch `emailSend` to `resolveListRecipients` (PersonRecord) once parity is shown.

**Verify:**
- A grep gate in CI fails on `DIRECTORY#MEMBERS`, `findCredentialsUserByEmail`, `getUserFromLegacyDirectory`, or `AttributesData` reads.
- Auth: sign in with each method on the owner's own account only. Never test on another member's record.
- Sends: a parity report (`/api/admin/mailing-lists/parity`) shows identical recipient sets. Then one test-list send.

### Phase 3: delete the legacy code
Delete the Directory Email Sync screen and routes, `pages/api/contact`, `/api/directory`, `/api/contacts/[email]`, `credentials-users.ts`, the legacy `userRepository` people methods, the email-keyed repositories, the Sheets directory branches, the import routes and the migration scripts. Remove the nav links.

**Verify:** the build, typecheck and lint pass; the grep gate passes; the owner smoke-tests prod (`yarn smoke:prod`).

### Phase 4: delete the legacy data (after a final backup)
1. Final backup to `tee-admin-backups`.
2. Delete the `DIRECTORY#MEMBERS` rows, the legacy `USER#` people items, the subscriber JSON/CSV files (with a history purge, #78), and the duplicate-case SES contacts.
3. Rebuild SES from PersonRecords.

Remember the CLAUDE.md warning: contact-list edits are destructive, so back up first.

**Verify:** a scan shows 0 legacy items. A re-run of the audit shows only PersonRecords and derived projections.

## 5. Risks

| Risk | Why | Mitigation |
|---|---|---|
| **Auth** | Password sign-in still reads `USER#`. A wrong cutover locks members out. | Feature flag, copy hashes first, keep the legacy read as a fallback for one release, test on the owner's own account only |
| **Newsletter / SES sync** | Sends go to SES topics. SES-only writers fight the PersonRecord→SES cron. A contact-list edit can wipe `TopicPreferences` (the 2026-07-04 incident). | Back up before any `sesv2` mutation; make PersonRecord the only writer; parity check before switching recipients |
| **Crons** | `sync-ses-contacts` runs open when `CRON_SECRET` is unset; recap and bible-class send from SES topics. | Confirm `CRON_SECRET` on Vercel; ship Phase 2 send changes outside the Thursday–Saturday send window |
| **Directory Email Sync writes junk today** | The UI sends `PERSON#…/PROFILE` keys to a `tee-schedules` update, and its PATCH writes `primaryEmail` without updating GSI1. | Hide the screen now (Phase 2 step 0); no junk items were found in this scan |
| **Unauthenticated send route** | `pages/api/email/[reason].ts` | Add auth in Phase 2, or delete in Phase 3 |
| **Households** | A shared address on two people breaks email-keyed identity. | #268 (personId in the session) is a prerequisite for moving email-keyed records |
| **PII** | The audit artifacts contain PII. | Stored only in the private bucket; this doc and the issues hold counts and ids only |
