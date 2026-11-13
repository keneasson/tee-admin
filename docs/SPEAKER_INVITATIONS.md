# Speaker Invitations — Requirements

**Status:** APPROVED 2026-11-12 · **Branch:** `feat/speaker-invitations`
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
| Signed in as **someone else** (partner, forwarded email, shared device) | The other session is **signed out** and the token is exchanged for a `recognized` session as the invitee (existing `/auth/signin-token` path). Same rights as the row above |
| No or invalid token, not signed in | Sign-in prompt (OTP / Google); the invite resumes after sign-in |

The header always names who the page is acting as: **"Invitation for Brother {Surname}. (Not Brother {Surname}? Sign in again)"**. That link signs out and runs the normal sign-in flow, returning to the invite.

**What each tier may do.** This is a deliberate, narrow exception to the
"recognized = no mutations that matter" rule. It only covers the invitee's own
booking, it's reversible, and the inviter is notified of accept, change and cancel:

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
   fresh confirmations (+ .ics updates).
5. Decline or expiry (7 days, or the **start time** of the earlier appointment)
   changes nothing, and the requester is told. Only one open swap request per
   booking at a time. Last-minute swaps are allowed. They happen.
6. **Short-notice note.** When a swap is accepted within **24 hours** of either
   appointment, the swap page and both confirmation emails show:
   **"Please inform the {counterpart} of this change"**, where the counterpart
   is derived from the swapped role: Exhort → the **Presiding** brother (named
   from that date's schedule when known, with per-tier redaction), Preside →
   the **Exhorting** brother, Bible Class Speaker → the **Host**. Roles with
   no counterpart get no note.
7. The RB is **neither asked nor notified**. The change shows up in the newsletter and in later emails.

## 8. Emails (templates in `apps/email-builder/emails/`)

1. **Invitation**: type at ecclesia, up to 3 date buttons (each opens the page
   with that date selected, then Confirm), an optional note, optional "View other
   open dates", and the inviter's sign-off. Canonical brand sender; Reply-To = inviter.
2. **Confirmation**: date, time, timezone, hall name + full address, the online
   option if any, **Add to Google Calendar**, **Download .ics** (hosted, generated
   live, stable `UID` so updates replace the earlier entry), and the "need to
   change" link. Re-sent on change or swap. Cancel sends the `METHOD:CANCEL` .ics.
3. **Swap request** to the other speaker (§7).
4. **Inviter notice**: accepted / changed / cancelled (swaps send no notice).

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

No feature flag (owner decision): the feature is limited to RB/Rep/owner senders and invite-link holders, and those gates are the control.

## 9a. Choosing the invitee (owner feedback, 2026-11-12)

One field: **"Start typing a name"**, with directory autocomplete across all
ecclesias (`GET /api/speaker-invites/candidates`, grouped per §9b). Each result
shows name + ecclesia. Results show names and ecclesia only, never contact
details. The last row is always **"＋ {typed} isn't listed, add them"**.

**Add them** opens the form with the typed name filled in. Two words fill
first + last name; one word fills the first name. The fields are:
1. **Email first.** When the email is entered, it is looked up
   (`GET /api/speaker-invites/lookup-email`, inviter-gated, returns
   `{personId, displayName, ecclesia}` or nothing, never contact details):
   - It matches someone: "This email belongs to **{Name}** ({Ecclesia}). Is that who you mean?"
     - **Yes** switches the invite to that person. No new record is created.
     - **No, someone else uses this address** (a household): the form continues,
       and notes: "They'll share this address with {Name}. When they sign in,
       they'll be asked which of them they are." Shared household addresses are a
       supported, trusted model (#267, R2): the new person **joins the address**
       the same way `scripts/join-shared-household-email.ts` joins one, with an
       EMAIL# row marked `loginExcluded`. It is their primary when it is the
       existing holder's primary, otherwise a secondary (a second PROFILE on a
       secondary address would take over `getByEmail`). So the existing holder
       still signs in by default, `peopleWhoCanUse` lists both, and sign-in asks
       "Are you A or B?" (`/auth/who`). No privacy settings are written for the
       address (they are keyed by address and belong to the existing holder).
       The invitation is sent to the shared address (`invite.inviteeEmail`), and
       the invite carries a **follow-up flag** `{kind: 'shared-email', withPersonId}`.
       On the invite pages, **anyone who can use `invite.inviteeEmail`** counts as
       the invitee; `history.byPersonId` records the session's chosen person.
   - No match: the form continues, and the new person gets this email.
2. First name, last name.
3. **Brother / Sister** and **Baptized? Yes / No (optional)** (+ optional baptism date), per §9b.
4. **Home ecclesia: autocomplete** over the ecclesia list. If exactly one
   ecclesia matches ("Mississ" → Mississauga West), it is filled in and can be
   accepted with one tap or Enter. Several matches ("Toronto") are listed to
   pick from. No match offers "Use '{typed}' (not in our list)". The owner's
   ecclesia selector uses the same component.

**Who created them.** New people are made by ONE shared helper
`createVisitorPerson()`, which the visiting-speaker schedule import also uses.
It sets `memberStatus: 'visitor'` and the same visitor privacy defaults; the
role is passed explicitly (`'guest'` for the schedule import, `'member'` for an
invitation, §9b). Provenance is `source: 'speaker-invitation'`,
`sourceRef: 'speaker-invite:{inviteId}'` and **`createdByPersonId`** = the inviter.

**Follow-up.** A flagged invite shows a "Needs follow-up: shares an email with
{Name}" badge in the invites list, to its inviter and the owner, with a
**Mark resolved** button that records who resolved it and when.

The picker's "Unlink" is not used here. Changing the pick is "Change".

## 9b. Only brethren are invited to speak (owner decision, 2026-11-12)

In this community only **brethren (baptized males)** exhort, lead Bible Class or
lecture. Both facts are **recorded, never inferred**: there is no backfill, and
nothing derives them from names, role, roster history or anything else
("getting it wrong is worse than not getting it").

**Fields** (PersonRecord, additive, unset = unknown): `gender?: 'male' | 'female'`,
`genderSetByPersonId?`, `genderSetAt?`, `baptized?: boolean`, `baptismDate?`
(YYYY-MM-DD, optional), `baptizedSetByPersonId?`, `baptizedSetAt?`.

**Role and baptism are independent by design.** Role = how the ecclesia treats
someone (access); `baptized` = a recorded fact, used only where it matters (the
speaker picker). Unbaptized people aligned with an ecclesia (a member's spouse,
a regular attendee) are treated as members without being baptized. Never derive
one from the other.

**One predicate**, `isInvitableSpeaker(p) = p.baptized !== false && p.gender !== 'female'`
(`packages/app/utils/speaker-eligibility.ts`). The picker shows only people who
pass it, in two groups:
- **Brethren**: `baptized === true && gender === 'male'`.
- **"Not yet confirmed as a baptized brother"**: everyone else who passes (either
  fact unset), each with a one-tap **"Confirm: baptized brother"** and an in-page
  confirm ("Confirm {Name} as a baptized brother? This is shown wherever titles
  are used."). `POST /api/speaker-invites/confirm-brother {personId}`
  (`canSendSpeakerInvite` callers) sets **only the unset facts** (gender='male'
  and/or baptized=true), never overwrites, records set-by/at, and answers 409
  when either is already recorded to the contrary. The person is then selected.

The server also refuses (`NOT_INVITABLE`) an invite to anyone the predicate rejects.

**"Add them" form.** Brother / Sister is required (no default). Baptized?
Yes / No, optional (left blank = unrecorded), plus an optional baptism date.
- Brother + Yes → invited; recorded `gender: 'male'`, `baptized: true`.
- Brother + baptism left blank → invited; `baptized` stays unset (they appear in the second group later).
- Brother + No → explained (only baptized brethren are invited to speak); not sent.
- Sister → explained (this list is for inviting brethren); not sent.

Every invite-created person gets `role: 'member'` (the inviting RB/Rep vouches
they are aligned with an ecclesia), regardless of baptism, with
`memberStatus: 'visitor'`. The facts record the inviter as set-by.

**Titles.** "Brother {Surname}" / "Sister {Surname}" only when BOTH facts are
recorded: `baptized === true` and a gender (`titleFor`). An unbaptized person,
or anyone with either fact unset, is addressed by first name. Servers send the
computed title to pages, never the raw gender. This covers `brotherName()`, the swap page, the "(Not … ? Sign in
again)" link and the speaker-invite email greetings ("Dear Brother {Surname},"
/ "Dear {first name},").

