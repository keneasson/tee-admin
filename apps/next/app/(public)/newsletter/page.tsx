'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { NewsletterScreen } from '@my/app/features/newsletter/newsletter-screen'
import { useUserRole } from '@/hooks/use-user-role'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export default function NewsletterPage() {
  const router = useRouter()
  const { role, isMemberOrHigher, isLoading } = useUserRole()
  const { data: session } = useSession()
  const isAdminOrOwner = session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER

  const handleNavigate = useCallback((path: string) => {
    router.push(path)
  }, [router])

  const handleClearCache = useCallback(async () => {
    const response = await fetch('/api/cache/invalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
      onNavigate={handleNavigate}
    />
  )
}