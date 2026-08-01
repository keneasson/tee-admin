'use client'

import { PostViewShowcase } from '@my/ui/src/branding'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, Text, Spinner } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'

export default function BrandPostViewPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()

  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  return <PostViewShowcase />
}
