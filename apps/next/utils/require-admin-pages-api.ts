import type { NextApiRequest, NextApiResponse } from 'next'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { auth } from './auth'

/**
 * Owner/admin gate for the remaining Pages Router API routes.
 *
 * These legacy routes (`/api/email/[reason]`, `/api/contact/*`) send to whole
 * SES lists and read/modify SES contacts, and shipped with NO auth check. Their
 * only callers are admin screens in the browser, which carry the NextAuth
 * session cookie — the same owner/admin rule as `/api/email/send-one`.
 *
 * Returns true when the request may proceed; otherwise it has already written
 * the 401/403 response and the handler must return.
 */
export async function requireAdminPagesApi(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<boolean> {
  let session: { user?: { email?: string | null; role?: string } } | null = null
  try {
    // Pages Router form: NextAuth reads the session cookie from req/res.
    session = await (auth as (...a: unknown[]) => Promise<typeof session>)(req, res)
  } catch (err) {
    console.error('[requireAdminPagesApi] session lookup failed:', err)
  }
  if (!session?.user?.email) {
    res.status(401).json({ error: 'Authentication required' })
    return false
  }
  const role = session.user.role
  if (!role || ![ROLES.OWNER, ROLES.ADMIN].includes(role as typeof ROLES.OWNER)) {
    res.status(403).json({ error: 'Insufficient permissions' })
    return false
  }
  return true
}
