import { NextResponse } from 'next/server'
import { requireAssurance, isRecentlyAuthenticated, type TrustContext } from './auth-trust'

/**
 * Fresh-auth gate for sensitive self-serve account edits — the profile/security
 * "Editor" (email, phones, privacy, and the email-change flow).
 *
 * A profile edit must be made by a FRESHLY-authenticated user:
 *  - anonymous → 401 (from requireAssurance)
 *  - recognized (a forwardable bearer, e.g. the newsletter deep-link — could be a
 *    forward recipient, not the account owner) → 403 `stepUpRequired`
 *  - authenticated but STALE (login older than the window) → 403 `stepUpRequired`
 *
 * The recency check also closes the pre-#80 "grandfathering" gap: a session with
 * no `authTime` (treated as `authenticated` by getTrust) is NOT recent, so it is
 * forced to step up before it can mutate anything. The window is generous enough
 * that one step-up covers a short editing session without re-challenging on every
 * save.
 */
export const FRESH_AUTH_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

export type FreshAuthGate =
  | { ok: true; ctx: TrustContext }
  | { ok: false; response: NextResponse }

export async function requireFreshAuth(maxAgeMs: number = FRESH_AUTH_WINDOW_MS): Promise<FreshAuthGate> {
  const gate = await requireAssurance('authenticated')
  if (!gate.ok) return gate
  if (!isRecentlyAuthenticated(gate.ctx, maxAgeMs)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "For your security, please confirm it's you to make account changes.",
          stepUpRequired: true,
          reason: 'stale',
        },
        { status: 403 }
      ),
    }
  }
  return { ok: true, ctx: gate.ctx }
}
