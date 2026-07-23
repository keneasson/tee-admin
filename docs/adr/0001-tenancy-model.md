# ADR-0001: Tenancy model — a tenant is an Ecclesia or a Christadelphian Organization

- **Status:** Accepted
- **Date:** 2026-07-23

## Context

"Multi-tenancy" kept getting re-explained because there was no single written
definition — and it was easy to mis-frame (e.g. treating "tee vs echadhub" as two
tenants, which is wrong). The intent is already recorded across GitHub issues
(Epic **#55**, the older phased plan **#28** / #23–27) and design docs
(`docs/OFFICES_AUDIENCES_AND_SENDING_REDESIGN.md`, `docs/UNIFIED_POST_MODEL_DESIGN.md`),
but not stated in one authoritative place. This ADR fixes the model so it stops
living in memory.

## Decision

1. **A tenant is a content-owning entity: an *Ecclesia* OR a Christadelphian
   *Organization*.** Ecclesias are congregations (e.g. Toronto East). Organizations
   are cross-ecclesia bodies (e.g. WCF, Tidings Magazine, CBM, Bible schools,
   fraternal gatherings, charities — see `OrganizationRecord`). Both are tenants;
   they are peers in the ownership model.

2. **Schedules are the primary tenant-owned content — they are the core of the
   newsletter.** The recurring ecclesial rosters — **Memorial service roster,
   Sunday School, Bible Class** (and CYC, see 4) — are what a newsletter is *made
   of*. News, Events, and the Newsletters/Emails that publish them are also
   tenant-owned, but schedules are the heart. (News and Events converge into one
   *post* entity; the occasion — wedding, baptism, etc. — is a **tag**, not a code
   path. See #55 / #60.)

3. **Schedule *shape* differs by tenant type — and that mismatch is precisely why
   Organizations must be first-class tenants, not forced into the ecclesial mold.**
   *Ecclesia* schedules are fixed-cadence weekly rosters (memorial / sunday-school /
   bible-class), a duty-roster shape. *Organization* schedules are a **different
   entity entirely** — formal **business meetings** with an *agenda* and a *list of
   invitees*, closer to a board/stakeholder meeting than a memorial roster, with
   attendees drawn from *many* ecclesias and no weekly cadence. Organizations are
   also primarily a **source of News and Events** for the hub. Shoehorning an org
   into the weekly-roster model is the wrong shape; a first-class tenant with its
   own (business-meeting-shaped) schedule is simpler and correct.

4. **A schedule may be co-sponsored by multiple tenants and meet at multiple
   locations.** Example: a CYC sponsored by Toronto East + Toronto West +
   Mississauga West, meeting at both the Toronto West hall and the Mississauga West
   hall. So schedule↔tenant is **many-to-many (sponsorship)** and schedule↔location
   is **one-to-many**. Single-owner is the *common* case, **not** a universal
   invariant. A co-sponsored schedule's audience spans all sponsoring tenants'
   members, and it appears in each sponsor's newsletter.

5. **Echad Hub is the platform, not a tenant.** All tenants publish from it.
   `echadhub.org` is the hub's own surface. A branded custom domain (e.g.
   `tee-admin.com`) is an **optional presentation skin over a single tenant** — it
   is not itself a tenant. Multi-tenancy is an axis of **content ownership**, not
   of domains.

6. **Content ownership is keyed by `ownerType: 'ecclesia' | 'organization'` +
   `ownerName`** for single-owner content (already true for Meetings; Events
   (`ownerEcclesia`) and News (`ecclesiaId`) to be generalized to match). Shared
   schedules additionally carry a **sponsor set** of tenant refs (see 4).

7. **Authorization = a global access tier scoped by tenant membership + region.**
   Access tiers are `owner > admin > rep > member > guest` (a single global `role`
   on the PersonRecord). Tenancy scope comes from `person.ecclesia` (home tenant)
   and `person.managedRegions` (regions an admin oversees). There is **no
   per-tenant role table**; enforcement lives in `apps/next/utils/ecclesia-permissions.ts`
   and is already applied to events/news/meetings/ecclesia mutations.

8. **The delegation primitive is the Recording Brother office.** Each tenant has
   exactly one immutable, required **Office** — the Recording Brother (organizations
   alias it as President/Secretary/etc.). The RB is the per-tenant root who assigns
   who may manage that tenant. Per-tenant admin hierarchy falls out of this (#55, #58).

9. **Office ≠ Access Tier.** An *Office* is a position held within a tenant; it
   confers audience membership, a member-and-above visibility floor, and no
   opt-out, and holding one can *grant* an access tier. **Audiences are saved
   queries over offices** (e.g. "the Recording Brother of every ecclesia"), not
   hand-maintained lists (#59).

10. **The hub CONNECTS to tenants; it does not REPLACE what they already run.**
    Tenants engage on a spectrum of two modes, and the platform must support both:
    - **Operate-in** (hub is the system of record): the tenant runs its content
      here — TEE keeps its schedules, roster, and newsletter in the app.
    - **Connect-to** (hub integrates/aggregates): the tenant keeps its *own*
      existing systems, and Echad Hub links, embeds, or syncs their News and Events
      rather than asking them to migrate. **Organizations are typically
      connect-to.** The explicit intent is a *hub that connects the Christadelphian
      community's existing organizations*, not a system that supplants their tools.
    See #30 (external-site API), #43 (in-context content widget), #49 (hub public
    feed).

## Consequences

- "Multi-tenancy is done" means: any ecclesia **or** organization can independently
  own its own **Schedules** (and the Newsletter/News/Events that publish from them),
  scoped to its own admins via its Recording Brother — including schedules that are
  **co-sponsored across tenants** (CYC) and organization schedules that **don't**
  follow the weekly-roster cadence.
- The near-term core is **tenant-owned schedules**, not a domain registry. Two
  shape requirements fall out and must be designed for from the start: (a) a
  schedule can have **multiple sponsoring tenants and multiple locations**
  (many-to-many), so the schedule model cannot assume a single owning ecclesia; and
  (b) **organization schedules are irregular** (event/meeting-shaped), so the
  schedule system must accommodate a non-recurring cadence, not only the
  memorial/sunday-school/bible-class weekly pattern.
- Generalizing single-owner content (Events → `ownerEcclesia`, News → `ecclesiaId`)
  to `ownerType`/`ownerName` still applies, but the schedule sponsor-set is the
  harder, more central shape. A domain registry / per-tenant brand is a later,
  optional presentation concern.
- **Connect-don't-replace is a design filter for every org-facing feature.** For
  organizations, prefer integration (link / embed / sync / API) over building
  full authoring UIs that assume the org works inside the app. Org schedules are a
  *distinct* entity (business meeting: agenda + invitees), not a variant of the
  ecclesial roster — do not overload the roster model to fit them. The hub's org
  value is aggregation + connection, not being their system of record.
- Epic **#55** is the authoritative work breakdown and supersedes the framing of the
  older phased plan **#28** (#23–27). This ADR is the *model*; those issues are the
  *tasks*.

## References

- Issues: #55 (epic), #58 (office model / RB root), #59 (audiences as queries),
  #56 (per-recipient personalization), #60 (post + tags), #28/#26/#27 (older phased
  plan), #25 (cross-ecclesia events), #49 (Echad Hub public face), #50 (privacy gating).
- Design: `docs/OFFICES_AUDIENCES_AND_SENDING_REDESIGN.md`,
  `docs/UNIFIED_POST_MODEL_DESIGN.md`.
- Code: `packages/app/types/meetings.ts` (`ownerType`), `packages/app/provider/dynamodb/types.ts`
  (`OrganizationRecord`), `apps/next/utils/ecclesia-permissions.ts` (authz),
  `packages/app/config/tenants.ts` (current hardcoded host→brand map — a presentation
  detail, not the tenancy model).
