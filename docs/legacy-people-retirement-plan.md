# People, offices and mailing lists: requirements

Epic #270 · Decision: [ADR-0006](adr/0006-one-source-of-truth-for-people.md) · Written 2026-10-17

> This repo is public. This document holds **counts and person ids only**. Per-person review data (PII) lives in the private `tee-admin-backups` bucket and the owner's private review page.

This is the **single requirements document** for this work. It replaces the separate issues listed in §0.5. Work is finished when every requirement in §0.2 meets its acceptance check and §0.4 holds. Anything not listed in §0.2 is out of scope (§0.3). A new finding goes in §0.3 as one line, **not** into a new issue, PR or agent, unless it is a live security or data-loss emergency.

## 0.1 Goal

One source of truth for **people**, **ecclesias and their offices**, and **mailing-list subscriptions**. Every page, email and widget reads from those objects, or from a projection rebuilt only from them. The legacy stores, the code that reads them, and the migration tooling are deleted.

## 0.2 Requirements and acceptance checks

| # | Requirement | Done when |
|---|---|---|
| R1 | **People data reconciled.** The owner-confirmed review page is applied: missing spouses created, couples linked, household address/phone/email shared, stale addresses dropped, deceased recorded, blank twins merged, "name unknown" subscribed readers created as people. Backup first. Writes go only through `personRecords` repository methods. | Audit re-run: 0 unapplied confirmed items; 0 blank twins; every explicitly opted-in SES address maps to a person. |
| R2 | **Household and role sign-in: proving the email, then saying who.** Email + code or email + password proves the person can use that address (*authorized*). It does not say *who* they are: a household shares one inbox, and a role-based address (an office mailbox such as an ecclesia's recording-brother address) belongs to whoever holds the role. So after the email is proven, when more than one person can use it, ask "Are you A or B?" — the people who hold that address, plus, for an office mailbox, the office's current holder(s). That answer is trusted, because the caller is already authorized for the address; the name check only identifies who. One holder → no question. The session carries `personId` (and the office, when signed in through an office mailbox). A household member's own password, when they have one, identifies them directly. | The owner signs in as himself through a shared-address flow on his own account, and through an office mailbox lands as the office's holder. No email-keyed lookup decides identity. |
| R3 | **Ecclesias and offices.** One record per ecclesia (duplicates merged; missing ones created) with a stable id. Each has a Recording Brother office and zero or more Rep offices. An office holds its own email/phone/address and a reference to its current holder (nullable). `isRecordingBrother` / `isInterEcclesiaRep` are derived from offices. Copied RB name/email fields are deleted. Assignments come from the owner's confirmed review page. **Send routing:** anything addressed to an ecclesia (inter-ecclesia mail, "message an ecclesia") goes to the office's own email when it has one, otherwise to the current holder's primary email; Reps the same way. **Office addresses are not personal addresses:** an address that belongs to an office (e.g. an ecclesia's recording-brother mailbox) is stored on the office, never as one of the holder's own emails, and moves to the next holder with the role. **UX must make this explicit:** the holder's profile shows the office address in its own "Your role" section ("Recording Brother, <ecclesia>: <address> — goes with the role"), separate from their personal addresses; the office view shows which address receives ecclesia mail and the fallback ("no office email — using <holder>'s primary"). | Every ecclesia shows an RB office. Inter-ecclesia sends reach the same addresses as before cutover, verified by a diff. RB detection at sign-in reads offices. No office is a nameless person. A message to an ecclesia reaches the office email, or the holder's primary when the office has none (tested both ways). No office mailbox remains listed as a personal email on its holder. |
| R4 | **Email Lists on people.** The page reads only person records. Subscription status uses the same rule as sending (explicit opt-in only). SES drift is shown, never silently "fixed". (PR #279) | Desmond and Radica show as two people sharing one address. No legacy-directory card exists. |
| R5 | **Mailing lists in-house.** Subscriptions live in the registry (`LIST#` / `SUB#` per person, #182). The `sesTopicPreferences` field is retired. Every subscribe/unsubscribe writes the registry. List sends resolve recipients from the registry, filtered by the SES suppression list. Each list is identified by its UUID `listId` and owned by an ecclesia or organization **by id** (the R3 ecclesia id), not by name; the `TENANT#`/`SCOPE#` keys use those ids. A list's display name is derived from its owner plus its own name ("Toronto East Newsletter", "Cambridge Memorial Recap", "Toronto Area CYC"), never stored twice. Each list carries its own `defaultOptIn`. Sends target a `listId`; the fixed `EmailListTypes` names (`newsletter`, `recap`, …) stop being identifiers. SES topics stop deciding who gets what; they become **safety nets**: a few broad categories (for example by country) that a send checks as its final gate. The safety nets are an operational setting, not legal advice; if a law such as CASL or GDPR needs it, a lawyer reviews them. | Backfill applied; parity diff empty for all 7 lists; one test-list send through the registry; flag on; SES topic writers removed; every list owner is an id and every send names a `listId`. No person or subscription record stores a topic name (`memorial`, `newsletter`, …): subscriptions are keyed only by `listId` (`SUB#<listId>#<emailId>`); the list's `sesTopic` bridge field is deleted once that list is cut over, and `sesTopicPreferences` is removed. The 7 per-email-type topics are replaced by the safety-net topics only after cutover, after a full SES backup (a topic edit wipes every contact's preferences). Every email address is stored lower case only; SES holds no case duplicates (today 8, written by `utils/email/contact.ts` and `import-inter-ecclesia`, which don't lower-case), and each pair's opt-ins are merged onto the lower-case contact. |
| R6 | **Smart widgets supported (data and API only).** A post stores a person or ecclesia id. A server endpoint returns that person's contact card, or the ecclesia's location and offices, redacted per viewer tier (ADR-0005), in one batch read. | Endpoint tests per tier: anon gets the floor; member gets email and phone per the person's privacy; ecclesia gets location plus RB/Rep links. No Scan on the request path. |
| R7 | **Every reader moved.** Password sign-in, registration, verify and reset; email-keyed privacy, relationships and requests; RB detection; the Sheets people lookup. All read person or office records. | A CI grep gate fails on any legacy-store read. Owner-account sign-in test for each method. |
| R8 | **Legacy deleted.** Code: legacy repositories, routes, scripts, Pages Router email/contact routes, migration tools. Data: `DIRECTORY#MEMBERS`, legacy `USER#` people items, copied ecclesia RB fields, committed subscriber files (with history purge, #78). Final backup first. | A scan shows 0 legacy items. The grep gate passes. `yarn smoke:prod` passes. |

### R5 status (2026-10-18)

Done in code (PR #285 and the R5-finish PR):

- Every send names a `listId`: the Email Sender, the News/Events composer, the post and news-alert senders, meeting sends, scheduled sends (a schedule can carry a `listId`) and test sends resolve one registry list (`utils/mailing-lists/send-target.ts`). The audience picker lists every active list by its derived name, including lists with no SES topic. The send record stores the `listId`. The `EmailListTypes` enum is deleted; an old list key ('newsletter') is still read only from records saved before R5 (drafts, meetings, news blasts, schedules without a `listId`) and resolved to the owner's list.
- `defaultOptIn` applies: an eligible person (the list is offered to them by the scope ladder) with no row on the list is treated as subscribed, source `default`, at read time. Any row the person has, or an opt-out of that address, wins. Leaving such a list writes an `opt_out` row.
- Safety net: sends name the topic from `utils/mailing-lists/safety-net.ts` (`safetyNetDefault`, default OPT_IN) once the stored setting is on; until then a bridged list names its legacy topic and a new list names none.
- No send falls back to an SES topic's audience (`utils/mailing-lists/registry-send.ts`): a bridged list that is not cut over refuses to send, and so does a cut-over list that resolves 0 recipients, because `/email-preferences` no longer writes SES topics. While the switch script runs, the setting is `switching` and every send refuses.
- SES topic writers removed: `/api/subscribe` writes only the registry plus UnsubscribeAll; `contact.ts` add/update helpers, the email-tester SES contact/topic editor, `pages/api/contact/*`, `import-inter-ecclesia`, `migrate-inter-ecclesia`, the SES init scripts and `cron/sync-ses-contacts` are deleted. An admin email change moves registry rows. The Email Lists page reads the registry.
- `sesTopicPreferences` is removed from the types and from every reader and writer.

Owner-run steps, in order (each is a dry run first; `--apply` backs up first):

1. Cut over every bridged list: `npx tsx apps/next/utils/mailing-lists/mailing-list-ops.ts parity`, then `cutover --topic <topic> --to registry --apply` for each (Sunday–Tuesday). Merge the R5-finish PR only after all 7 lists show `sendFromRegistry: true`: a list that is not cut over refuses to send after the merge.
2. Send one test-list email from the Email Sender.
3. Sunday–Tuesday, with no manual send running: `npx tsx scripts/ses-safety-net-topics.ts`, then `--apply`. It backs up every contact, the topic list and the suppression list; marks the setting `switching` (every send refuses); replaces the topics with the safety net; checks UnsubscribeAll with a fast ListContacts pass, re-applies any that were lost and refuses to continue if one is still missing; only then switches sends to the safety net; and verifies.
4. Sunday–Tuesday: `npx tsx scripts/ses-merge-case-duplicates.ts`, then `--apply`. It refuses until step 3 is verified, backs up the affected contacts, merges the 8 letter-case duplicates onto the lower-case address (UnsubscribeAll kept) and verifies.
5. `npx tsx scripts/retire-ses-topic-fields.ts`, then `--apply`: removes `sesTopicPreferences` from EMAIL# items, and (after step 3) each list's `sesTopic`.
6. Re-run step 5 as a dry run: 0 remaining. R5 is done when these steps are complete.

## 0.3 Out of scope ("Not now")

Not part of this work. Each is one line here, not an issue.

- Widget **UI** in the editor (CMS slices #221 / #263 / #256). This work only provides the data and endpoint (R6).
- `List-Unsubscribe` one-click header.
- Trust weighting / community verification of contact details.
- Multi-tenant newsletters for other ecclesias (#26).
- Rotted test files (#244) and the dead `apps/next` lint (#216), except where a file this work touches must pass.
- `unsubscribeContact` (bounce webhook, deceased) finds the SES contact by the address as given, not lower-cased.
- A list's `defaultOptIn` reaches people through `listEcclesiasCached`, which today returns 35 of 39 ecclesias (§0.6), so a default list misses people of the other 4 until that Scan is fixed.
- Snapshots outside the post registration contact: legacy event `registration.contactEmail/Phone` (`events.ts:106`) and a location block's copied ecclesia address (R6 stores `ecclesiaId` beside it); both move to references with the editor's smart widgets.
- Merging twin persons (R1, `scripts/merge-duplicate-persons.ts`) does not yet move a person's `REL#` relationship rows to the surviving person; the relationship migration's dry run also shows 2 people with 2 spouse rows each, left for the owner's review page.

## 0.4 Definition of done

1. Every R1–R8 acceptance check holds in production.
2. Every PR for this work is merged; no open branch, draft or `wip` issue remains for it.
3. The issues in §0.5 are closed with a one-line pointer to this document.
4. The owner has been sent a short done-vs-left report.

## 0.5 Issues this document replaces

These issues are folded into epic #270 and closed when their requirement is done:

| Issue | Folded into |
|---|---|
| #267 | R1, R4 |
| #268 | R2 |
| #276 | R4 |
| #280, #58 (office part), branch `feat/office-rb-rep-slots` (WIP: 1 type error, 2 stale tests) | R3 |
| #182 | R5 |
| #129 | R1, R7 |
| #238 | R7 (cache invalidated on every person write) |
| #275 (access patterns; code merged in #278, readers waiting on the projection backfill) | R6, R7 |

## 0.6 Order and owner inputs

R4 and R6 can proceed now. Both start by applying the people-projection backfill from #278 (dry run: 180 CARD, 300 NAMETOK and 39 ecclesia directory items, no deletes). Readers stay on the legacy Scans until that backfill exists. Note that today's single-page `getAllEcclesia` Scan returns only 35 of the 39 ecclesias. R3 and R1 need the owner's confirmed review page. R5 needs R1, because every subscriber needs a person. R2 is needed before email-keyed records move (R7). R8 comes last.

The owner's only remaining inputs are the review-page answers, plus approval of this document.

---

The sections below are the original audit inventory and technical design, kept as reference. Where they conflict with §0, §0 wins.

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
| `apps/next/app/api/admin/email/search/route.ts:130-134` | R | **Email Lists** | **done** (#276): person CARDs + read-only SES snapshot |
| `apps/next/app/api/admin/email/consolidate/route.ts:147,162,204,249,255,272,300,323,382,424,454,466,517,582,651,665,679,777,796,844,872` | R/W | Email Lists / directory-email-sync | **deleted** (#276); person fixes are made on the profile |
| `apps/next/pages/api/contact/index.ts:58` (`getDirectoryData`; names joined at :91-102) | R | Email Lists | `listAll` / `getByEmail` |
| `packages/app/provider/dynamodb/schedule-service.ts:235-245, 269-295` | R | via callers | delete |
| `apps/next/app/api/directory/route.ts:60,149` | R | reachable, no UI | delete route |
| `apps/next/app/api/contacts/[email]/route.ts:49-54, 66-67` | R/W | reachable, no UI | delete |
| `apps/next/app/api/admin/directory-email-sync/{add-email:49,65; batch-member:56,72; delete:52,67; sync-from-ses:118,147}` | R/W | **Directory Email Sync screen** | **deleted** (#274) |
| `packages/app/features/directory-email-sync/index.tsx:435,545,952` | sends legacy keys | UI | **deleted** (#274) |
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
- ~~`consolidate/route.ts:566,574,736`~~ (deleted, #276)
- `directory-email-sync/{create-entry:82, link-contact:62, sync-members-list:140, batch-member:122, add-email:113, delete:81}`
- `contacts/[email]/route.ts:79`
- `import-inter-ecclesia/route.ts:278,328`
- `utils/email/contact.ts:78,103,233`

Each of these should write to the PersonRecord first and let the projection push the change.

**The intended projection, which stays:** `app/api/cron/sync-ses-contacts/route.ts:157,171,306,313`.

**`AttributesData` read as a people source:**
- ~~`admin/email/search/route.ts:245-250,296-305`~~ (#276)
- ~~`packages/app/features/email-lists/index.tsx:789-795`~~ (#276)
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
  - 22 contacts have an explicit topic opt-in, but no PersonRecord holds the address. They still receive sends. (An earlier count of 28 wrongly included 6 addresses that only match a topic default; sends never use defaults.)
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
0. **Access patterns first** (§7): add the new key items and sparse index entries (name tokens, OFFICE references, the ecclesia directory entry, the contact CARD, gsi2 on contact sub-items). Backfill them with a rebuild script that reads only PersonRecords and ECCLESIA items. Then replace each request-path Scan with its §7 Query. Every later step builds on these patterns.
1. **Email Lists:** rebuild search and list on `listByEcclesia` and the §7 typeahead, plus `getEmails`. Do not use `listAll`, because it is a Scan. with SES topics and suppression shown as read-only status. Merge, migrate, reorder and archive call `personRepository`. Delete the `tee-schedules` branches.
2. **Subscriptions:** superseded by R5. Every subscription change writes the mailing-list registry (`SUB#`), not `sesTopicPreferences`, which is retired.
3. **Auth:** move password sign-in, registration, verify and reset onto the PersonRecord credential methods. Do this behind a feature flag. Include a one-time copy of the 7 legacy password hashes; all 7 map to a PersonRecord. Remove the broken Sheets lookup.
4. **Email-keyed per-person data:** move privacy, relationships, connections, edit and contact requests, and preferences to `PERSON#<id>` sub-items, with a one-time copy.
5. **Recording Brother detection and reply-to:** read the `OFFICE#` references (§7, patterns 8 and 11). The copied ECCLESIA name and email fields become an rb-service-only projection until Phase 4 deletes them.
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

## 6. Entities and smart widgets

The cleanup must support the unified editor's smart-profile widgets: CMS Slice 7 #221 (name → live contact link), #263 (warn when the audience is wider than the contact's privacy) and #256 (scoped access requests). Both widgets render from the **two source entities**, through ADR-0005's server-side, tier-based projection.

| Entity | Source item | What it owns |
|---|---|---|
| **Person** | `PERSON#<personId>` (PROFILE plus sub-items) | name, emails, phones, addresses, privacy, family links, subscriptions, credentials |
| **Ecclesia / Organization** | `ECCLESIA#<country\|prov city>` / `<city>#<name>` (Organization item later, ADR-0001) | name, location and venue, service times, offices |
| **Office** (Recording Brother, Treasurer, Inter-Ecclesia Rep, …) | its **own source item**: `ECCLESIA_ID#<ecclesiaId> / OFFICE#<role>` (#58, owner decision 2026-10-17) | its own contact channels (office email such as a role inbox, optional phone and postal address), a `holderPersonId` **reference** to the current holder, and the term history (`terms: [{personId, from, to}]`). The holder changes; the office's contact details stay. It never stores the holder's name or email. |

**Smart contact** ("contact <a member> for details"):
- The post stores `{ personId }` only.
- At render, the server resolves the person, then applies the person's per-field privacy and the reader's tier:
  - Anonymous readers get the first-name floor plus "sign in to view contact details".
  - Members get email and phone, wherever the person's privacy allows it.
  - An escalation action (#256) appears wherever privacy withholds something.
- #263's audience-versus-privacy warning reads the same CARD (pattern 10).

**Smart place** ("at the Mississauga West ecclesia"):
- The post stores the ecclesia key only.
- Readers get the ecclesia's name, location and venue, and its service times (`resolveServiceTime`, with seasonal schedules and occurrence overrides).
- Office links resolve each `OFFICE#` reference to a Person and render as a smart contact. That gives "Recording Brother: <smart contact>".

**Offices (#58).** An office is an entity, not a person and not a flag:
- Sending "to the Treasurer" uses the office email. "Who is the Recording Brother" resolves `holderPersonId` to a Person and renders it as a smart contact through the ADR-0005 tiers.
- An office mailbox is **never** a nameless PersonRecord. Today's blank records for role inboxes and ecclesia mailboxes (§3, "nameless PROFILEs") are that mistake; they are retired with the owner's reconciliation, not before.
- Writer: `officeRepository` only (`packages/app/provider/dynamodb/repositories/office-repository.ts`). Writes are version-conditional so concurrent holder changes cannot lose a term.
- Not yet migrated: the existing `recordingBrother*` fields on ECCLESIA items and the `isRecordingBrother` / `isInterEcclesiaRep` person flags still carry today's data. Moving them into OFFICE# items comes with the confirmed reconciliation (Phase 1).

**Snapshots to remove:**
- the registration block `contactEmail` / `contactPhone` (`packages/app/types/post.ts:257-258`)
- event `registration.contactEmail/Phone` (`packages/app/types/events.ts:106-107`)
- the ECCLESIA `recordingBrotherName/Email`
- RB_NOM `nomineeName/Email`

Each is replaced by an id reference.

## 7. Access patterns (single `tee-admin` table)

**Current table.** On-demand billing. Four GSIs (`gsi1`–`gsi4`), **all `ProjectionType: ALL`**. Keys are `pkey`/`skey`, kept for compatibility (CLAUDE.md).

**Rules:**
- No Scan on any request path. Crons may Scan only when a pattern below does not cover them, and must say so.
- "New" entries reuse the existing GSIs by overloading their key prefixes, so no new GSI is needed. Every new index entry is **sparse**: only the items that carry the attributes appear in it.

| # | Pattern | Key condition / index | Op | Today | Change needed |
|---|---|---|---|---|---|
| 1 | Person by id | `pkey=PERSON#<id>`, `skey=PROFILE`. The whole person is `Query pkey=PERSON#<id>`. | GetItem / Query | **Exists** (`getById`, `person-repository.ts:123`) | — |
| 2 | Person by any email (sign-in) | `gsi1`: `gsi1pk=EMAIL#<addr>`, `begins_with(gsi1sk,'PERSON')`. PROFILE has `gsi1sk=PERSON`; secondaries have `PERSON#<id>`. | Query | **Exists** (`getByEmail` :142, `getAllPersonsByEmail` :167) | Shared household addresses return more than one person, so this becomes the chooser input (#268). Fix the twins (§3). |
| 3 | Typeahead by name (smart-contact picker) | Today: `gsi3`: `gsi3pk=NAME#<last>`, `begins_with(gsi3sk,'<first>')`. **New:** name-token items `PERSON#<id> / NAMETOK#<token>` with `gsi3pk=NAMEPFX#<tenant>#<first 2 letters>` and `gsi3sk=<token>#<personId>`, `begins_with(gsi3sk,'<typed>')`. | Query | **Partial**: only works after an exact last name. Cannot serve a partial name such as "Jo Sm…", or a prefix of either name. | **New sparse token items on gsi3.** The person writer writes 2–3 small items per person. Optionally project the display name, then BatchGet the CARD (pattern 10) for the top hits. |
| 4 | People by ecclesia (directory, Email Lists) | `gsi2`: `gsi2pk=ECCLESIA#<name>`, `gsi2sk=<last>#<first>#<id>` | Query | **Exists** (`listByEcclesia` :204), but the request paths Scan: `/api/people` → `listAll` (`people/route.ts:94`, repo :1126-1130) and `getAllPhonesByPerson` (`people/route.ts:104`, repo :1104-1108). | Replace both Scans with this Query. Put `gsi2pk/gsi2sk` on the PHONE#, EMAIL# and ADDRESS# sub-items too, so one Query returns each person's item collection. Key `gsi2pk` by a stable ecclesia id, not the display name, so a rename cannot orphan people. "Everyone" means iterating pattern 9, or a tenant-wide key. |
| 5 | People by list/topic (audiences) | `gsi1`: `gsi1pk=LISTSUB#<listId>`, `gsi1sk=<email>` on `PERSON#<id> / SUB#<listId>#<emailId>` | Query | **Exists** (`mailing-list-repository.ts:193-199`) but **not used by sends**. Sends call SES `ListContacts` (`email-send.tsx:161-176`). The SES sync cron Scans (`cron/sync-ses-contacts/route.ts:72`). | Sends and the SES projection both read this Query. SES is rebuilt from it. |
| 6 | Household / family members of a person | **New:** `PERSON#<id> / REL#<type>#<otherId>`, written in both directions in one transaction. `Query pkey=PERSON#<id>, begins_with(skey,'REL#')`. | Query | Email-keyed: `USER#<email> / RELATIONSHIP#<email>#<type>` (`relationship-repository.ts:46-60`) | Move into the person partition. The rows come back in the same Query as pattern 1. |
| 7 | Ecclesia by id / name | `pkey`/`skey` GetItem when the key is known. `gsi1`: `gsi1pk=ECCLESIA#<name>` Query by name. | GetItem / Query | **Exists** (`getEcclesiaByName`, `locations.ts:304`) | The key embeds location and name, so there is **no stable short id or slug**. Add an alias item `ECCLESIA_ID#<slug> / ECCLESIA` pointing to the key, or adopt the key pair as the id that posts store. |
| 8 | Ecclesia offices → person | **New:** `Query pkey=ECCLESIA#…, begins_with(skey,'OFFICE#')`, then BatchGet the person CARDs | Query + BatchGet | Copied fields `recordingBrotherName/Email`; 5 of the 12 ecclesias with RB fields carry `recordingBrotherPersonId` | **New OFFICE# reference items.** rb-service is the only writer. |
| 9 | All ecclesias (place picker) | **New sparse entry** on each ECCLESIA item: `gsi2pk=ECCLESIAS` (or `ECCLESIAS#<country>`), `gsi2sk=<country>\|<prov>\|<city>#<name>`. Filter by country or province with `begins_with`. | Query | **Scan**: `locations.ts:346` (`getAllEcclesiasWithCache`), `:403` (by country), `:465` (`getAllEcclesia`) | Replace all three. Cache the result: a small, slow-changing set. |
| 10 | Render a post's smart references | `BatchGetItem` over `PERSON#<id> / CARD` and the ECCLESIA keys (≤100 keys per call) | BatchGet | **Partial**: there is no CARD. Contact details live on separate PHONE#/EMAIL# items. | **New `CARD` projection item** per person: display name, primary email, primary phone, privacy flags. One BatchGet renders every reference in a post. The server-side tier redaction (ADR-0005) runs on the result. |
| 11 | Offices held by a person (sign-in RB check, permissions) | `Query pkey=PERSON#<id>, begins_with(skey,'OFFICE#')` | Query | **Scan**: `getEcclesiaByRecordingBrotherEmail` (`locations.ts:680-684`), called from auth (`auth.ts:134,256,341`) | Inverse OFFICE# items (pattern 8) |
| 12 | Inter-ecclesia reps | Query on the `OFFICE#REP` references (pattern 8), or a sparse `gsi4pk=OFFICE#REP` | Query | **Scan**: `listInterEcclesiaReps` (repo :1146-1151) | An office reference, same as RB |
| 13 | Person by Google id | sparse `gsi1pk=GOOGLE#<id>` on PROFILE | Query | **Scan**: `getByGoogleId` (repo :1382-1388; unused) | Add only if needed; otherwise delete |
| 14 | Counts | `Select: COUNT` on pattern 4, or a counter item | Query | **Scan**: `count` (repo :1047-1052) | Replace |

**Built in #275 (Phase 2 step 0).** Code: `packages/app/provider/dynamodb/people-index/` (`keys.ts` derives, `projections.ts` writes, `reader.ts` reads). Rebuild: `scripts/rebuild-people-projections.ts` (dry run by default).

| Pattern | Item / index entry | Writer |
|---|---|---|
| 3 typeahead | `PERSON#<id> / NAMETOK#<token>`, gsi3 `NAMEPFX#ALL#<2 letters>` / `<token>#<id>` | `personRepository` |
| 4 everyone / by ecclesia, 10 BatchGet | `PERSON#<id> / CARD`, gsi4 `PEOPLE#ALL`, gsi2 `ECCPEOPLE#<ecclesiaId>` (both `<last>#<first>#<id>`) | `personRepository` |
| 7 stable id, 9 all ecclesias | `ECCLESIA_ID#<ecclesiaId> / ECCLESIA` (points at the ECCLESIA key), gsi2 `ECCLESIAS` / `<country>\|<prov>\|<city>#<name>`; RB-email sign-in entry on gsi1 `RBEMAIL#<addr>` | `locations.ts` |
| 8/12 offices of an ecclesia | **source** item `ECCLESIA_ID#<id> / OFFICE#<role>`: `Query pkey, begins_with(skey,'OFFICE#')` | `officeRepository` |
| 11 offices held by a person | sparse gsi1 on the office item: `OFFICEHOLDER#<personId>` / `OFFICE#<ecclesiaId>#<role>` | `officeRepository` |
| office inbox → office (sign-in, sends) | sparse gsi3 on the office item: `OFFICEMAIL#<addr>` | `officeRepository` |

The ecclesia id is the slug of the name at creation, stored as `ecclesiaId` and carried across renames. Readers switch only once the backfill marker `PEOPLE_INDEX#META / BUILD` exists; the sign-in RB check also needs the `people_index_signin` flag, and then looks up the Recording Brother office's inbox first and the legacy `recordingBrotherEmail` (indexed on the alias, gsi1 `RBEMAIL#`) second, until offices are migrated. Offices are source data: the backfill never writes or deletes an OFFICE# item. `count` and `getByGoogleId` (patterns 13, 14) had no callers and were deleted.

**What the current key design cannot serve without new items:**
- name typeahead on a prefix of either name (pattern 3)
- offices → person, and person → offices (patterns 8, 11, 12)
- listing all ecclesias (pattern 9)
- a single-call post render (pattern 10, no CARD)
- a stable ecclesia id (pattern 7)
- person-keyed family links (pattern 6)

All of these can be served by overloading the existing GSIs with sparse entries or adding items in the source partitions. None needs a new GSI.

## 8. Projections and their writers

A projection is rebuilt from its source object and is **never written independently**. Each projection has exactly one writer:

| Projection | Derived from | Only writer | Rebuild |
|---|---|---|---|
| `gsi1`/`gsi2`/`gsi3` key attributes on person items, NAMETOK# items, the CARD item | PersonRecord | `personRepository` (every mutating method updates them in the same `TransactWriteItems`) | `scripts/rebuild-person-projections` (to write): reads PERSON# partitions only |
| REL# inverse rows | the forward REL# row | the `personRepository` relationship methods (transaction writes both directions) | from the forward rows |
| ECCLESIA directory entry (pattern 9), ECCLESIA_ID# alias | ECCLESIA item | `locations.ts` create/update (to become an ecclesia repository) | from ECCLESIA items |
| OFFICE# references (both directions) | the owner's or RB's office assignment | `rb-service` (and a future office service) | from the ECCLESIA side |
| ECCLESIA `recordingBrotherName/Email` (until deleted) | OFFICE# + Person | `rb-service` only. `admin/ecclesias/route.ts:118-119` must stop writing them. | from OFFICE# |
| SES `TEEAdmin` contacts and topics | PersonRecord EMAIL# + `SUB#` subscriptions | the `cron/sync-ses-contacts` projection (plus a synchronous push after a preference write) | full rebuild from pattern 5, **after a backup** (CLAUDE.md SES warning) |
| `/api/people` cache | pattern 4 | in-memory cache filled by the people route | invalidated by **`personRepository` writes**, not per route. Moving `invalidatePeopleCache` (`apps/next/app/api/people/cache.ts:39`) behind the repository closes the class of bug in #238. |
| `SEND#…/RECIPIENT#…`, `EXHORTER_HEADSUP#` | send events | the send path | an event log. Never read back as a people source. |

## 9. Cost at scale (on-demand, ca-central-1)

**Today:**
- Table: about 2.2 MB, 8,160 items, 180 people, about 40 ecclesias.
- Size: 63% of items are `SEND#…/RECIPIENT#` send logs, about 450 B each.
- Typical item sizes: PROFILE about 0.5–0.8 KB, EMAIL# about 0.5 KB, PHONE# about 0.4 KB.

**Cost model:**
- An eventually consistent read costs 0.5 RRU per 4 KB. A write costs 1 WRU per 1 KB, **for the base item and for each GSI it projects into**.
- Indicative prices: about $0.28 per million RRU and about $1.40 per million WRU. Check current pricing.

**Read cost per page, in RRU.** "Cold" means a cache miss.

| Page / operation | Today: Scan | 10× (about 1,800 people, 400 ecclesias, 22 MB) | 100× (about 18,000 people, 4,000 ecclesias, 220 MB) | With the §7 patterns |
|---|---|---|---|---|
| `/api/people` cold load: `listAll` + `getAllPhonesByPerson`, two full Scans | about 540 | about 5,400 | about 54,000 (about $0.015 per load). It grows with **send history**, not people. | One ecclesia of about 100 people: one gsi2 Query of the item collection, about 120 KB ≈ **15 RRU** at any scale |
| Place picker: ecclesia Scan | about 270 | about 2,700 | about 27,000 | pattern 9 Query: 40 → 4,000 items × about 0.5 KB ≈ 3–250 RRU, cached |
| Sign-in | GSI1 Query + GetItem, about 1 RRU | 1 | 1 | **plus** pattern 11 Query (≈0.5) instead of the RB Scan (about 270 → 27,000 per sign-in today) |
| Post render with 5 smart references | — | — | — | one BatchGet of 5 CARDs + 1 ecclesia ≈ **3 RRU** |
| Typeahead keystroke | — | — | — | one gsi3 Query of ≤20 small token items ≈ **0.5–1 RRU** |
| Audience for a send (about 150 → 15,000 subscribers) | SES ListContacts (no DynamoDB) | — | — | pattern 5 Query: about 0.3 KB × N ≈ 12 → 1,200 RRU per send |

**Choices that keep it cheap:**
1. **No Scans on request paths.** At 100×, each remaining Scan costs as much as about 2,000 Query-backed page loads, and the cost keeps rising with every newsletter sent.
2. **ProjectionType.** The existing GSIs are `ALL`, so every PROFILE write costs about 4× (base + gsi1 + gsi2 + gsi3).
   - Do not add a GSI. Overload the existing ones with **sparse**, small items (NAMETOK#, OFFICE#, the directory entry), so the extra write cost is tiny and only the items that need indexing pay it.
   - If a GSI is ever rebuilt, use `INCLUDE` with the display fields, or `KEYS_ONLY`, plus a BatchGet of CARDs.
3. **BatchGetItem for rendering.** The CARD item makes a post's references one round trip of ≤100 keys, instead of one Query per person.
4. **Caching tied to writes.** The people cache, the ecclesia list and CARDs are invalidated by the source repository's write path (#238), so caches can be long-lived without going stale.
5. **Keep send logs out of people reads.** `SEND#/RECIPIENT#` already carries a TTL. Because person reads use keyed patterns, log growth never touches people cost.
6. **Write volume stays small.** People change rarely. A full projection rebuild at 100× (18,000 people × about 6 items × about 4 index writes) costs about 430,000 WRU, roughly $0.60 per rebuild.
