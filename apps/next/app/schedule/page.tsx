'use client'

import { EnhancedScheduleResponsive } from '@my/ui/src/data-table/enhanced-schedule-responsive'
import { useEnhancedSchedule } from '@my/app/hooks/use-enhanced-schedule'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { Wrapper } from '@my/app/provider/wrapper'
import { YStack, Text, useThemeName } from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'

export default function SchedulePage() {
  const isHydrated = useHydrated()
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const { data, tabs, currentUser, loading, error, hasMore, hasOlder, loadMore, loadOlder } = useEnhancedSchedule({
    types: ['memorial', 'bibleClass', 'sundaySchool', 'cyc'],
    autoRefresh: true,
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    infiniteScroll: true,
    limit: 30 // Load 30 events per page
  })

  // Don't render until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <Wrapper subHeader={'Ecclesial Programs'}>
        <Loading />
      </Wrapper>
    )
  }

  if (loading) {
    return (
      <Wrapper subHeader={'Ecclesial Programs'}>
        <Loading />
      </Wrapper>
    )
  }

  if (error) {
    return (
      <Wrapper subHeader={'Ecclesial Programs'}>
        <YStack padding="$4" alignItems="center">
          <Text color={colors.error} fontSize="$4" textAlign="center">
            Error loading schedules: {error}
          </Text>
        </YStack>
      </Wrapper>
    )
  }

  return (
    <Wrapper subHeader={'Ecclesial Programs'}>
      <YStack flex={1} padding="$4">
        <EnhancedScheduleResponsive
          tabs={tabs}
          data={data}
          currentUser={currentUser || undefined}
          hasMore={hasMore}
          hasOlder={hasOlder}
          onLoadMore={loadMore}
          onLoadOlder={loadOlder}
          loading={loading}
        />
      </YStack>
    </Wrapper>
  )
}