**Editing.** The person on their own profile, and the admin person-edit form
(same permission as its other fields), show "Brother / Sister / Not set" and
"Baptized: Yes / No / Not set" + an optional baptism date, recording set-by/at.

## 10. Acceptance criteria

1. Only the owner, or the RB/Rep **of X**, can create an invite for X. An RB of Y gets 403 for X, and so does an admin of X (tests).
2. The composer only offers `OPEN` dates. `FILLED` and `NO_MEETING` dates are shown and labelled.
3. Opening a date link changes nothing until Confirm (POST) is pressed.
4. Two people accepting the same slot: exactly one wins. The other sees "just taken" plus the remaining options (test).
5. After accept, the public schedule and the newsletter's upcoming program show the speaker on that date.
6. Arriving already signed in as the invitee needs no extra step. Arriving signed in as someone else signs that session out, continues as the invitee at `recognized`, and shows "Not Brother X? Sign in again". A token alone allows accept/change/cancel. A token alone cannot request a swap until step-up.
7. The Google link and the .ics open the correct date, time, timezone and address in Google Calendar and Apple Calendar. Change and cancel update or remove the same entry.
8. A swap accepted by the other speaker exchanges both dates atomically. A swap within 24h shows the "Please inform the Presiding/Exhorting brother" note. Both get new confirmations. The inviter gets no notice. If either booking changed in the meantime, the swap fails cleanly.
9. Expired, cancelled or unknown links show a clear page with the inviter's contact, never an error.
10. Lecture invites work end-to-end with manually entered dates.
12. Typing a name finds directory people across ecclesias; "add them" pre-fills the name; an email already in the directory offers that person; "no, someone else" adds them to the shared household address (the existing holder's sign-in unchanged, both offered at sign-in), still emails the shared address, and shows the follow-up badge; home ecclesia autocompletes; new people record source, invite and inviter.
13. The picker shows only `isInvitableSpeaker` people, confirmed brethren first; "Confirm: baptized brother" sets only unset facts and never overwrites; a Sister or a "No, not baptized" is not sent; titles need recorded baptism AND gender.
11. `yarn lint`, typecheck, build and unit tests are green. The whole path is verified in prod **with the owner's own record as invitee** (never a real member). The swap is verified by unit tests and a read-only prod check.

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

Merged in **one PR**, deployed, criteria 1–11 verified,
issue closed, nothing half-built left in place.
