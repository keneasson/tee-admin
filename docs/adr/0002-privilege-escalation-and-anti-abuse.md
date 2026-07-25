# ADR-0002: Privilege escalation & anti-abuse — trust model for creating tenants, adding members, assigning Recording Brother

- **Status:** Accepted
- **Date:** 2026-07-24

## Context

Echad Hub onboards tenants (ecclesias/organizations — see ADR-0001) and manages
their members and roles. Two forces are in tension:

- **Abuse:** nothing should let a random person self-create a fake ecclesia
  ("Ecclesia of Micronesia"), self-assign Recording Brother, and blast spam
  News/Newsletters to the community.
- **Friction:** today the friction is mis-calibrated in the *wrong* direction — the
  most-vetted user (platform owner, who is also a Recording Brother) still sees
  "This change needs two approvers" for actions squarely within their authority.

The existing provisions (managed-regions, an approval flow) are not well defined.
This ADR fixes the trust model so vetted actors are frictionless and abuse vectors
are closed.

Crucially, **trust is not binary.** It has a **level** (role: member < rep <
Recording Brother) *and* a **standing** (how established a tenant is — its age plus
sustained activity in Echad Hub: regular sign-ins, sends, membership management).
The *amount* of combined trust should determine *how much process* a sensitive
action requires — how many people must be involved. High trust → a single
confirmation; low trust → more witnesses.

## Decision

1. **Trust flows from established, vetted actors — tenant creation and RB
   assignment are NEVER self-service.** No one becomes the Recording Brother of a
   tenant by claiming it themselves.

2. **Frictionless authority (single action, no second approver) for actors
   operating within their established scope:**
   - **Platform Owner** — root of trust; may create/vouch any tenant, assign any
     RB, do anything. Never needs a second approver for their own action.
   - **Recording Brother of an *established* tenant** — full, single-step control
     *within their own tenant*: add/remove members, assign roles up to admin/rep,
     manage their roster and content.
   - **Admins / Reps** — frictionless within the scope their RB delegated.
   - **Members / everyone else** — cannot create tenants or self-escalate; they may
     *request*, and their tenant's RB/admin approves in one step.

3. **Creating a new tenant is a vouched action, and a new tenant starts *pending*:**
   - By the **Platform Owner** → single step (they are the root of trust).
   - By an **existing RB of another tenant** (web of trust) → allowed, but a tenant
     created by a non-owner requires **one additional vouch** (a second established
     RB, or platform-owner confirmation) before it leaves *pending*.
   - A **pending** tenant can be set up but **cannot send outbound email or appear
     in public feeds** until it is vouched → established. This gate — not a blanket
     rule — is where a legitimate "second approver" belongs.

4. **The first Recording Brother is assigned by the trusted creator at creation
   time**, never self-claimed. Thereafter the RB is the immutable per-tenant root
   (ADR-0001) and delegates within the tenant.

5. **Two-approver is reserved for genuinely high-risk actions only:** (a) a
   non-owner creating/vouching a new tenant (see 3), (b) granting platform-level or
   cross-tenant authority, (c) replacing the Recording Brother of an *established*
   tenant. It **must not** fire for a vetted actor acting within their own
   established authority — that is the current bug to remove.

6. **Anti-abuse guardrails:** outbound email + public visibility are gated behind
   *established* status (3); a not-yet-established tenant has invite scope/rate
   limits; every tenant-creation and RB-assignment writes an **attestation record**
   (who vouched, when) for auditability.

7. **Trust is multi-vector and scales the process *inversely*.** Three inputs
   combine into a trust score for any actor/action:
   - **Level** — the actor's role: member < rep < Recording Brother.
   - **Standing** — how established the actor's *tenant* is: **age + sustained
     activity** in the hub (sign-ins, sends, membership management). A long-active,
     engaged ecclesia accrues standing over time; a brand-new one has little.
   - **Manual adjustment** — a sufficiently-trusted actor may raise or lower another
     party's trust directly (see 11). This lets the platform owner *pre-trust*
     brand-new ecclesias in regions no one can personally vet, and lets Recording
     Brothers *dock* a concerning member.

   The combined trust decides **how many people must be involved**: high trust → a
   single confirmation; low trust → additional witnesses. This refines "established"
   as used in 2–6: *established = sufficient standing (computed and/or granted)*, not
   merely "exists."

8. **Member transfers follow the trust gradient, driven by automation.**
   - *High trust* (both ecclesias established): the **receiving** Recording Brother
     can accept a transfer in a **single confirmation** — it does **not** require
     the sending RB to separately *initiate* and the receiving RB to *accept*.
     (Example: Cambridge's RB accepts a transfer from long-established Greenaway
     directly.) Requesting a transfer *out* **auto-emails** a trusted counterpart
     RB when one exists.
   - *Low trust* (e.g. a transfer *into* a brand-new ecclesia — a mass exodus is
     itself a low-trust signal): the request **fans out** to more parties — the new
     ecclesia's RB **and** a nearby (geo-located) established RB and/or a **Trusted
     Organization** as witness — before it settles.
   - The **system selects who to involve** from the trust gradient; the user does
     not choose the approvers.

