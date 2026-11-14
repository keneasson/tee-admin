# Behaviour spec: Ecclesia schedules

> **What this is.** What must happen when an ecclesia connects its own schedule
> sheet, when it syncs, and what must never change for Toronto East. Design:
> [ECCLESIA_SCHEDULES.md](../ECCLESIA_SCHEDULES.md). How specs work:
> [ADR-0007](../adr/0007-behavior-specs.md).
>
> **Status key:** ✅ Implemented (test cited) · ⚠️ Partial · ❌ Gap (issue) ·
> ⏸ Deferred · 🔷 Decision needed
>
> **Last reviewed:** 2026-11-13 · Refs #328

## Principles
1. **Rows of other ecclesias never reach Toronto East's partitions** (`SCHEDULE#<TYPE>`).
2. **Toronto East's newsletter path does not change.** Its rows are still written by the sheet webhook through `SheetTransformer`.
3. **We only read.** The service account has `spreadsheets.readonly`; nothing is written back to a sheet.
4. **One sheet belongs to one ecclesia.** A sheet another ecclesia has connected cannot be connected again.

## Scenarios

| ID | Scenario | Status |
|---|---|---|
| ECSCHED-01 | Toronto East's webhook writes exactly the same items as before (PK/SK/GSI1, raw headers and cell types, dateTime, YouTube kept). The catalogue mapping cannot reproduce them byte for byte, so the webhook is not routed through `envSource`. | ✅ `schedule-sources-golden.test.ts` |
| ECSCHED-02 | A pasted Google Sheets link (or bare ID) gives the spreadsheet ID; anything else is refused with a plain message. | ✅ `schedule-sources-adapters.test.ts` |
| ECSCHED-03 | Connect checks we can open the sheet, claims it for the ecclesia and lists its tabs with their header rows. | ✅ `schedule-sources-adapters.test.ts`, `ecclesia-schedules-routes.test.ts` |
| ECSCHED-04 | A sheet not shared with us answers 409 `NOT_SHARED` with the address to share with; nothing is claimed or written. A sheet that stops being shared fails its sync, writes nothing and shows the error as the last sync. | ✅ `schedule-sources-adapters.test.ts`, `schedule-sources-sync.test.ts`, `ecclesia-schedules-routes.test.ts` |
| ECSCHED-05 | Tabs are listed with their first row as headers; blank header cells are dropped. | ✅ `schedule-sources-adapters.test.ts` |
| ECSCHED-06 | Sync maps each mapped column to its catalogue key, adds `Date`, drops unmapped columns, skips rows without a date, and stamps a stable per-schedule `sheetId` (switching sheets replaces the old rows). | ✅ `schedule-sources-sync.test.ts` |
| ECSCHED-07 | Other ecclesias' synced rows carry the mapped time (HH:mm when readable, else 09:00) and no `dateTime` / `sourceTimezone`; Toronto East's service times are never applied to them. Speaker slots fall back to the ecclesia's own configured time. | ✅ `schedule-sources-sync.test.ts` |
| ECSCHED-08 | Preview (`?dryRun=1`) returns the first 5 mapped rows of a draft or stored schedule and writes nothing (no rows, no last-sync). | ✅ `schedule-sources-sync.test.ts`, `ecclesia-schedules-routes.test.ts` |
| ECSCHED-09 | A sheet in Toronto East's site configuration is refused by connect (before contacting Google) and by sync. | ✅ `schedule-sources-sync.test.ts`, `ecclesia-schedules-routes.test.ts` |
| ECSCHED-10 | Site-configured (`env`) and `native` schedules are skipped by sync; the home ecclesia never syncs a connected sheet. | ✅ `schedule-sources-sync.test.ts` |
| ECSCHED-11 | A read with no dated rows writes nothing: an empty read never empties a schedule. | ✅ `schedule-sources-sync.test.ts` |
| ECSCHED-12 | Synced rows land in the ecclesia's own partition `SCHEDULE#{ecclesiaId}#{kind}` with GSI1 `ECCLESIA#{name}`, so they appear in `/api/ecclesia/[name]/schedule` and speaker slots; nothing touches `SCHEDULE#<TYPE>`. | ✅ `schedule-sources-sync.test.ts`, `ecclesia-schedules-routes.test.ts` |
| ECSCHED-13 | Every `/api/ecclesia-schedules` route is gated by `canManageEcclesiaSchedules`: another ecclesia's Recording Brother, an admin or a plain member gets 403 and nothing is read or written. | ✅ `ecclesia-schedules-routes.test.ts` |
| ECSCHED-14 | The Recording Brother or a Rep manages their own ecclesia; the owner may pick any ecclesia. The list carries the service-account address to share with. | ✅ `ecclesia-schedules-routes.test.ts` |
| ECSCHED-15 | Toronto East's schedules show as "Site configuration" with no sheet ID; only their "names a person" toggles can change (the source stays `env`); it cannot connect a sheet. | ✅ `ecclesia-schedules-routes.test.ts` |
| ECSCHED-16 | A sheet claimed by another ecclesia cannot be connected (409 `CLAIMED`) or saved. | ✅ `ecclesia-schedules-routes.test.ts` |
| ECSCHED-17 | Saving a schedule checks each mapped field is a catalogue field of that kind, once; the entry records the ecclesia name, who saved it and when. | ✅ `ecclesia-schedules-routes.test.ts` |
| ECSCHED-18 | The nightly cron needs the bearer secret; it syncs only active Google Sheets schedules, found by one Query; one failing sheet does not stop the others. | ✅ `cron-schedule-sources.test.ts` |
| ECSCHED-19 | The nightly cron runs on a schedule in production. | ❌ Owner step: scheduler entry (`EXTERNAL_CHANGES.md`) |
| ECSCHED-20 | Connect with Google sign-in (Picker) or Microsoft 365 instead of sharing. | ⏸ Deferred (ECCLESIA_SCHEDULES.md §10) |
