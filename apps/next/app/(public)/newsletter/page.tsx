'use client'

import { useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { NewsletterScreen } from '@my/app/features/newsletter/newsletter-screen'
import { useUserRole } from '@/hooks/use-user-role'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export default function NewsletterPage() {
  const { role, isMemberOrHigher, isLoading } = useUserRole()
  const { data: session } = useSession()
  const isAdminOrOwner = session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER

  const handleClearCache = useCallback(async () => {
    const response = await fetch('/api/cache/invalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'all' }),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to clear cache')
    }
  }, [])

  return (
    <NewsletterScreen
      userRole={role}
      isMemberOrHigher={isMemberOrHigher}
      isAuthLoading={isLoading}
      isAdminOrOwner={isAdminOrOwner}
      onClearCache={isAdminOrOwner ? handleClearCache : undefined}
    />
  )
}