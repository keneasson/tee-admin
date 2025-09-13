'use client'

import { FeaturePlayground, useAdminAccess } from '@my/ui/src/branding'
import { YStack, Text, Spinner } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'

export default function BrandPlaygroundPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  
  // Show loading state during hydration, auth check, or when redirecting
  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }
  
  return <FeaturePlayground />
}