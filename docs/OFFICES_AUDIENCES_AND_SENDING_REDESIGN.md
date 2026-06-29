# Offices, Audiences & Sending — Design Doc

> **Status**: Proposal / north-star (no code committed)
> **Author**: Ken Easson + Claude
> **Date**: 2026-06-28
> **Audience**: Developers (human and AI) working on TEE Admin
> **Purpose**: Define the target model that unifies content (News/Events), email
> audiences, per-recipient personalization, and the per-ecclesia identity/role
> hierarchy — and that retires the standalone "Inter-Ecclesia" admin feature by
> generalizing the one good thing it accidentally got right.

---

## 1. The problem: right idea, built piecemeal

The Inter-Ecclesia email sender is the one place in the app that does identity-aware
sending correctly — it personalizes each email per recipient (one-click login token,
a tokenized "update your ecclesia contact" link) because it sends one email at a
time. Everything *else* is a workaround that doesn't lean on that capability.

The result is a system that feels like many similar pieces with no shared spine:

- **Content is over-split.** News and Events are modeled as different things, and
  Events are further split into hardcoded occasion *types* (`funeral`, `baptism`,
  `wedding`, `engagement`, …). The day you need "wedding shower" you're blocked, and
  meanwhile an engagement is simultaneously an "event" and "news." The occasion is
  being modeled as a *code path* instead of *data*.
- **Audiences are hand-maintained CSVs.** "Inter-ecclesia leaders" exists as an SES
  contact-list topic seeded from a CSV import plus an `isInterEcclesiaRep` boolean
  bolted onto PersonRecords. It drifts from reality the moment a recording brother
  changes.
- **Personalization is gated to one reason.** The per-recipient tokenization only
  fires for `reason === 'inter-ecclesia'`. Every other email forgoes one-click
  login, forward-safety, and per-recipient analytics — even though they're all sent
  one-at-a-time and *could* have it for free.
- **"Role" means two different things.** The access tier (owner/admin/rep/member/
  guest) and the functional office (Recording Brother, Treasurer, …) are smushed
  into one concept, so "rep" ends up meaning three unrelated things at once.

This doc defines the model these pieces *should* share.

---

## 2. Three unifications

### 2.1 Content: News and Events are one thing

There is **one announcement entity** (call it a *post*). Whether it renders
event-shaped (has date/location) or news-shaped (has headline/body) is **data on the
post**, not a separate type. Occasion labels — "wedding," "engagement," "wedding
shower," "baptism" — are **tags/metadata**, not code paths. New occasions become new
data, never new branches.

- An engagement can be *both* an event (it has a date) and news (it's an
  announcement). The model stops forcing the choice.
- "Custom Email" reverts to what it should be: an **emergency / freeform** tool, not
  the place News gets composed because nothing else fits.

> **Wedge**: the first concrete UI is a **Shared sender** inside Email Sender that
> lists both News and Events as selectable content and sends either — without yet
> rewriting the occasion taxonomy.

### 2.2 Audience: derived from the directory, not maintained

An audience is a **saved query over offices** (§3), not a CSV. "Inter-ecclesia
leaders" = *"the contact address of every ecclesia's Recording Brother office."* When
a brother hands off the role, the audience re-resolves automatically — nothing to
re-import. The same machinery yields a Treasurers audience, an Org-contacts audience,
etc., by changing the office *title* in the query.

This retires `isInterEcclesiaRep`, the `import-inter-ecclesia` / `migrate-inter-ecclesia`
routes, and the standalone inter-ecclesia SES seeding.

### 2.3 Personalization: universal, because it already works

Promote the per-recipient substitution out of the `reason === 'inter-ecclesia'`
branch in `email-send.tsx` to the **default send path**. Every email then becomes:

- **One-click into the app, signed in** — the recipient lands authenticated, on the
  content, in the app (richer than the email).
- **Forward-safe** — a forwarded email never carries a live session; the new reader
  is offered a *re-send my own login* flow instead of inheriting someone else's
  access. (People forward emails to people they shouldn't; this neutralizes it and
  gives a far simpler "email me a fresh login" path.)
