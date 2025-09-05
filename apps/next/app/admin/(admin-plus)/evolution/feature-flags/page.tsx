'use client'

import { FeaturePlayground, useAdminAccess } from '@my/ui/src/branding'
import { YStack, Text, Spinner } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'

export default function BrandPlaygroundPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  
  if (!isHydrated || isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }
  
  if (!hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text fontSize="$8" color="$error">
          Access Denied
        </Text>
        <Text color="$textSecondary" textAlign="center" marginTop="$2">
          Only Admin and Owner roles can access the branding section.
        </Text>
      </YStack>
    )
  }
  
  return <FeaturePlayground />
}