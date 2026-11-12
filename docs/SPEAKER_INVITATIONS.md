# Speaker Invitations — Requirements

**Status:** DRAFT v2, awaiting owner approval · **Branch:** `feat/speaker-invitations`
**Rule:** build to this doc and stop. Anything found outside it goes on the *Not now* line.

## 1. What it is

A Recording Brother or Rep of an ecclesia (or the owner) sends one person
**"An invitation to {exhort at the Memorial | lead Bible Class | give a Lecture} at {Ecclesia}"**.
It offers **1–3 dates**, and the speaker accepts one by clicking it. After
accepting they get a confirmation email with **Add to Google Calendar** and
**.ics (Apple/Outlook)**, plus "If for any reason you need to change your
appointment, click here". That link opens a page where they can **pick a
different date, swap with another speaker, or cancel**.

## 2. Who

| Actor | Can |
|---|---|
| **Inviter**: Recording Brother **of X** or Rep **of X**, or owner | Create/send invites **for X only**; see status; cancel |
| **Invitee**: any person with an email (member, or visiting speaker from another ecclesia) | Their own invite only: view, accept, change, swap, cancel |

- **Own ecclesia only.** An RB or Rep can never invite for another ecclesia.
  The composer's ecclesia is fixed to the inviter's own, and only the owner
  picks an ecclesia. The API re-checks this server-side.
- **Admins and recorders are not inviters.** This needs a new, narrower gate
  `canSendSpeakerInvite(person, role, ecclesia)` = owner OR
  (`person.ecclesia === ecclesia` AND (`isRecordingBrother` OR `role === 'rep'`)).
  The broader `checkEcclesiaEditPermission` is not reused.

## 3. Invite types

| Type | Schedule it fills | Slot field | Open-date scanning |
|---|---|---|---|
| `memorial` | `memorial` | `Exhort` | Yes |
| `bible_class` | `bibleClass` | `Speaker` | Yes |
| `lecture` | none yet (no lecture `ScheduleTypeKey`) | n/a | **No.** Inviter types each date + time. The booking lives on the invite only; no swap |