- **Per-recipient analytics** — individual open/click attribution, which the
  one-at-a-time send already makes possible.

This is mostly *deleting a condition*, not new infrastructure.

---

## 3. The keystone: two axes — Access Tier vs Office

The single biggest cleanup. Today "role" does two unrelated jobs. Split them.

### Axis 1 — Access Tier
A **permission level**: `owner > admin > rep > member > guest`. Answers "can this
person edit content / see admin." This stays, but stops being overloaded.

### Axis 2 — Office
A **position a person holds** within an Ecclesia *or* an Organization. An office is
the source of truth; it **confers** three things, all role-driven and identical in
shape:

1. **Audience membership** — the office is reachable via role-based mailing audiences.
2. **A visibility floor** — the office's contact address is visible to **member and
   above, period** (flat, cultural — the Recording Brother is the point of contact,
   the chief correspondent; this is expected, not a leak). This **overrides** the
   person's normal per-field privacy: you cannot mark your role address private while
   holding a public office. The role wins.
3. **Opt-out policy** — you receive role mail because you hold the office, not because
   you subscribed. Role-conferred audiences have **no opt-out**.

> Holding certain offices can *grant* an access tier (assisting the Recording Brother
> → REP-level access), but the **office is the source of truth**, not the tier.

### Office model

```
Office = {
  scope:          Ecclesia | Organization,
  title:          RecordingBrother | Treasurer | Rep | OrgContact | …,
  heldBy:         personId,
  contactAddress: string,   // personal email OR a dedicated role inbox (see §4)
  term?:          { start, end? },
}
```

Offices hang off `Ecclesia | Organization` **interchangeably**. The Organizations
entity (cross-ecclesia groups — magazines like *The Tidings*, *The Christadelphian*,
*The Bible Missionary*; bodies like WCF, CBM) is where org-scoped offices live.

### Disentangling "rep"

"Rep" currently means three things; separate them:

| Today's "rep"        | Belongs to        | Notes |
|----------------------|-------------------|-------|
| Rep-the-access-tier  | **Access Tier**   | A permission level in code. |
| Rep-the-assistant    | **Office**        | Helps the Recording Brother (often a spouse, or a willing/long-tenured hand). A *second* office alongside RB — not a co-holder of RB. |
| Rep-the-org-contact  | **Office** (Org)  | Key contact for a Christadelphian organization. |

### Offices are peers

**Treasurer** is just a peer of **Recording Brother** — same machinery, different
audience. RB is chief correspondent for the *ecclesia*; Treasurer is the reachable
point of contact for *money/organizations*. Both surrender address-privacy to
member-and-above; both yield their own role-based audience.

---

## 4. Identity: person vs. role-address

A role contact address can be **either**:

- the holder's **personal** email (the *common* case — many recording brothers just
  use their own address), or
- a **dedicated role inbox** (`teerecbro@gmail.com` = "the Recording Brother of
  Toronto East," distinct from the person `ken.easson@gmail.com`).

Neither is "standard"; both are common. The invariant is **the office, not the
address**: *"Recording Brother of TEE is held by person X, reachable at address Y,"*
where Y is a property of the **current assignment**. When the office hands off, the
new holder's assignment carries *their* address (personal or dedicated), and audiences
re-resolve. No address is ever a "member" to reconcile — the **person** is the member;
the office points at an address.

### Privacy is an informed choice at assignment time

Because the office sets a visibility floor on its contact address, the assignment flow
must **disclose** it:

> *"As Recording Brother, the address you nominate here will be visible to members and
> above across ecclesias. Use your personal email, or set a role-specific address."*

- Dedicated role inbox → role address goes semi-public, personal email stays private.
- Personal address → that personal address becomes member-visible. Allowed, but the
  person is told *at the moment they accept the office*.

The choice of address **is** the privacy control.

### Login / address resolution

An address must resolve to its person — **including a dedicated role inbox** that
isn't on the person's personal PersonRecord. This is the same one-address→one-person
lookup that exists today (GSI1); the office assignment becomes *another way an address
attaches to a person*. Logging in as `teerecbro@gmail.com` resolves to "Ken, acting as
Recording Brother of TEE, and therefore a member of Toronto East."

---

## 5. Recording Brother as the immutable root — and multi-tenancy falls out

Every Ecclesia (and every Organization) has **exactly one required, immutable office:
Recording Brother.** For organizations it's often titled something else (President,
Secretary, …) — that title is just an **alias** for "Recording Brother of that org."

