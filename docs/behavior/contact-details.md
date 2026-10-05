# Behaviour spec: Contact details

> **What this is.** The expected behaviour for seeing, editing, correcting,
> suggesting, confirming and requesting a person's contact details (name,
> email, phone, address). It is the reference any change in this area is
> checked against. See [ADR-0006](../adr/0006-behavior-specs.md) for how specs
> work.
>
> **Status key:** ✅ Implemented (test cited) · ⚠️ Partial · ❌ Gap (issue) ·
> ⏸ Deferred · 🔷 Decision needed
>
> **Last reviewed:** 2026-10-05 · **Owner-confirmed rules:** marked *(owner)*

## Principles
1. **It's never about hiding information; it's about making it easy for the
   right people to reach what they're entitled to.** *(owner)*
2. **Each person decides who sees each of their own details.** *(owner)*
3. **Nothing is ever just missing.** A detail you can't see is replaced by
   the way to get it: *Sign in*, or *Ask {first name}*. Never an empty slot.
   ([ADR-0005](../adr/0005-never-silently-withhold.md))
4. **Fixing a mistake takes one step** for someone with the right to fix it.
   *(owner)*
5. **A suggestion always reaches someone who can act on it.**

## Who's who
| Term | Means |
|---|---|
| **Registered user** | Anyone with an account, **guests included**. *(owner)* |
| **Verified member** | A **member of any ecclesia**. *(owner)* |
| **Editor** of a person | Owner/admin (anyone but themselves), or the RB/Rep/recorder of that person's ecclesia. |
| **Contact** | Someone the person has connected with. |

## 1. Who can see a detail — `CONTACT-SEE`
Each field (phone, email, address, …) is set by the person to one **rung** on
one ladder, loosest → strictest *(owner)*:

**registered user → verified member → my region → my ecclesia → my contacts → only by request ("ask me")**

| ID | Scenario | Status |
|---|---|---|
| SEE-01 | The owner sees every field of everyone. | ✅ `privacy-defaults.test` (owner path) |
| SEE-02 | Admin/RB/Rep/recorder see every field of people in **their own** ecclesia, whatever the settings. | ✅ `privacy-defaults.test` "the elevated roles keep seeing…" |
| SEE-03 | A person who never set privacy gets **my ecclesia** on every field. | ✅ `privacy-defaults.test` "is ecclesia-visible on every field" |
| SEE-04 | Rung **registered user**: anyone signed in, guests included. | ✅ `privacy-repository.test` (`authenticated`) |
| SEE-05 | Rung **verified member**: any member of any ecclesia; guests excluded. | ❌ #259 |
| SEE-06 | Rung **my region**. | ⏸ Deferred: ecclesias have no region yet *(owner)* |
| SEE-07 | Rung **my ecclesia**: members of the person's ecclesia, plus their contacts. A **guest** in the same ecclesia sees nothing. | ✅ `privacy-defaults.test` "a GUEST account in the same ecclesia sees nothing" |
| SEE-08 | Rung **my contacts**: only people they've connected with. | ✅ `privacy-repository.test` |
| SEE-09 | Rung **only by request ("ask me")**: nobody sees it without a grant, **but anyone may ask**. It never means unreachable. *(owner)* | ⚠️ #259: stored as `private`; asking exists but is half-built (see `CONTACT-ASK`) |
| SEE-10 | Privacy settings offer exactly these rungs, in this order, with these names. | ❌ #259 |
| SEE-11 | A field the viewer can't see shows **"Ask {first name}"** in its place (or **Sign in** for an anonymous visitor). | ⚠️ #259: shows "Email hidden" with a lock |
| SEE-12 | Default rung for a **visiting speaker** created by the schedule import. | 🔷 #259: their hosts in other ecclesias need to reach them |

## 2. Asking for a hidden detail — `CONTACT-ASK`
Access is granted **by rung, not by field** *(owner)*.

| ID | Scenario | Status |
|---|---|---|
| ASK-01 | Any viewer who can't see a field can ask for it, not only "ask me" fields. | ⚠️ #259: a general request exists, not tied to a field |
| ASK-02 | The person is **told** of each request (email), with one-click **Share** / **Decline**. | ❌ #259: no notification; only visible if they open their profile |
| ASK-03 | **Share** grants the requester the requested field's rung: that field **and every field at the same or a looser rung**. Stricter fields need their own request. *(owner)* | ❌ #259: "responded" only changes a status |
| ASK-04 | Before sharing, the person sees exactly what will be shared ("Approving shares your Address, Phone and Email"). | ❌ #259 |
| ASK-05 | The requester is told the outcome. | ❌ #259 |
| ASK-06 | One grant per (person, requester) = the highest rung granted. Granting a stricter rung raises it; revoking removes it. | ❌ #259 |
| ASK-07 | Requests respect blocks, rate limits and "don't accept contact requests". | ⚠️ in `POST /api/contact-requests`; no route-level test |

**Example** *(owner)*: Phone + Email = verified member; Address = ask me.

