import { cookies } from 'next/headers'
import { getTrust } from './auth-trust'
import { RECOGNITION_COOKIE } from './recognition-cookie'
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
 *    ecclesia token → `recognized`; neither → `anonymous`. The token is the one
 *    the route passes, else the email-link recognition cookie (#252) — so every
 *    route recognizes a reader who arrived from our email without plumbing it.
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
  const ecclesiaToken = opts?.ecclesiaToken ?? (await readRecognitionCookie())
  const trust = await getTrust({ ecclesiaToken })
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

/** The email-link recognition token, if this request carries one. */
async function readRecognitionCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(RECOGNITION_COOKIE)?.value ?? null
  } catch {
    // Outside a request scope (e.g. a build-time render) there are no cookies.
    return null
  }
}
