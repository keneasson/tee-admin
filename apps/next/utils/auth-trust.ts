import { NextResponse } from 'next/server'
import { auth } from './auth'
import { verifyEcclesiaToken } from './email/ecclesia-token'

/**
 * Authentication assurance levels (Epic #80).
 *
 *  - `anonymous`     — no session, no valid token.
 *  - `recognized`    — identity asserted by a long-lived, forwardable bearer
 *                      credential (the ecclesia-token embedded in bulk email).
 *                      Proves *recognition*, never *authority*: the holder may
 *                      be a forward recipient, not the addressee. Read-only /
 *                      low-sensitivity (e.g. view own opt-ins, one-click
 *                      unsubscribe) — never a mutation that matters.
 *  - `authenticated` — a freshly-proven, cookie-bound credential (password,
 *                      Google OAuth, or a just-completed single-use OTP). Can
 *                      act, subject to role.
 *
 * Rule: a bearer token can raise you to `recognized` but never to
 * `authenticated`. Stepping up requires an OTP sent to the on-file address —
 * which a forwarder cannot receive.
 */
export type Trust = 'anonymous' | 'recognized' | 'authenticated'

const RANK: Record<Trust, number> = { anonymous: 0, recognized: 1, authenticated: 2 }

export interface TrustContext {
  trust: Trust
  email: string | null
  authTime: number | null
  session: Awaited<ReturnType<typeof auth>>
}

/** True when `trust` is at least as strong as `min`. */
export function meetsAssurance(trust: Trust, min: Trust): boolean {
  return RANK[trust] >= RANK[min]
}

/**
 * Resolve the caller's trust tier. A live session wins; otherwise a valid
 * ecclesia-token (passed explicitly by the route) confers `recognized` only.
 *
 * Sessions minted before #80 carry no `assuranceLevel` — they're treated as
 * `authenticated` (grandfathered), consistent with the JWT callback, since the
 * only path that now mints `recognized` is the ecclesia-token exchange.
 */
export async function getTrust(opts?: { ecclesiaToken?: string | null }): Promise<TrustContext> {
  const session = await auth()
  if (session?.user?.email) {
    const level: Trust = session.user.assuranceLevel ?? 'authenticated'
    return {
      trust: level === 'recognized' ? 'recognized' : 'authenticated',
      email: session.user.email.toLowerCase(),
      authTime: session.user.authTime ?? null,
      session,
    }
  }

  const token = opts?.ecclesiaToken
  if (token) {
    const res = await verifyEcclesiaToken(token)
    if (res.valid && res.email) {
      return { trust: 'recognized', email: res.email.toLowerCase(), authTime: null, session: null }
    }
  }

  return { trust: 'anonymous', email: null, authTime: null, session: null }
}

export type AssuranceGuard =
  | { ok: true; ctx: TrustContext }
  | { ok: false; response: NextResponse }

/**
 * Route guard. Returns the trust context when the caller meets `min`, or a
 * ready-to-return NextResponse otherwise:
 *   - `anonymous`  → 401 (must sign in / present a token)
 *   - below `min`  → 403 with `stepUpRequired: true` (recognized but needs auth)
 *
 * Usage:
 *   const gate = await requireAssurance('authenticated', { ecclesiaToken })
 *   if (!gate.ok) return gate.response
 *   // gate.ctx.email is safe to act as
 */
export async function requireAssurance(
  min: Trust,
  opts?: { ecclesiaToken?: string | null }
): Promise<AssuranceGuard> {
  const ctx = await getTrust(opts)
  if (meetsAssurance(ctx.trust, min)) return { ok: true, ctx }

  if (ctx.trust === 'anonymous') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication required', trust: ctx.trust, required: min },
        { status: 401 }
      ),
    }
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Please confirm it's you to continue.",
        trust: ctx.trust,
        required: min,
        stepUpRequired: true,
      },
      { status: 403 }
    ),
  }
}

/**
 * Recency gate for the highest-risk operations (role changes, sending, editing
 * others). Requires `authenticated` AND a login no older than `maxAgeMs`.
 * Callers that fail this should trigger a step-up re-challenge (A5).
 */
export function isRecentlyAuthenticated(ctx: TrustContext, maxAgeMs: number): boolean {
  return ctx.trust === 'authenticated' && ctx.authTime != null && Date.now() - ctx.authTime <= maxAgeMs
}

/**
 * Verify guard (Epic #84, slice B). The one call a sensitive *action* makes:
 * require `authenticated`, and — when `maxAgeMs` is given — require the login to
 * be fresh. Any failure returns a ready-to-send response the client can detect:
 *
 *   - anonymous          → 401
 *   - recognized         → 403 `{ stepUpRequired: true }`      (never verified)
 *   - authenticated+stale→ 403 `{ stepUpRequired: true, stale: true }`
 *
 * The client mounts `<Verify>` on any `stepUpRequired` 403, then retries.
 *
 *   const gate = await requireVerified({ maxAgeMs: 15 * 60_000 })
 *   if (!gate.ok) return gate.response
 *   // gate.ctx.email is freshly proven — safe to mutate as
 */
export async function requireVerified(opts?: {
  ecclesiaToken?: string | null
  maxAgeMs?: number
}): Promise<AssuranceGuard> {
  const gate = await requireAssurance('authenticated', opts)
  if (!gate.ok) return gate

  if (opts?.maxAgeMs != null && !isRecentlyAuthenticated(gate.ctx, opts.maxAgeMs)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Please confirm it's you to continue.",
          trust: gate.ctx.trust,
          required: 'authenticated',
          stepUpRequired: true,
          stale: true,
        },
        { status: 403 }
      ),
    }
  }

  return gate
}
