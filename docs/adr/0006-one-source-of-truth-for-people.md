# ADR-0006: One source of truth for people (PersonRecords)

- **Status:** Proposed (draft for owner review)
- **Date:** 2026-10-17

## Context
The PersonRecord migration was declared "100% done" (`UNIFIED_PEOPLE_AUTH=true`), but it only ever finished the first step: copying data into PersonRecords. Readers were never moved off the old stores, and neither the old code nor the old data was deleted. Eight months later, people data still lives in several places:

- `tee-schedules` `DIRECTORY#MEMBERS`: 143 rows. The Email Lists page still builds its "people" from these rows (#267).
- Legacy `USER#…` items in `tee-admin`: 57 partitions. Password sign-in, registration and reset still read and write these. Privacy settings, family relationships, connections and edit requests are keyed by **email** in this store.
- SES contact-list `AttributesData`, used as a name and ecclesia store.
- The Google Sheets "directory" tab. Three live code paths still try to read it, and every attempt fails silently.
- Committed JSON/CSV subscriber files (#78).
- Denormalized copies: the Recording Brother name and email on `ECCLESIA#…` items, nominee snapshots, and event registration contacts.

Every extra store has produced the same class of bug:
- A household's address and home phone sat under one spouse's name in the legacy directory, while the PersonRecord belonged to the other spouse (#267).
- An edit made in one store was silently reverted by a sync from another.
- An email change orphaned every row keyed by the old address.

The 2026-10-17 read-only audit found 17 people who exist only in legacy rows, 33 nameless PersonRecords, and 28 SES contacts subscribed to topics that no PersonRecord holds. A "one-way sync" from a legacy store does not make it a projection. If a store can be edited independently, it is a second source.

## Decision
1. **PersonRecords are the only source of truth for people.** That means the `tee-admin` partitions `PERSON#<uuid>`, each holding one `PROFILE` item and N `EMAIL#` / `PHONE#` / `ADDRESS#` / … items, looked up through GSI1. Every fact about a person is written there first: name, emails, phones, addresses, ecclesia, role, family links, privacy, preferences and subscriptions.
2. **Anything else is a projection.** A projection is derived *only* from PersonRecords, can be rebuilt from them at any time, and is **never edited independently**. Examples: the people cache, an SES contact list, a search index, and an ECCLESIA "Recording Brother" display field. A write that changes a projection without changing the PersonRecord first is a bug. A projection must record the `personId` it came from.
3. **No new readers of legacy stores.** New code may not read or write the following:
   - `DIRECTORY#MEMBERS`
   - `USER#<email>` or `USER#<uuid>` people data
   - SES `AttributesData` as a source of names or ecclesias
   - a Google Sheet as a source of member data
   - the committed subscriber files

   Review rejects them. Existing readers are tracked in `docs/legacy-people-retirement-plan.md` and only ever shrink.
4. **People are keyed by `personId`, never by email.** Any per-person record must live under `PERSON#<id>`. This covers privacy, relationships, connections, edit and contact requests, preferences, nominations and event contacts. An email is an attribute of a person and can change. It is not an identity.
5. **"Migration done" has one definition.** All four of the following must be true:
   1. **Data reconciled:** every legacy row was matched to a person, copied, or explicitly dropped, and the owner approved it.
   2. **Readers moved:** no code path reads the old store (grep-verified).
   3. **Old code deleted:** the routes, repositories, screens and scripts are gone.
   4. **Old data deleted:** this happens after a final backup to the private `tee-admin-backups` bucket.

   A migration that stops after step 1 is **not done**, and must not be reported as done.

## Consequences
- The legacy-directory screens are deleted, not ported: Email Lists' merge/migrate actions and Directory Email Sync. Email Lists is rebuilt on PersonRecords, with SES topics and suppression layered on as read-only status.
- Password sign-in, registration and reset move to the PersonRecord methods that already exist: `getCredentialsForVerification`, `createFromCredentials` and `updatePassword`. This is the riskiest step and needs its own verification.
- SES becomes a pure projection. Subscription changes are written to the PersonRecord, and the sync cron pushes them to SES. Direct SES-only writes (public subscribe, Email Lists edits, consolidate) are removed. Today the cron reverts those writes anyway.
- Family links, privacy and the other email-keyed records need new `PERSON#` sub-items and a one-time move. That is planned work, not a side effect.
- Short-term cost: several screens lose features until they are rebuilt. The owner prefers that to keeping a second source alive.
- Household modelling (a shared address held by two people) stays a PersonRecord concern (#267, #268). It is not a reason to keep a legacy household row.

## References
- Epic #270. Background: #267, #20, #129, #238, #77, #78, #268
- `docs/legacy-people-retirement-plan.md`: store and code inventory, phased plan, risks and verification
- ADR-0001 (tenancy) and ADR-0005 (smart-component contract): both assume one person object
- CLAUDE.md: "NEVER source people data from DIRECTORY#MEMBERS or Google Sheets"
