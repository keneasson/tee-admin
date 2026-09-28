# ADR-0005: Never silently withhold — identified readers see it, everyone else is told how

- **Status:** Accepted
- **Date:** 2026-09-28

## Context
On the weekend of 2026-09-26 a general event ("Shelburne Reception for Gord and
Jessica") asked newsletter readers to register by emailing Jessica. Readers who
clicked through saw "send an email", but the email line itself was gone, with
nothing telling them that signing in would bring it back. Three things combined:

1. Email links carried no identity, so every reader arrived **anonymous**
   (`/api/events/public` called `resolveViewer()` without a token).
2. The reveal gate needed `authenticated` + member, so a recognized email
   reader was treated like a stranger.
3. **The first-name floor was not applied to the contact.** The rule since
   2026-07-10 is that an unidentified reader still gets the safe part: the
   first name. Applied here, it would have read "Please email Jessica", which is
   imperfect but usable. Instead the redactor deleted `registration.contactEmail`
   outright (a bare string, with no name to fall back to), and the view
   rendered `contactEmail ? … : null`, so the line vanished without a word.
   That's a broken implementation, not a rule that needed replacing.

The owner reviewed the flow while signed in as owner, saw everything, and only
learned about it from member complaints. Silent redaction can't be seen by the
people who have the access to review it.

## Decision
1. **The first-name floor stands, and it is never empty.** An unidentified
   reader always gets the safe fallback (the first name), followed by
   **"Sign in to view contact details"**. A contact must never be stored in a
   shape that has no safe fallback (e.g. a bare email with no name).
2. **Email-link readers are in the full tier** (owner decision, 2026-09-28).
   `canRevealPii` is true for `recognized` (arrived via a tokenized email link)
   *and* `authenticated`. A web page must never show an email reader less than
   the email that sent them there. This changes who is in the full tier. The
   floor for everyone else is unchanged.
3. **Recognition grants sight, never authority.** A recognized viewer's role
   stays capped at member (`effectiveRole`), and every mutation still requires
   `authenticated` (step-up / Verify). The recognition cookie is read only by
   `resolveViewer` (read-side redaction), never by an authorization guard.
4. **Email links carry recognition.** The bulk send stamps a per-recipient
   `?rt=` token on every first-party link. Middleware moves it into the
   httpOnly `tee_rt` cookie and redirects to the clean URL, and `resolveViewer`
   verifies it on every read.
5. **Redactors report what they withheld.** `redactEventForViewer` and
   `redactPost` set `withheld: WithheldKind[]`, noting a class only when data of
   that class was actually removed.
6. **Views never hide silently.** Wherever a redactable field renders:
   `full ? <Full/> : <SafeFallback/> + <SignInPrompt/>`,
   plus one `WithheldBanner` at the top with a **Sign in** button that returns
   to the same page. `auth && <Text/>` alone is forbidden for PII.

## Consequences
- A forwarded newsletter lets whoever it's forwarded to see the PII the email
  itself already contained, for up to 30 days (token validity). We accept this
  because the email body already carries the same data. They still can't
  change anything.
- Every PII-bearing read must go through a redactor that reports `withheld`. A
  new surface that drops fields without reporting them violates this ADR.
- Reviewing a page as owner is not a privacy review. Check the anonymous view
  (private window) or rely on the banner.
- **Strict enforcement belongs in the new editor's smart fields.** A contact is
  a person (first name + gated email/phone), so the field always has two
  renderings: full, or "Please email Jessica — Sign in to view contact
  details". Legacy events store a bare email and can only show the generic
  prompt; the banner and inline prompt in this change are the stopgap there.
- Follow-ups not covered by this change: news items and schedules (first-name
  floor) don't report `withheld` yet; `membersOnly` events are gated only on
  the client; a post the viewer can't reach returns 404 instead of "sign in".

## References
- Issue #252 (incident + fix), Epic #84 (assurance ladder), ADR-0002
- `packages/app/utils/viewer-pii.ts` (`canRevealPii`, `Withheld`)
- `packages/app/utils/redact-event.ts`, `packages/app/utils/redact-post.ts`
- `packages/ui/src/privacy/withheld-notice.tsx`
- `apps/next/utils/recognition-cookie.ts`, `apps/next/middleware.ts`,
  `apps/next/utils/resolve-viewer.ts`, `apps/next/utils/email/utm-links.ts`
