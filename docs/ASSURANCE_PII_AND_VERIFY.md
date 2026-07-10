# Assurance, Deep-Linking, Verify & Server-Side PII Redaction

**Status:** design / spec · **Owner:** Ken · **Depends on:** #80 assurance levels (merged), #82 recognized view gate (open)

One coherent model ties together three things we've been building piecemeal:
email deep-links, step-up auth, and how much of a person we reveal. They are all
governed by the **same assurance ladder**.

## 1. The assurance ladder

| Tier | How you get it | What it grants |
|------|----------------|----------------|
| `anonymous` | nothing | public content, **first-name-only** PII |
| `recognized` | a valid `?token=` from an email we sent | **view** anything an email links to (incl. deep-linked sensitive *views*); still **first-name-only** PII of others |
| `authenticated` | a fresh, cookie-bound credential (password / Google / OTP) | **act** on sensitive things; **full-name** PII (subject to role/privacy) |

Source of truth already exists: `apps/next/utils/auth-trust.ts`
(`Trust`, `getTrust()`, `meetsAssurance()`, `authTime`). `recognized` comes from
`verifyEcclesiaToken()`; a bearer token can raise you to `recognized` but **never**
to `authenticated`.

## 2. Deep-linking (the promise)

Every email link may carry the full token and drop the reader **exactly where it
points** — their preferences, a "more details" page, an RSVP, a role page — with
**no login wall**. Stance: *"for now, we assume you're the person we emailed."*
You can read. The wall appears only when you try to **do** something sensitive.

- **View gate** — `apps/next/middleware.ts`. A `?token=` (or session) is
  `recognized` and passes. (**Slice A / PR #82**, merged-pending.)
- **Edge caveat (deliberate):** middleware can't reach DynamoDB, so it treats
  token *presence* as recognized for the **view gate only**. Pages/APIs
  re-validate via `getTrust()` before exposing real data. Middleware is a UX
  gate; **`getTrust()` is the authoritative boundary.**

## 3. Verify (step-up `recognized → authenticated`)

Triggered at the **moment of a sensitive action or page**, not at the door. A
reusable flow that offers whichever proof is fastest for *this* user:

1. **Google re-auth** — if already signed in with Google, near-invisible. (shortcut)
2. **Password** — re-enter it.
3. **OTP** — code to the **on-file address** (the address we emailed).

Success stamps a fresh `authTime` and elevates the session to `authenticated` for
a freshness window (`meetsAssurance` + `authTime` already model this). OTP-to-the-
emailed-address is also the **forward-safety** guarantee: a forwarded link can
*view*, but only the true owner receives the code, so a forwarder can never *act*.

`/email-preferences` already implements an inline OTP step-up — this generalizes
that one-off into a reusable `<Verify>` component + `requireAuthenticated()` guard
that any sensitive page (middleware) or action (API via `getTrust`) can demand.

## 4. Server-side PII redaction (NON-NEGOTIABLE)

Tier also governs **how much of a person renders**:

| Viewer tier | Renders as |
|-------------|-----------|
| anonymous / guest / `recognized` | **first name only** — "Peter" |
| `authenticated` member+ | **full name** — "Peter Skariah" |

- **Sanitation happens on the server.** The public render/response emits **only**
  the first name — never full names hidden by CSS/JS (a View-Source leak). Public
  API returns `{ firstName }`; authenticated returns `{ firstName, lastName }`.
  Same class of failure as the topic-filter incident — compute the safe shape
  **once, server-side.**
- **Non-distinguishability is a feature.** Two "Peter"s both render "Peter" — no
  last initial, no "Peter S.", no hover-reveal. Signing in is what collapses the
  ambiguity.
- **Extends, not replaces, the existing privacy system.** Per-field visibility
  already lives in `privacy-repository.ts` (`VisibilityLevel`, `showName`, …).
  "first-name-only floor" is the **bottom rung** of that ladder; role/privacy
  overrides reveal more on top. A name is a field whose floor is
  `first @ anonymous, full @ authenticated-member+`.
- **Redaction points (audit + fix each):** `apps/next/app/api/events/public`,
  `.../events/feed`, the newsletter render path
  (`apps/next/utils/email/get-email-content.tsx` + `apps/email-builder/emails/*`),
  any `/api/people*`, schedules, and event/news bodies that interpolate names.

## 5. Open decisions (proposed defaults — confirm)

1. **What unlocks the full name?** → **Proposed: `authenticated` AND role ≥ member.**
   "Signing in" is the trigger, but a signed-in *guest* is still a stranger, so
   gate on member+ so a fresh random account can't harvest the directory.
2. **Does first-name-only apply to the emailed newsletter, or only the web view?**
   The web newsletter (anonymous) is clearly first-name-only. But the *email* goes
   to subscribers who are only `recognized` (token, not login) — so by the rule the
   **emailed** newsletter would also render first-name-only. **This is a change
   from today's full-names-to-the-list behavior → needs explicit sign-off.**
   Proposed: **email = recognized = first-name-only**, matching the web, for
   consistency and least-surprise privacy.

## 6. Slice breakdown (issues)

- **A — Recognized view gate** (PR #82, done/in-review): token → recognized in
  middleware; deep-links resolve instead of dead-ending.
- **B — Reusable Verify step-up**: `<Verify>` + `requireAuthenticated()`; methods
  password / Google-reauth / OTP; freshness window; return-to. Generalize the
  `/email-preferences` inline flow.
- **C — Middleware step-up routing**: sensitive *pages* route a `recognized` user
  into Verify (not generic sign-in); sensitive *actions* enforce via `getTrust`.
- **D — Server-side PII redaction primitive**: one `renderName(person, trust)` /
  response-shaping helper; public API + render paths emit first-name-only by
  default; unit tests assert no last name in anonymous responses.
- **E — Apply D to the newsletter + events**: audit each redaction point in §4;
  decide email-channel behavior (Decision 2).

Slices land in order A → B → C → D → E; D can proceed in parallel with B/C.
