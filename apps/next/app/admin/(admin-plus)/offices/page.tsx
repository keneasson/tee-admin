'use client'

import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, Text, Spinner, Heading } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { OfficesOverview } from '@my/app/features/offices'

export default function AdminOfficesPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()

  if (!isHydrated || isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
      </YStack>
    )
  }

  if (!hasAccess) {
    return (
      <YStack flex={1} padding="$4">
        <Text>Access denied. Admin access required.</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <YStack gap="$2">
        <Heading size="$8">Ecclesia Offices</Heading>
        <Text color="$colorSecondary">
          Every ecclesia has a Recording Brother office and may have Rep offices. An office keeps its own
          inbox and phone; the holder is a person and can change.
        </Text>
      </YStack>
      <OfficesOverview />
    </YStack>
  )
}
