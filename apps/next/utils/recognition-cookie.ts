/**
 * Email-link recognition (#252) — how a reader who clicked a link in one of our
 * emails stays `recognized` for the pages and API calls that follow.
 *
 *  1. The bulk send appends `?rt=<token>` to every first-party link, one token
 *     per recipient (see `addRecognitionToken` in utils/email/utm-links.ts).
 *  2. Middleware sees `?rt=`, stores it in this httpOnly cookie, and redirects
 *     to the same URL WITHOUT it — so the address bar a reader copies or shares
 *     carries no credential.
 *  3. `resolveViewer()` reads the cookie when there is no session and verifies
 *     it via `getTrust()` (DynamoDB). A bogus or expired value simply resolves
 *     to `anonymous`, and the page shows its "sign in to see" prompt.
 *
 * Recognition grants SIGHT of what the email already showed (PII), never
 * authority: the member cap in `effectiveRole` still gates every change.
 *
 * Edge-safe: no I/O, no Node imports — middleware imports this.
 */

/** Query param carrying the per-recipient token on email links. */
export const RECOGNITION_PARAM = 'rt'

/** httpOnly cookie holding the token between requests. */
export const RECOGNITION_COOKIE = 'tee_rt'

/** Matches the ecclesia-token validity (30 days) — no point outliving the token. */
export const RECOGNITION_MAX_AGE_S = 30 * 24 * 60 * 60

export const recognitionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: RECOGNITION_MAX_AGE_S,
}
