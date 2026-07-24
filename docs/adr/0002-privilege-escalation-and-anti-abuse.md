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

## References

- Implementation: #112 (frictionless escalation + anti-abuse).
- Related: #27 (regional admin roles & permissions), #58 (Office model / RB as
  immutable root), ADR-0001 (tenancy model — RB is each tenant's delegation root).
- Code: `apps/next/utils/ecclesia-permissions.ts` (current authz), the existing
  two-approver / permission-escalation flow (to be re-calibrated).
