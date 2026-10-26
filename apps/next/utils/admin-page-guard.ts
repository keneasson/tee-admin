import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { auth } from '@/utils/auth'

/**
 * Server-side role gate for the admin route groups (plan item A2).
 *
 * Each group under `app/admin/` has one `layout.tsx` that calls
 * `requirePageAccess()`, so no page in the group renders for someone who
 * lacks the role. The APIs behind the pages check roles themselves; this is
 * the matching check for the pages.
 *
 *   (owner)      owner only
 *   (admin-plus) admin or owner
 *   (rep-plus)   admin or owner, plus Recording Brothers and Reps — the
 *                content managers (events / news / meetings) and community
 *                pages. Their APIs scope them to their own ecclesia.
 *
 * The rules mirror `hooks/use-admin-access.tsx`, the client check these pages
 * already had.
 */
export type AdminPageAccess = 'owner' | 'admin-plus' | 'rep-plus'

type SessionUser = { role?: string; isRecordingBrother?: boolean } | undefined

export function hasAdminPageAccess(access: AdminPageAccess, user: SessionUser): boolean {
  const role = user?.role
  const isOwner = role === ROLES.OWNER
  const isAdminOrOwner = isOwner || role === ROLES.ADMIN
  switch (access) {
    case 'owner':
      return isOwner
    case 'admin-plus':
      return isAdminOrOwner
    case 'rep-plus':
      // RB is a designation (isRecordingBrother), not a hierarchy role.
      return (
        isAdminOrOwner ||
        !!user?.isRecordingBrother ||
        role === ROLES.REP ||
        role === ROLES.RECORDER
      )
  }
}

/**
 * Signed out → /auth/signin with a callbackUrl back to the page.
 * Signed in without the role → home page.
 */
export async function requirePageAccess(access: AdminPageAccess): Promise<Session> {
  const session = (await auth()) as Session | null
  if (!session?.user?.email) {
    const path = (await headers()).get('x-pathname')
    const callbackUrl = path && path.startsWith('/') && !path.startsWith('//') ? path : '/'
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
  }
  if (!hasAdminPageAccess(access, session.user as SessionUser)) {
    redirect('/')
  }
  return session
}
