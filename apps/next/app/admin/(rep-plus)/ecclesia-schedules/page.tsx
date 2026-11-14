'use client'

import { YStack, LoadingState } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { EcclesiaSchedulesScreen } from '@my/app/features/ecclesia-schedules'

/**
 * Ecclesia schedules setup (docs/ECCLESIA_SCHEDULES.md §Screen). The (rep-plus)
 * layout gates the page; the API narrows it to the owner or the Recording
 * Brother / a Rep of the ecclesia (`canManageEcclesiaSchedules`).
 */
export default function Page() {
  const isHydrated = useHydrated()
  if (!isHydrated) return <LoadingState label="schedules" />
  return (
    <YStack flex={1} padding="$4">
      <EcclesiaSchedulesScreen />
    </YStack>
  )
}
