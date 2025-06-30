'use client'

import { SchedulesScreen } from '@my/app/features/schedules/schedules-screen'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

// Import the Google Sheets keys
import keys from '../../tee-services-db47a9e534d3.json'

export default function SchedulePage() {
  const isHydrated = useHydrated()

  // Don't render until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return <Loading />
  }

  return <SchedulesScreen googleSheets={keys.sheet_ids} />
}