'use client'

import { EnhancedScheduleWithData } from '@my/ui/src/data-table/enhanced-schedule-with-data'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { Wrapper } from '@my/app/provider/wrapper'

export default function SchedulePage() {
  const isHydrated = useHydrated()

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
        showAdminFeatures={false}
      />
    </Wrapper>
  )
}
