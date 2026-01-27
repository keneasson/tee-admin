'use client'

import { useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { EnhancedScheduleWithData } from '@my/ui/src/data-table/enhanced-schedule-with-data'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { Wrapper } from '@my/app/provider/wrapper'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export default function SchedulePage() {
  const isHydrated = useHydrated()
  const { data: session } = useSession()
  const isAdminOrOwner = session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER

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

  // Don't render until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <Wrapper subHeader={'Ecclesial Programs'}>
        <Loading />
      </Wrapper>
    )
  }

  return (
    <Wrapper subHeader={'Ecclesial Programs'}>
      <EnhancedScheduleWithData
        types={['memorial', 'bibleClass', 'sundaySchool', 'cyc']}
        showAdminFeatures={isAdminOrOwner}
        onClearCache={isAdminOrOwner ? handleClearCache : undefined}
      />
    </Wrapper>
  )
}