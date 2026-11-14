# Ecclesia schedules — each ecclesia's own schedules

**Status: APPROVED 2026-11-13** (owner request: "the schedule needs to be first for it to put the invites in"). Refs #328.
Speaker invitation programs (docs/SPEAKER_INVITATIONS.md §3a) read this registry to know which schedule and which column an invitation fills.

## 1. Why

Every ecclesia's schedule rows were stored in one shared partition per type (`tee-schedules` `PK SCHEDULE#<TYPE>`). Toronto East's newsletter, public `/schedule`, exhorter heads-up and YouTube sync read that whole partition with no ecclesia filter. A manual row entered for another ecclesia through `POST /api/ecclesia/[name]/schedule` on the same date (index 0) overwrote Toronto East's row, and `DELETE` built `SCHEDULE#<TYPE>` by hand, so it could delete Toronto East's row.

**Rule: rows of other ecclesias never reach the legacy partitions.**

## 2. Scope this round

- Kinds stay the four catalogue keys `memorial | bibleClass | sundaySchool | cyc` (`packages/app/config/schedule-fields.ts`, the single `ScheduleTypeKey`).
- At most one schedule per kind per ecclesia (`scheduleId` = kind). Row `type`, service overrides, `merge.ts` and the public tabs are all keyed by kind.

## 3. Storage (`tee-schedules`)

One function decides the partition: `schedulePartitionFor(ecclesia, kind)` in `schedule-repository.ts`.

| Ecclesia | PK | Pattern |
|---|---|---|
| Home (`HOME_ECCLESIA.isHomeEcclesia`) | `SCHEDULE#<TYPE>` (legacy, unchanged) | `schedulesByType` |
| Any other | `SCHEDULE#{ecclesiaId}#{kind}` | `schedulesBySource` |

SK stays `DATE#<iso>#<index>`. GSI1 is unchanged (`ECCLESIA#<name> / <date>#<type>#<time>`), so `getSchedulesByEcclesiaAndDateRange`, speaker slots and roster overlays work as before for every ecclesia.

`ecclesiaId` for schedules is `scheduleEcclesiaId(name)`: the slug of the home-normalized ecclesia name. It is pure, so every writer and reader derives the same id from the `ecclesia` stored on a row.