9. **Trusted Organizations are neutral witnesses / publishers.** An Organization
   tenant may carry a **`trusted`** flag (typically the community magazines — e.g.
   Tidings — that already publish ecclesia formations, dissolutions, and member
   transfers). A trusted org can serve as the extra witness a low-trust event needs,
   and cross-ecclesia trust events (formation / dissolution / transfer) are
   **publishable to it** as News. The flag is granted by the platform owner.

10. **Notifications are per-person, actionable, and batch-consolidated.** Every
    involved person gets **their own** email stating the specific action they must
    take **inline**, plus a **"view more in Echad Hub"** link to full context (e.g.
    the complete transfer list) — via assurance-aware deep-linking (#84) and
    per-recipient personalization (#56). **Batch events consolidate to minimize
    email volume** — one message per recipient carrying the whole list, e.g.:

    ```
    Members leaving Ecclesia X → Ecclesia Y
      [ ] Name     [ ] Name     [ ] Name
      Recording Brother (confirm): [ Bro. ____ ]
      Sponsoring members:          [ Bro./Sis. ____ ]
      Publish to:  [ ] Organization 1   [ ] Organization 2
    ```

    i.e. one email with a checklist + confirmer + sponsors + publish targets, not
    N separate emails.

11. **Trust can be manually adjusted by a sufficiently-trusted actor — up and down.**
    - **Grant up:** the **platform owner** can set any party's trust to any level,
      including **pre-trusting a brand-new ecclesia / its RB** so it skips the
      pending→vouch gate. Rationale: as the hub propagates into regions the owner
      can't personally vet, trust is delegated by declaring a party trusted — *"if I
      say they're 100% trustworthy, they are."* A high-standing Recording Brother may
      likewise raise trust within their reach.
    - **Dock down:** a Recording Brother (with sufficient trust) can **reduce** a
      member's trust when concerned, from the member's **Profile** — a toggle between
      *"high degree of trust"* and *"concerned about this person's trustworthiness."*
    - **Scope of the concern (safeguard):** a dock governs **only the person's
      ability to make changes within Echad Hub** — it is **not** a social, moral, or
      doctrinal verdict on the person, and must not be presented as one. This keeps
      the control from becoming a weapon in interpersonal or doctrinal disputes.
    - **Ceiling & audit:** no actor can raise another **above their own** trust (the
      owner is the ceiling); every adjustment writes to the attestation/audit record
      (who, when, direction, reason).

## Consequences

- The most-vetted users get **zero-friction** control; the self-created-spam-ecclesia
  vector is closed by *no self-service* + the *pending→established vouch gate* +
  *email/visibility gated on established*.
- Requires building: a **tenant lifecycle state** (`pending → established`), an
  **attestation/vouch record**, and a **re-calibration of the existing approval
  flow** so "two approvers" only triggers on the high-risk set (5) — not on the
  owner/RB doing routine work.
- The RB-as-delegation-root from ADR-0001 is the backbone: within-tenant management
  never needs external approval; only crossing a *trust boundary* (new tenant,
  platform authority, RB replacement) does.
- New build surface implied by 7–11:
  - A **trust score** = f(level, standing, manual-adjustment): *standing* aggregates
    tenant age + activity signals (sign-ins, sends, membership ops); *manual
    adjustment* is a stored per-party override (owner grant / RB dock) with a ceiling
    rule and an audit trail.
  - A **trust toggle on the member Profile** (RB-facing) — "high trust" ↔
    "concerned" — scoped strictly to hub-change ability, plus an owner surface to
    pre-trust new ecclesias.
  - A **member-transfer workflow** that selects the involved parties from the trust
    gradient (auto-notify a trusted counterpart RB; fan out to a **geo-located
    nearby RB** and/or trusted org for low-trust cases). Transfers move a person
    between tenants → ties into the unified-people work (#22).
  - A **`trusted` flag on Organizations**, plus formation / dissolution / transfer
    as first-class events **publishable to trusted orgs** as News.
  - **Per-person, consolidated, action-in-email** notifications with "view more in
    Echad Hub" deep-links — reuses the assurance/deep-link (#84) and per-recipient
    personalization (#56) machinery, and the batch-consolidation form above.

## References

- Implementation: #112 (frictionless escalation + anti-abuse).
- Related: #27 (regional admin roles & permissions), #58 (Office model / RB as
  immutable root), #22 (unified people — transfers move a person between tenants),
  #56 (per-recipient email personalization), #84 (assurance-aware deep-linking /
  Verify), ADR-0001 (tenancy model — RB is each tenant's delegation root).
- Code: `apps/next/utils/ecclesia-permissions.ts` (current authz), the existing
  two-approver / permission-escalation flow (to be re-calibrated).