This is the root of trust for the whole tenant hierarchy:

- The **Recording Brother of each ecclesia** is the local administrative authority for
  that ecclesia. They **assign the people who manage their own ecclesia** (assistants/
  reps, content managers, etc.).
- That produces a **self-administering per-tenant hierarchy** rooted at one immutable
  office, instead of authorization gating on a single global owner/admin.
- This is exactly the delegation primitive multi-tenancy needs: each tenant
  self-administers from its RB down, and cross-tenant audiences (inter-ecclesia
  leaders, treasurers, org contacts) are just queries over those roots.

> The standalone "Inter-Ecclesia" admin link is fully **redundant** once this lands:
> content is composed in the Shared sender, any audience (including inter-ecclesia
> leaders) is a selectable list, and personalization is universal. List *management*
> moves into the directory as office assignment.

---

## 6. What dissolves vs. what gets built

| Dissolves | Becomes |
|-----------|---------|
| `isInterEcclesiaRep` flag | An `Office{title: RecordingBrother}` assignment |
| `import-inter-ecclesia` / `migrate-inter-ecclesia` CSV routes | Directory-driven office assignment |
| Standalone `/admin/email/inter-ecclesia` sender page | Shared sender + audience picker |
| Hardcoded event occasion types | Post + occasion tags (data) |
| News composed via "Custom Email" | News + Events in the Shared sender |
| `reason === 'inter-ecclesia'` personalization gate | Universal per-recipient personalization |
| "rep" meaning three things | Access Tier ⟂ Office (assistant) ⟂ Office (org contact) |

---

## 7. Sequenced slices (each ships value alone)

1. **Universalize personalization.** Promote one-click-login / `ecclesiaUpdateUrl` /
   per-recipient tracking from the inter-ecclesia branch to the default send path.
   Small, isolated, high-leverage. ⚠️ Touches the **shared send path** (newsletter
   included) → apply the feature-flag-safety discipline: add alongside, gate at the
   send layer, do **not** mutate the existing format for un-migrated reasons.

2. **Shared News + Events sender.** One composer in Email Sender that lists both News
   and Event content, with an **audience override** (incl. inter-ecclesia leaders).
   Demote Custom Email to emergency-only. The wedge into content unification — without
   yet rewriting the occasion taxonomy.

3. **Office model in the directory** (the keystone). Introduce `Office` (scope, title,
   heldBy, contactAddress, term), the member-and-above visibility floor, and the
   informed-disclosure assignment flow. Retires `isInterEcclesiaRep` + CSV imports.
   Multi-tenant delegation (RB-assigns-managers) falls out of this.

4. **Audiences as saved queries.** Replace the CSV-backed SES topic for inter-ecclesia
   with a derived query over offices; generalize to Treasurers / Org-contacts.

5. **Content taxonomy cleanup.** Collapse hardcoded occasion types into post +
   tags. Largest untangle; do last, on top of the unified sender.

---

## 8. Open questions

- **Office cardinality**: confirm strictly one-holder-per-office (assistant Rep is a
  *separate* office, not a co-holder), or are there genuine shared seats?
- **Which offices drive cross-ecclesia audiences** beyond Recording Brother and
  Treasurer? (Secretary, Arranging Brother, …?)
- **Org title aliasing**: how configurable should the "President/Secretary = Recording
  Brother" alias be per organization?
- **Access-tier grant rules**: which offices auto-grant which access tier, and is that
  fixed or per-tenant policy?

---

## Related

- `docs/ARCHITECTURE.md` — system boundaries, data contracts
- Multi-tenant read-scoping / write-authz work (current branch lineage)
- Organizations entity (cross-ecclesia groups)
- Privacy system (per-field visibility with role-based overrides)
