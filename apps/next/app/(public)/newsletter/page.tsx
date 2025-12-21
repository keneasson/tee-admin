'use client'

import { useCallback } from 'react'
import { NewsletterScreen } from '@my/app/features/newsletter/newsletter-screen'
import { useUserRole } from '@/hooks/use-user-role'
import { useAdminAccess } from '@/hooks/use-admin-access'

export default function NewsletterPage() {
  const { role, isMemberOrHigher, isLoading } = useUserRole()
  const { isAdminOrOwner } = useAdminAccess()

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