Every writer goes through it: `createScheduleRecord`, `replaceSheetSchedules` (reads and writes one ecclesia's partition; refuses mixed input), `getScheduleEvent` / `updateScheduleData` / `deleteScheduleEvent`, and the route's `DELETE`.
`ScheduleService.getScheduleData` (newsletter and friends) is not touched.

## 4. Registry (`tee-admin`)

```
ECCLESIA_SCHEDULES#{ecclesiaId} / SCHEDULE#{scheduleId}          pattern scheduleRegistryByEcclesia
  name, kind, active,
  source:  {kind: 'google-sheets'|'native'|'env', spreadsheetId?, tab?, envKey?}
  mapping: {dateColumn, timeColumn?, fields: [{column, key, label, rosterRole}]}
  lastSync?: {at, status, rows, error?}, updatedBy, updatedAt
  gsi4pk SCHEDULE_SOURCES / gsi4sk {ecclesiaId}#{scheduleId}     pattern scheduleSourcesAll (nightly sync)

SCHEDULE_SHEET_CLAIM#{spreadsheetId} / CLAIM → {ecclesiaId, scheduleId, claimedAt}
  conditional put: one sheet → one ecclesia (re-claim by the same ecclesia is allowed)
```

Writer: `packages/app/provider/dynamodb/repositories/schedule-registry-repository.ts`. Reads are Queries of registered patterns; never a Scan.

A connect must refuse spreadsheet IDs used by Toronto East's site configuration (`envSpreadsheetIds()`).

### Toronto East: migrated with no database write

`getScheduleRegistry(ecclesia)` (`packages/app/provider/schedule-sources/registry.ts`) returns the stored entries. For the home ecclesia, each kind configured in `GOOGLE_SERVICE_ACCOUNT_KEY` → `sheet_ids` that has no stored entry gets a built-in entry derived at read time:

- source `{kind: 'env', envKey: <kind>}`; the sheet ID stays in the env and is never in the repo, the database or the entry
- legacy partition; mapping `dateColumn: 'Date'`, one field per catalogue field
- roster roles: memorial `Exhort, Preside, Reading1, Reading2`; bibleClass `Presider, Speaker`; cyc `speaker`
- `builtIn: true` (never stored)

A stored entry for a kind (e.g. edited roster-role toggles) replaces only that kind's built-in entry. Without the env var there are no built-ins and nothing throws. A non-home ecclesia with nothing stored has `[]`.

The webhook, `get_google_sheet` and `getScheduleData` stay byte-identical.

## 5. Sources and mapping

`packages/app/provider/schedule-sources/`:

```ts
type ScheduleSource<C> = {
  kind: SourceKind
  connect(ecclesiaId: string, input: ConnectInput): Promise<Connection<C>>
  listTables(c: Connection<C>): Promise<TableRef[]>
  readRows(c: Connection<C>, t: TableRef): Promise<RawRow[]>
}
const toScheduleRows = (entry: RegistryEntry, ecclesia: string) => (rows: RawRow[]): ScheduleRowInput[]  // pure
```

`toScheduleRows`: date from `dateColumn` (rows without a parseable date are skipped); time from `timeColumn`, else `09:00`; data keyed by **catalogue key** for each mapped, non-empty column, plus `Date` holding the source cell; unmapped columns dropped.

Adapters: `googleSheetsSource` (service-account JWT, scope `spreadsheets.readonly`); `envSource` (Toronto East: reads `sheet_ids` through the existing `GoogleSheetsService`); `nativeSource` (no rows; sync skips). `ConnectInput = {mode: 'service-account-share', spreadsheetId}` now; `{mode: 'oauth'}` / `{mode: 'graph'}` later, same shape.
Sync = `readRows → toScheduleRows → scheduleRepo.replaceSheetSchedules`, which puts rows in the ecclesia's own partition.

First connection mode: the ecclesia shares its sheet with our service-account address. No external setup.

## 6. Gate

`canManageEcclesiaSchedules` (`apps/next/utils/ecclesia-schedule-permissions.ts`) is the speaker-invite rule `canSendSpeakerInvite`: the owner, or the Recording Brother / Rep of their own ecclesia. Same function, so the two never drift.

## 7. API and screen

- `GET /api/ecclesia-schedules`: registry plus `serviceAccountEmail`
- `PUT /api/ecclesia-schedules/[scheduleId]`
- `POST /api/ecclesia-schedules/connect {sheetUrl}`: verify access, claim, list tabs and header row; 409 `NOT_SHARED` with the email to share with
- `POST /api/ecclesia-schedules/[scheduleId]/sync?dryRun=1`: first 5 mapped rows, no write; `POST …/sync` writes
- `GET /api/cron/schedule-sources`: nightly, active google-sheets entries via the `scheduleSourcesAll` Query; env entries skipped (the webhook covers them)

Screen `/admin/ecclesia-schedules` (`packages/app/features/ecclesia-schedules/registry-screen.tsx`): list; add = paste link → share instruction → pick tab → map columns (date, time, each column → catalogue field + "names a person" toggle) → preview → Save & sync. Toronto East entries show source "Site configuration" and only their roster-role toggles are editable.

## 8. Delivery

1. **Foundation** (`feat/schedule-registry-foundation`): partition fix, single `ScheduleTypeKey`, registry types / mapping / read, registry repository, access patterns, gate, this spec. No UI.
2. **Sources** (`feat/ecclesia-schedule-sources`): adapters, sync, API, cron, screen, behaviour scenarios `docs/behavior/ecclesia-schedules.md` (ECSCHED-01..n).

## 9. Definition of done

- Another ecclesia connects a shared sheet; its rows appear in its own `/api/ecclesia/[name]/schedule` and in speaker slots.
- Toronto East's newsletter, `/schedule` and exhorter heads-up are unchanged (golden tests).
- Other ecclesias' manual writes land in their own partition.
- Behaviour scenarios cited by tests; lint, typecheck and build clean with dummy env.

## 10. Not now

OAuth / Picker / Microsoft Graph and token storage; write-back; custom kinds or several schedules per kind; moving any existing non-home rows out of the legacy partitions (owner script after a read-only check); public tabs for other ecclesias' sources.

Owner-only steps: the cron entry for `/api/cron/schedule-sources` (flag in `EXTERNAL_CHANGES.md`); a read-only production check for non-home rows in `SCHEDULE#<TYPE>` partitions.
