'use client'

import { useEffect, useState } from 'react'
import { YStack, Text, Button, XStack, useThemeName, Spinner } from 'tamagui'
import { EnhancedScheduleResponsive } from './enhanced-schedule-responsive'
import { useEnhancedSchedule } from '@my/app/hooks/use-enhanced-schedule'
import { brandColors } from '../branding/brand-colors'

export interface EnhancedScheduleWithDataProps {
  /** Schedule types to display */
  types?: string[]
  /** Initial active tab */
  initialTab?: string
  /** Show admin features */
  showAdminFeatures?: boolean
}

export function EnhancedScheduleWithData({
  types = ['memorial', 'bibleClass', 'sundaySchool', 'cyc'],
  initialTab,
  showAdminFeatures = false,
}: EnhancedScheduleWithDataProps) {
  const [activeTab, setActiveTab] = useState<string | undefined>(initialTab)

  const {
    data,
    tabs,
    currentUser,
    loading,
    error,
    lastUpdated,
    totalEvents,
    hasOlder,
    loadOlder,
    refetch,
    switchToTab,
  } = useEnhancedSchedule({
    types,
    infiniteScroll: true,
    limit: 30,
  })

  // Effect removed - no longer needed for debugging

  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  // Loading state
  if (loading && Object.keys(data).length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" gap="$4">
        <Spinner size="large" color={colors.primary} />
        <Text color={colors.textSecondary} fontSize="$4">
          Loading schedule data...
        </Text>
      </YStack>
    )
  }

  // Error state
  if (error && Object.keys(data).length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" gap="$4">
        <YStack gap="$3" alignItems="center" maxWidth={400}>
          <Text color={colors.error} fontSize="$5" fontWeight="600" textAlign="center">
            Failed to Load Schedule Data
          </Text>
          <Text color={colors.textSecondary} fontSize="$3" textAlign="center">
            {error}
          </Text>
          <Button
            onPress={refetch}
            backgroundColor={colors.primary}
            color={colors.primaryForeground}
            disabled={loading}
          >
            {loading ? 'Retrying...' : 'Try Again'}
          </Button>
        </YStack>
      </YStack>
    )
  }

  // No data state
  if (tabs.length === 0) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$8" gap="$4">
        <YStack gap="$3" alignItems="center" maxWidth={400}>
          <Text color={colors.textSecondary} fontSize="$5" fontWeight="600" textAlign="center">
            No Schedule Data Available
          </Text>
          <Text color={colors.textSecondary} fontSize="$3" textAlign="center">
            There are no schedule events to display at this time.
          </Text>
          <Button onPress={refetch} variant="outlined" disabled={loading}>
            Refresh
          </Button>
        </YStack>
      </YStack>
    )
  }

  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey)
    // Switch to the new tab's data
    switchToTab(tabKey)
  }

  // Determine active tab (use first available tab if none specified)
  const currentActiveTab = activeTab || tabs[0]?.id || ''

  return (
    <YStack flex={1} gap="$4">
      {/* Header with status info */}
      {(showAdminFeatures || error) && (
        <XStack
          justifyContent="space-between"
          alignItems="center"
          paddingHorizontal="$4"
          paddingVertical="$2"
          backgroundColor={error ? colors.error + '10' : colors.backgroundSecondary}
          borderRadius="$4"
          borderWidth={error ? 1 : 0}
          borderColor={error ? colors.error : 'transparent'}
        >
          <YStack gap="$1">
            {error && (
              <Text fontSize="$2" color={colors.error} fontWeight="600">
                ⚠️ {error}
              </Text>
            )}
            {showAdminFeatures && (
              <Text fontSize="$2" color={colors.textSecondary}>
                {totalEvents} events • Updated{' '}
                {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'never'}
              </Text>
            )}
          </YStack>

          {(showAdminFeatures || error) && (
            <Button size="$2" variant="outlined" onPress={refetch} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}
        </XStack>
      )}

      {/* Enhanced Schedule Table */}
      <EnhancedScheduleResponsive
        tabs={tabs}
        data={data}
        currentUser={currentUser || undefined}
        onTabChange={handleTabChange}
        activeTab={currentActiveTab}
        hasOlder={hasOlder}
        onLoadOlder={loadOlder}
        loading={loading}
      />
    </YStack>
  )
}
