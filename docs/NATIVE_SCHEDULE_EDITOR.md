# Schedule Editor — Requirements

**Status:** DRAFT for owner approval · **Issue:** #110 · **Branch:** `docs/native-schedule-editor`
**Rule:** build to this doc and stop. Anything found while building goes on the **Next** list (§11) with its issue and when. Nothing is "out of scope".

## 1. What it is

Each ecclesia's Recording Brother or Rep edits their own schedules (Memorial, Bible Class, Sunday School, CYC and their own programs) **right in TEE Admin / Echad Hub**, in a grid that feels like Google Sheets and looks like TEE. It is not a form.

- One row per meeting date. Dates come from the service's cadence (weekly by default), so nobody types dates.
- Cells know what they hold: a **person** is a chip you pick, a **hymn** is a number, **lunch** is a toggle, a **place** is an ecclesia or an address.
- Speaker invitations (#324) appear in the same grid: an empty speaker cell can invite someone, and accepted, pending and cancelled invitations show up in their cells by themselves.
- This works for **every ecclesia the same way**, including schedules that come from a Google Sheet. For those, a cell edited here wins over the sheet. The sheet is never written to.

## 2. Who

| Person | Can |
|---|---|
| Recording Brother **of X** or Rep **of X** | Edit X's schedules only |
| Owner | Edit any ecclesia's schedules; pick the ecclesia |
| Everyone else | Read-only, as today (Schedules page, newsletter), with the existing name rules for signed-out readers |

- The gate is the same narrow rule speaker invitations use: owner, OR (same ecclesia AND (Recording Brother OR Rep)). Admins and recorders don't get it automatically.
- The server checks it on every save; the screen hiding buttons is not the check.

## 3. The grid

**Look:** TEE brand colours and typography; the date column is pinned on the left and the header row is pinned on top; past weeks are dimmed above "today", and the grid opens scrolled to the coming Sunday (or the next meeting).

**Keyboard, like Sheets:**
- Arrow keys move between cells. Tab and Shift+Tab move across. Enter edits, and Enter again saves and moves down. Esc cancels.
- Start typing on a cell to replace what's in it. Delete clears it.
- Copy and paste a block of cells, within the grid or **from a Google Sheet or Excel**. Pasted names are matched to people (§4); names that don't match are flagged, never dropped.
- Undo and Redo (Cmd/Ctrl+Z) for your own recent edits.

**Mouse and touch:** click a cell to select it, double-click to edit, and drag the corner to fill down (e.g. Lunch "yes" for four weeks).

**Rows** (owner, 2026-11-28):
- **How far ahead:** a "Show" menu offers **3, 6, 9 … up to 24 months** ahead, in 3-month steps. The default is **6 months**, and the editor's choice is remembered on their device. 4 weeks of past meetings show above, and you can scroll further back.
- Within that window, every cadence date is a row (the **sequential** rows).
- A date with nothing entered is a greyed row marked "Coming soon", the same rule as the Schedules page (#344).
- **Add a date** for an extra meeting (e.g. a special Sunday-afternoon Memorial) or a **one-off booking years ahead**, such as a speaker reserved for a special occasion. Any date can be added, with no upper limit.
- **Booked further ahead:** every stored entry dated after the end of the sequential rows is listed below them, in date order. These are the far-future one-offs.
  - They're styled differently so they stand out: a different background colour and a thicker separator above the section and between entries.
  - They're edited exactly like any other row.
  - When the window is widened to cover one of them, it moves up into its place among the sequential rows.
- **No meeting this week** marks a date as cancelled, with an optional note ("Christmas break"). This uses the existing occurrence-override "cancelled" state, so the Schedules page, newsletter and heads-up already understand it.

**Columns:**
- The ecclesia's chosen fields for that schedule type, in their saved order (`scheduleConfig`). Labels are the ecclesia's own.
- The RB/Rep can show or hide columns and drag to reorder them. This uses the existing per-ecclesia field selection, now from the grid's header menu.

**Saving:**
- Each cell saves on its own as soon as you leave it, with a small "Saved" tick. There is no Save button and nothing to lose by closing the tab.
- **Two people editing at once:** every cell save is a conditional write. If someone else changed that cell since you loaded it, your edit is not applied silently. The cell shows "Changed by {name} just now: {their value}. Keep theirs / Use mine".

## 4. Cell types

Every catalogue field gets a type. The type decides the editor, the check, and how the value is shown.

| Type | Editor | Stored | Shown |
|---|---|---|---|
| **person** | Type a name and pick from people (the existing resolver-backed picker). Can add a visiting brother from another ecclesia (name + ecclesia, optional email). | name **and** personId (`roleFieldRefs`) | Chip with the person's name. A name that matches no one, or more than one person, shows amber "Not matched", which you click to resolve. |
| **place** | Pick an ecclesia (hall address comes from the directory) or type an address. | ecclesiaId, or free text | Ecclesia name, or the address |
| **text** | Small inline Tiptap editor (bold, italic and links only) | text | As written |
| **passage** | Text with a Bible-reference check ("Rom 8:1-17") | text | As written |
| **hymn** | Numbers only, with an optional suffix ("123a") | text | "Hymn 123" |
| **yes/no** | Toggle | true/false | ✓ or blank |
| **link** | URL; checked to be http(s) | text | Link icon + host ("youtube.com") |
| **meeting** | Zoom/Meet/Teams link, plus optional meeting ID and passcode | object | "Join on Zoom" |

**Fields per schedule type.** The catalogue (`schedule-fields.ts`) stays the one list. This adds a type to each field, plus the fields the owner asked for that don't exist yet (**new**):

- **Memorial:** Exhort (person), Preside (person), **Reader 1 and Reader 2** (person; these are the existing `Reading1` / `Reading2` keys, which already hold the brother who reads, now labelled "Reader"), **Reading 1 and Reading 2** (passage, new keys `Passage1` / `Passage2`, owner 2026-11-28), Organist, Steward, Doorkeeper, Collection (person), the four hymns (hymn), Lunch (yes/no), Activities (text), YouTube (link), **Location** (place, new; blank means the usual hall), **Meeting connection** (meeting, new).
- **Bible Class:** Presider and Speaker (person), Topic (text), Host (place; today it's plain text), **Meeting connection** (meeting; replaces the separate ZoomURL / MeetingID / MeetingPwd).
- **Sunday School:** Refreshments (text), Holidays and Special Events (text). Words like "No Sunday School" or "Christmas break" keep meaning "no class" (the forgiving rule from #345).
- **CYC:** Location (place), Speaker (person), Topic (text).

New fields get **new stable keys**; existing keys never change, so the sheet sync, newsletter, heads-up and YouTube sync keep working.

## 5. Where edits are stored (one place per schedule)

Each schedule already has a source in the registry: `native` (entered in TEE Admin) or `google-sheets`. **One function, `setScheduleCell(ecclesia, scheduleId, date, field, value, expectedVersion)`, does every write**: the grid's edits, invitation accepts, changes and cancels, and paste.

| Schedule source | Where a cell edit goes |
|---|---|
| `native` | The schedule row itself, in `tee-schedules`, in the per-ecclesia shape. This is the only copy. |
| `google-sheets` | The existing roster overlay (`serviceOverrideRepository`, `roleFields` / `roleFieldRefs`), which wins over the sheet at read time. The sheet is never written to. |

- Speaker invitations switch to `setScheduleCell` in this change (today they write the overlay directly). That way a native schedule never has a second copy of who's speaking.
- Readers (Schedules page, newsletter, heads-up, slot scanning for invitations) keep reading through the existing merge. They don't need to know which source a value came from.
- A native schedule's row is created the first time any cell on that date is filled. "Coming soon" rows are not stored.

## 6. Speaker invitations in the grid

The invitation programs (#331) already link each program to a schedule and a role field (e.g. Memorial → Exhort). For those cells:

| Cell state | Shown | Action |
|---|---|---|
| Empty, meeting planned | Blank, plus a faint "Invite…" on hover/focus | Opens the invitation composer with this date already ticked |
| Invitation sent, not accepted | Grey "Invited: {name}" chip (more than one name if several were invited) | Click: see the invitation, resend, or withdraw |
| Accepted | The speaker's person chip with a small ✓ | Click: open the booking (change date / cancel, as the inviter) |
| Filled by hand | Person chip | Normal edit. Typing over an accepted booking asks "This releases {name}'s accepted invitation. Continue?" and, if yes, cancels it the same way the change page does. |

- Accept, change, swap and cancel already write the slot; with §5 they go through `setScheduleCell`, so the grid always matches.
- Slot scanning (`getSlots`) is unchanged: an "Open" slot is one the grid shows as empty on a planned date.

## 7. Screens and code layout

- **Route:** `/admin/schedules/[scheduleId]` (RB/Rep/owner). It's linked from the schedule registry page and from each ecclesia's page ("Edit schedule").
- **Feature screen:** `packages/app/features/schedule-editor/`, mounted from `page.tsx` (ADR-0003).
- **The grid:** built with **TanStack Table** (headless) and styled with our own components.
  - The grid itself is web-only, so it sits behind a render slot, per ADR-0003. Mobile gets a read-only list now (§11).
  - The cell editors are TEE components: the person picker, a Tiptap inline editor for text, and Tamagui inputs.
- **API:** `GET /api/schedules/[scheduleId]/grid?from&to` returns the merged rows, the column definitions, cell versions and invitation states. `PATCH /api/schedules/[scheduleId]/cells` takes one or more cell writes (paste = many); each write is checked independently and reported per cell.
- **Brand system:** the grid and every cell type get an entry in `/brand/components`.
- **Feature flag:** the grid ships behind a flag so it can be checked in production on one ecclesia first.

## 8. Data rules

- No PII in the repo, and tests use made-up people only.
- People are always PersonRecords. A visiting brother typed in creates a visitor record (the existing resolver path), never a free-floating name.
- No scans. Rows come from the schedule's own partition by date range. Invitation states come from `SPEAKER_BOOKING#…` / `SPEAKER_INVITE#…` by ecclesia and date.
- Every write records who and when (`updatedBy`, `updatedAt`) on the cell, which also drives "Changed by {name}" (§3).

## 9. Acceptance criteria

1. A Recording Brother of X opens X's Memorial schedule and sees every cadence date from 4 weeks back to 6 months ahead. Empty dates appear greyed as "Coming soon". "Show" offers 3 to 24 months in 3-month steps, and the choice is remembered.
1a. Adding a one-off date 3 years ahead and filling the Exhort cell saves it. The entry appears under "Booked further ahead", below the sequential rows, in the distinct style, and moves into the sequential rows when the window covers it.
2. They can't open or save another ecclesia's schedule (the server returns 403); the owner can.
3. Typing a name in Exhort and picking a person saves name + personId. The Schedules page and the next newsletter show it.
4. An unmatched pasted name shows "Not matched" and can be resolved in two clicks.
5. Hymn rejects letters other than one suffix letter; Lunch toggles; the YouTube link must be http(s).
6. Pasting a 4×3 block from a Google Sheet fills those 12 cells, with a per-cell result.
7. Two browsers edit the same cell. The second save shows "Changed by {name}" and doesn't overwrite.
8. Empty Exhort, then "Invite…": the composer opens with that date ticked. After the speaker accepts, the cell shows their chip with ✓, without a reload beyond reopening the grid.
9. Typing over an accepted booking asks first, then cancels the booking. The speaker gets the existing cancellation email.
10. On a `google-sheets` schedule, an edit here wins over the sheet after the next sync, and the sheet is untouched.
11. On a `native` schedule, there is exactly one stored copy of each value (no overlay rows written).
12. "No meeting this week" with a note shows as cancelled on the Schedules page and in the newsletter.
13. Keyboard only: arrows, Tab, Enter, Esc, typing, Delete and Undo all work as in §3.
14. Works on a phone-width browser (horizontal scroll inside the grid only, date column pinned).

## 10. Owner decisions (2026-11-28)

1. **Readings:** both. **Reader** is a person and **Reading** is the passage, one pair for each of the two readings (§4).
2. **How far ahead:** 3 to 24 months in 3-month steps, default 6. Far-future one-offs are listed under "Booked further ahead" (§3).

## 11. Next (known follow-ons, each with its issue and when)

| What | Issue | When |
|---|---|---|
| Toronto East on the same storage format as every other ecclesia | #346 | **Before** this ships to Toronto East (Toronto East's Memorial uses the overlay path until then, which works) |
| Sheet-backed schedules check for changes every 5 minutes (instead of nightly) | #328 | Alongside #346 |
| Connect a sheet by signing in to Google or Microsoft, instead of sharing it with the service account | #328 | After this |
| Ecclesias add their own schedule types (e.g. Special Lecture), so lecture invitations can scan for open dates | #110 (Slice D) | Right after this merges |
| Editing on the mobile app (Expo) | #110 | After the web grid has been used for a month |
| Live co-editing with everyone's cursor visible (Yjs / Hocuspocus, notes in #328) | #328 | After this, if two people editing at once turns out to be common |
| Optional write-back to the ecclesia's Google Sheet | #328 | After the 5-minute sync |
| Public Schedules page gets the same table component (sorting, filters) | #11 | After this, reusing the grid |

## 12. Definition of done

Merged, deployed behind the flag, acceptance criteria 1, 1a and 2–14 checked in production on the test ecclesia (using test sign-in on staging first), the flag turned on for Toronto East and one other ecclesia, #110 updated, and this doc's status set to DONE.
