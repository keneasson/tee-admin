'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export function useAdminAccess() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const role = session?.user?.role
  const isAdminOrOwner = role === ROLES.ADMIN || role === ROLES.OWNER
  // RB is a designation (isRecordingBrother boolean), not a hierarchy role
  const isRecordingBrother = !!(session?.user as any)?.isRecordingBrother
  const isRecorderOrRep = isRecordingBrother || role === ROLES.RECORDER || role === ROLES.REP

  // Recorder/Rep can access /admin/community/* pages only
  const isCommunityPage = pathname?.startsWith('/admin/community')
  const hasAccess = isAdminOrOwner || (isRecorderOrRep && isCommunityPage)

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      router.push('/auth/signin')
      return
    }

    if (!hasAccess) {
      router.push('/')
      return
    }
  }, [session, status, hasAccess, router])

  return {
    hasAccess,
    isLoading: status === 'loading',
    user: session?.user
  }
}