The type is stored as data, so when lecture rosters exist (#110 Slice D) lectures
pick up scanning and swaps through the same code.

## 4. "Is a meeting planned, and is the slot open?" — one function

`getSlots(ecclesia, type, from, to)` is used by the composer, "View other open
dates", the change page and swap. Each date gets a state:

| State | Rule |
|---|---|
| `NO_MEETING` | no schedule row; or override `cancelled`; or `noServiceAtHall` / `detectSpecialOccasion` |
| `OPEN` | meeting planned, and the slot field (after merging the roster overlay) is blank or a placeholder (`isPlaceholderName`) |
| `FILLED` | meeting planned, slot has a name. Carries `personId` when the name resolves (overlay `roleFieldRefs`, else name resolver #109) |

Reads use `getSchedulesByEcclesiaAndDateRange` (GSI1, one ecclesia) and
`applyOverrideToProgramItem`. There is no full-partition read. Non-open
dates are shown and labelled, never hidden (ADR-0005).

## 5. Data (`tee-admin`, `pkey/skey`)

```
SPEAKER_INVITE#{inviteId} / META
  ecclesia, type, status: sent|accepted|cancelled|expired
  inviterPersonId, inviteePersonId, inviteeEmail
  offeredDates[1..3]: {date, time, tz}, otherDatesWindow?: {from, to}
  acceptedDate?, note?, history[]: {at, action, byPersonId, trust, from?, to?, note?}
SPEAKER_BOOKING#{ecclesia}#{type} / {date}  → {inviteId, personId}   (one per slot)
SPEAKER_SWAP#{swapId} / META → requester booking, target booking, status, expiresAt
```

- **No holds. First to accept wins.** The same date may be offered to several
  people. Accept = a conditional put of the booking (`attribute_not_exists`)
  plus a re-check that the merged slot is still `OPEN`, then the roster overlay is
  written: `serviceOverrideRepository.upsert` with `roleFields.{Exhort|Speaker}` =
  name and `roleFieldRefs` = personId, for the **invite's** ecclesia. The loser
  sees "That date was just taken" and the remaining open dates.
- **Change date** = one DynamoDB transaction: release the old booking and overlay, take the new ones.
- **Cancel** = release the booking and clear the overlay field (only if it still names this person).
- **The Google Sheet is never written** (#110 decision). The overlay wins at read
  time. The inviter notice reminds the RB to update the Sheet if they keep one.
- The invitee is always a PersonRecord: chosen with the existing picker, or name +
  email, which creates a visitor record. No people data comes from Sheets or DIRECTORY#MEMBERS.

## 6. Identity & security — reuse the assurance ladder (Epic #80)

The email link carries the invitee's existing **ecclesia token** plus the invite
id: `/invite/{inviteId}?token=…`. `getTrust()` resolves it:

| Visitor arrives as | Result |
|---|---|
| Already signed in (Google / OTP / password) **as the invitee** | `authenticated` and continues; stays signed in |
| Not signed in, valid token for the invitee | `recognized` as themselves |
| Signed in as **someone else** | "This invitation is for {first name}." Offer to switch account; no actions |
| No or invalid token, not signed in | Sign-in prompt (OTP / Google); the invite resumes after sign-in |

**What each tier may do.** This is a deliberate, narrow exception to the
"recognized = no mutations that matter" rule. It only covers the invitee's own
booking, it's reversible, and the inviter is notified of every action:

| Action | Minimum |
|---|---|
| View invite, accept, change own date, cancel own booking | `recognized` + identity == invitee |
| **Request a swap** (moves another person's booking) | `authenticated`. Step-up uses the existing short-lived OTP, or skips it when already Google/OTP-signed-in |
| **Respond to a swap request** (it's your own booking) | `recognized` + identity == that speaker |

Also:
- **GET never mutates.** Every action is a POST from a button, so email link-scanners can't accept.
- Every action is logged in `history` with the trust tier it was made at.
- Invitees see other slots' dates only. For `FILLED` dates, the other speaker's
  name follows the normal per-tier redaction (first name at `recognized`).

## 7. Swap with another speaker

1. On the change page (memorial / bible class only), the speaker picks a
   `FILLED` date in the window whose speaker resolves to a person **with an email**.
   A filled date without a reachable person is shown as "Filled. Contact
   {inviter} to arrange", and not just hidden.
2. Step-up to `authenticated` if needed, add an optional note, and send.
3. The other speaker gets a **swap request** email with their own token link:
   "{Name} asks to trade {their date} for your {date}". Accept / Decline (POST).
4. **Accept** = one transaction that swaps both bookings and both overlay
   fields, conditioned on both still being as they were when requested. Both get
   fresh confirmations (+ .ics updates) and the inviter is notified.
5. Decline or expiry (7 days, or the day before the earlier date) changes nothing,
   and the requester is told. Only one open swap request per booking at a time.
6. The RB is notified but **not** asked to approve.

## 8. Emails (templates in `apps/email-builder/emails/`)

1. **Invitation**: type at ecclesia, up to 3 date buttons (each opens the page
   with that date selected, then Confirm), an optional note, optional "View other
   open dates", and the inviter's sign-off. Canonical brand sender; Reply-To = inviter.
2. **Confirmation**: date, time, timezone, hall name + full address, the online
   option if any, **Add to Google Calendar**, **Download .ics** (hosted, generated
   live, stable `UID` so updates replace the earlier entry), and the "need to
   change" link. Re-sent on change or swap. Cancel sends the `METHOD:CANCEL` .ics.
3. **Swap request** to the other speaker (§7).
4. **Inviter notice**: accepted / changed / swap done / cancelled.

Sending follows the exhorter heads-up pattern: an idempotency claim, SES
`tee-email-tracking`, recipient snapshot. Test sends go to the user's own address only.

## 9. Screens (feature screens in `packages/app/features/speaker-invites/`, mounted from `page.tsx`, ADR-0003)

- **Composer** `/admin/speaker-invites/new`: type, invitee picker, ≤3 dates
  from `getSlots` (lecture: manual date+time), toggle + window for other open
  dates, note, preview, test-send to self, Send.
- **Invites list** `/admin/speaker-invites`: status, history, cancel, resend.
- **Invitee page** `/invite/{inviteId}`: offered dates → Accept, plus other open
  dates if enabled. After acceptance it's the manage view: change date / swap / cancel.
- **Swap response page** `/invite/swap/{swapId}`.

Everything sits behind a new `SPEAKER_INVITES` feature flag.

## 10. Acceptance criteria

1. Only the owner, or the RB/Rep **of X**, can create an invite for X. An RB of Y gets 403 for X, and so does an admin of X (tests).
2. The composer only offers `OPEN` dates. `FILLED` and `NO_MEETING` dates are shown and labelled.
3. Opening a date link changes nothing until Confirm (POST) is pressed.
4. Two people accepting the same slot: exactly one wins. The other sees "just taken" plus the remaining options (test).
5. After accept, the public schedule and the newsletter's upcoming program show the speaker on that date.
6. Arriving already signed in as the invitee needs no extra step. Arriving signed in as someone else blocks all actions. A token alone allows accept/change/cancel. A token alone cannot request a swap until step-up.
7. The Google link and the .ics open the correct date, time, timezone and address in Google Calendar and Apple Calendar. Change and cancel update or remove the same entry.
8. A swap accepted by the other speaker exchanges both dates atomically. Both get new confirmations and the inviter is notified. If either booking changed in the meantime, the swap fails cleanly.
9. Expired, cancelled or unknown links show a clear page with the inviter's contact, never an error.
10. Lecture invites work end-to-end with manually entered dates.
11. `yarn lint`, typecheck, build and unit tests are green. The whole path is verified in prod behind the flag **with the owner's own record as invitee** (never a real member). The swap is verified by unit tests and a read-only prod check.

## 11. Out of scope (*Not now*)

- Organizations inviting speakers to studies (later extension of §2).
- Writing back to Google Sheets.
- Automated reminders (exhorter heads-up Slice B).
- Theme / readings / hymns request email.
- A lecture schedule type, and swaps for lectures (#110 Slice D).
- The .ics as an email attachment (needs raw-MIME SES). A hosted .ics link ships instead.
- Inviting presiders, readers, organists or other roles.
- Mobile (Expo) screens.

## 12. Definition of done

Merged in **one PR**, deployed, flag on for TEE, criteria 1–11 verified,
issue closed, nothing half-built behind the flag.
