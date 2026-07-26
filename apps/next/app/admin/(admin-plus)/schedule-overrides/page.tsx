'use client'

import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, Text, Spinner, Heading } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { ScheduleOverridesManager } from '@my/app/features/schedule-overrides'

export default function AdminScheduleOverridesPage() {
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
    <YStack flex={1} padding="$4" space="$4">
      <YStack space="$2">
        <Heading size="$8">Service Overrides</Heading>
        <Text color="$colorSecondary">
          Make a per-occurrence exception for a recurring service without editing the schedule
          sheet — cancel it with a custom message, force it to show, or add an announcement note.
          Overrides apply to both the web newsletter and the emailed newsletter.
        </Text>
      </YStack>

      <ScheduleOverridesManager />
    </YStack>
  )
}
