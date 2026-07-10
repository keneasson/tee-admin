/**
 * Server-side viewer authority + PII redaction primitive (Epic #84, slice D).
 *
 * Two axes, deliberately separate:
 *  - identity  (WHO):     role + tenant, resolvable from an email token OR a session.
 *  - assurance (HOW SURE): anonymous < recognized < authenticated.
 *
 * Confirmed rules:
 *  - A recognized/unverified viewer is CAPPED at `member` — a token can never
 *    exercise authority above member. Anything above member requires stepping up
 *    to `authenticated` (so every above-member surface/action implicitly needs
 *    Verify). Clicking a Rep/Admin's forwarded link makes you an *unverified
 *    member* of their ecclesia, never a Rep/Admin.
 *  - A full name is revealed ONLY to a *verified* member-or-greater
 *    (authenticated + role >= member). Recognized viewers — even of a member —
 *    see the first name only, so a forwarded email link never leaks full names.
 *
 * Pure + I/O-free so it unit-tests cleanly and runs in any context (API routes,
 * react-email render). Resolving a Viewer from a request lives in
 * apps/next/utils/resolve-viewer.ts.
 */

export type Role =
  | 'owner'
  | 'admin'
  | 'recorder'
  | 'rep'
  | 'member'
  | 'guest'
  | 'deceased'
  | 'suspicious'

export type Assurance = 'anonymous' | 'recognized' | 'authenticated'

// Higher = more authority. `recorder` is a deprecated rep-level role.
const ROLE_RANK: Record<Role, number> = {
  owner: 5,
  admin: 4,
  recorder: 3,
  rep: 3,
  member: 2,
  guest: 1,
  deceased: 0,
  suspicious: 0,
}
const MEMBER_RANK = ROLE_RANK.member

/** True when `role` is at least `min` in the authority hierarchy. */
export function roleAtLeast(role: Role | undefined, min: Role): boolean {
  return ROLE_RANK[role ?? 'guest'] >= ROLE_RANK[min]
}

/**
 * The EFFECTIVE role for a given assurance. A recognized/anonymous viewer is
 * never above `member`; authenticated viewers keep their real role. Below-member
 * roles (guest/deceased/suspicious) are unchanged. This is THE cap — apply it
 * once, when the Viewer is built.
 */
export function effectiveRole(actual: Role | undefined, assurance: Assurance): Role {
  const r = actual ?? 'guest'
  if (assurance === 'authenticated') return r
  return ROLE_RANK[r] > MEMBER_RANK ? 'member' : r
}

export interface Viewer {
  assurance: Assurance
  /** Effective role — already capped for recognized/anonymous. */
  role: Role
  /** Ecclesia/organization the viewer belongs to (from membership). */
  tenant: string | null
  email: string | null
}

/** Anonymous viewer — no token, no session. */
export const ANONYMOUS_VIEWER: Viewer = {
  assurance: 'anonymous',
  role: 'guest',
  tenant: null,
  email: null,
}

export interface NamedPerson {
  firstName: string
  lastName?: string
  ecclesia?: string
}

/**
 * A full name is revealed only to a *verified* member-or-greater. `target` is
 * accepted for a future tenant-relative refinement (e.g. same-ecclesia only) but
 * the baseline gate is assurance + effective role.
 */
export function canRevealFullName(viewer: Viewer, _target?: NamedPerson): boolean {
  return viewer.assurance === 'authenticated' && roleAtLeast(viewer.role, 'member')
}

/**
 * Display string: full name when allowed, else FIRST NAME ONLY — never a
 * disambiguating initial. Two "Peter"s must stay indistinguishable in the
 * public view; that ambiguity is the privacy feature, not a bug.
 */
export function renderName(target: NamedPerson, viewer: Viewer): string {
  if (canRevealFullName(viewer, target)) {
    return [target.firstName, target.lastName].filter(Boolean).join(' ')
  }
  return target.firstName
}

/**
 * Server-side response shape for a person's name. NEVER includes `lastName`
 * unless the full name is allowed — sanitation happens HERE, before
 * serialization, so a redacted response literally cannot carry the surname
 * (no ship-then-hide View-Source leak).
 */
export function shapePersonName<T extends NamedPerson>(
  target: T,
  viewer: Viewer
): { firstName: string; lastName?: string } {
  return canRevealFullName(viewer, target)
    ? { firstName: target.firstName, lastName: target.lastName }
    : { firstName: target.firstName }
}
