'use client'

import { ScheduleEmails } from '@my/app/features/schedule-emails'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Spinner, View } from '@my/ui'

export default function ScheduleEmailsPage() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return (
      <View flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </View>
    )
  }

  return <ScheduleEmails />
}