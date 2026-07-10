import { getTrust } from './auth-trust'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import {
  effectiveRole,
  ANONYMOUS_VIEWER,
  type Role,
  type Viewer,
} from '@my/app/utils/viewer-pii'

/**
 * Resolve the request's {@link Viewer} — assurance + identity in one place.
 *
 *  - assurance comes from getTrust(): a session → `authenticated`; a valid
 *    ecclesia token (passed by the route) → `recognized`; neither → `anonymous`.
 *  - identity (role + tenant) is resolved from the PersonRecord the credential
 *    maps to, for BOTH the session and the token paths — so a `recognized`
 *    (email-link) viewer still has a role and a tenant, which is what makes
 *    multi-tenant routing work.
 *  - the role is CAPPED for recognized viewers via effectiveRole(): a token can
 *    never confer authority above `member`.
 *
 * I/O-bound (auth + one PersonRecord lookup), so it lives here rather than in the
 * pure primitive (packages/app/utils/viewer-pii.ts).
 */
export async function resolveViewer(opts?: {
  ecclesiaToken?: string | null
}): Promise<Viewer> {
  const trust = await getTrust({ ecclesiaToken: opts?.ecclesiaToken ?? null })
  if (trust.trust === 'anonymous' || !trust.email) {
    return ANONYMOUS_VIEWER
  }

  const person = await personRepository.getByEmailForAuth(trust.email).catch(() => null)
  const actualRole = person?.role as Role | undefined

  return {
    assurance: trust.trust, // 'recognized' | 'authenticated'
    role: effectiveRole(actualRole, trust.trust), // capped for recognized
    tenant: person?.ecclesia ?? null,
    email: trust.email,
  }
}