| Viewer | Sees, no grant | After an Email request is shared | After an Address request is shared |
|---|---|---|---|
| Member (any ecclesia) | Phone, Email | — | + Address |
| Guest | nothing | Phone + Email | Address + Phone + Email |

## 3. Editing someone else's details — `CONTACT-EDIT`
| ID | Scenario | Status |
|---|---|---|
| EDIT-01 | Owner/admin can edit **anyone** (not themselves), in any ecclesia. | ✅ `profile-canedit-ordering.test`, `admin-people-email-change-route.test` (403 path) |
| EDIT-02 | RB/Rep/recorder can edit people of **their own** ecclesia only. | ✅ `admin-people-email-change-route.test` "403 when the actor cannot edit the target ecclesia" |
| EDIT-03 | A person edits their **own** details on their profile; changing their own sign-in email needs step-up + a code sent to the new address. | ✅ `email-change-logic.test`, `token-repository-email-change.test` |
| EDIT-04 | An editor **corrects any email in one step**: pencil → fix → Save. No verification round-trip. *(owner)* | ✅ #258, `admin-people-email-change-route.test` "correction mode" |
| EDIT-05 | Correcting the **sign-in** email moves sign-in and subscriptions to the corrected address, **removes** the wrong one, and doesn't email it. | ✅ `admin-people-email-change-route.test` "the Jared case"; `person-repository.test` "replace: true…" |
| EDIT-06 | The sign-in email can't be deleted, only corrected (deleting would orphan the login). | ⚠️ UI and route refuse it; no test for the route refusal |
| EDIT-07 | A corrected address that belongs to someone else is refused; nothing is written. | ✅ `admin-people-email-change-route.test` "409…" |
| EDIT-08 | Moving or correcting an email never changes newsletter subscription state. | ✅ `person-repository.test` "…inherits sesSubscribed" |
| EDIT-09 | An editor can make a **verified** secondary the sign-in email in one click. | ✅ `admin-people-email-change-route.test` "promote mode" |
| EDIT-10 | Address/phone edits by an editor take effect directly. | ⚠️ implemented (`/api/people/[email]/contacts`); no direct test |

## 4. Suggesting a correction — `CONTACT-SUGGEST`
For anyone signed in who can **see** a detail but can't **edit** it.

| ID | Scenario | Status |
|---|---|---|
| SUGGEST-01 | A "suggest a correction" action sits beside name, each email, phone and address. | ✅ member page; `coalesce-edit-request-emails.test` |
| SUGGEST-02 | A suggested **address/phone** appears beside the confirmed value, marked not verified, and enters community confirmation (`CONTACT-CONFIRM`). | ✅ `pending-contact-changes.test` |
| SUGGEST-03 | A suggested **name** is applied when approved from the emailed link. | ✅ `approve-edit-request.test` "writes the value…" |
| SUGGEST-04 | A suggested **email** reaches someone who can act on it: the person's **RB/Rep** (owner/admin as fallback), **never only** the address on file, which may be the wrong one. They apply it in one click via the `EDIT-04` correction. | ❌ #261: goes only to the address on file; approving doesn't apply it |
| SUGGEST-05 | No page or email ever claims an action that didn't happen. | ❌ #261: email approval says "passed to your Recording Brother" when nothing was sent. (✅ for other fields: `approve-edit-request.test` "says so plainly…") |
| SUGGEST-06 | Several suggestions for the same person become one notification. | ✅ `coalesce-edit-request-emails.test` |

## 5. Community confirmation — `CONTACT-CONFIRM` (address, phone)
| ID | Scenario | Status |
|---|---|---|
| CONFIRM-01 | A proposed change is verified at confirmation weight ≥ 2: member = 1, RB/Rep = 2, or the person approves it. | ✅ `contact-verification.test` |
| CONFIRM-02 | Only members of the person's ecclesia can confirm; guests and other ecclesias can't. | ✅ `contact-verification.test` |
| CONFIRM-03 | You can't confirm your own record, or confirm twice. | ✅ `contact-verification.test` |
| CONFIRM-04 | Owner/admin/RB/Rep can **Verify** in one click. | ✅ `pending-contact-changes.test` |
| CONFIRM-05 | Progress is shown ("Needs 1 more confirmation"). | ✅ `contact-verification.test` |
| CONFIRM-06 | **Email is not community-confirmed.** It's a sign-in identity; it's corrected by an editor (`EDIT-04`). By design (#245). | ✅ decision |

## 6. Contact details inside posts and events
Governed by [ADR-0005](../adr/0005-never-silently-withhold.md) (smart-component
contract). In short: an identified reader (signed in, or arriving from our
email) sees the full contact; anyone else sees the first name plus "Sign in to
view contact details". A registration contact can't be published without a
first name. Tests: `redact-post.test`, `registration-contact-rule.test`.

## Open gaps (summary)
| Issue | Scenarios |
|---|---|
| #259 Privacy rungs + "ask me" | SEE-05, SEE-09–12, ASK-01–06 |
| #261 Email suggestions dead end | SUGGEST-04, SUGGEST-05 |
| (tests to add) | EDIT-06, EDIT-10, ASK-07 |
