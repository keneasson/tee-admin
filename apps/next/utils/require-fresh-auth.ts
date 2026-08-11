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
 * forced to step up before it can mutate anything.
 *
 * Window = 24h ("confirm it's you" at most once per day). One step-up persists on
 * the session JWT (`authTime`, re-stamped by the jwt callback on every re-auth)
 * and covers a full day of account edits without re-challenging. This only ever
 * applies to `authenticated` sessions — a `recognized` bearer (the newsletter
 * deep-link / a forwarded link) is never "recent" regardless of the window
 * (isRecentlyAuthenticated requires `authenticated`), so a forwarded link can
 * never ride a persisted confirmation and always has to step up.
 */
export const FRESH_AUTH_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

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
