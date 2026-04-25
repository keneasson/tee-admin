'use client'

import { FeatureFlagManager } from '@my/ui/src/admin/feature-flag-manager'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, Text, Spinner } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'

export default function FeatureFlagsPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading, user } = useAdminAccess()

  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  return (
    <FeatureFlagManager
      userEmail={user?.email || ''}
      userRole={(user as any)?.role || 'guest'}
    />
  )
}
