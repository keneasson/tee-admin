'use client'

import React, { useState, useCallback } from 'react'
import { ResponsiveDataTable, type RowStyleOverride } from './responsive-data-table'
import { ScheduleTabs, type ScheduleTab } from './schedule-tabs'
import { type ColumnDef } from '@tanstack/react-table'
import { YStack, Text, XStack, useThemeName } from 'tamagui'
import { Button } from '../Button'
import { Copy, ExternalLink, MapPin } from '@tamagui/lucide-icons'
import { brandColors, type ColorMode } from '../branding/brand-colors'
import { resolveNoInPersonServicesMessage } from '@my/app/config/service-messages'

// Enhanced schedule event interface matching requirements
export interface EnhancedScheduleEvent {
  id: string
  date: string
  time: string
  event: string
  presider: string
  speaker?: string
  steward?: string
  location: string
  type: 'memorial' | 'sunday-school' | 'bible-class' | 'cyc'
  isNextEvent?: boolean
  hasConflict?: boolean
  userHighlight?: boolean
  // Schedule-specific secondary data
  secondaryInfo?: {
    topic?: string // Bible Class topic
    lunch?: string // Memorial lunch info
    activities?: string // Memorial activities
    notes?: string // General notes
  }
  [key: string]: any // Allow dynamic fields for each schedule type
}

// Props for the enhanced schedule table
export interface EnhancedScheduleResponsiveProps {
  tabs: ScheduleTab[]
  data: Record<string, EnhancedScheduleEvent[]>
  currentUser?: string
  onTabChange?: (tabKey: string) => void
  activeTab?: string
  hasOlder?: boolean
  onLoadOlder?: () => void
  loading?: boolean
}

// Dynamic column configuration for each schedule type
const SCHEDULE_COLUMN_CONFIG = {
  memorial: [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'Preside', header: 'Preside', type: 'person' },
    { key: 'Exhort', header: 'Exhort', type: 'person' },
    { key: 'Organist', header: 'Organist', type: 'person' },
    { key: 'Steward', header: 'Steward', type: 'person' },
    { key: 'Doorkeeper', header: 'Doorkeeper', type: 'person' },
  ],
  bibleClass: [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'Presider', header: 'Presider', type: 'person' },
    { key: 'Speaker', header: 'Speaker', type: 'person' },
    { key: 'Topic', header: 'Topic', type: 'text' },
  ],
  sundaySchool: [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'Refreshments', header: 'Refreshments', type: 'person' },
  ],
  cyc: [
    { key: 'date', header: 'Date', type: 'date' },
    { key: 'speaker', header: 'Speaker', type: 'person' },
    { key: 'topic', header: 'Topic', type: 'text' },
    { key: 'location', header: 'Location', type: 'text' },
  ],
}

// Detect joint Bible class rows (hosted by another ecclesia)
const isJointBibleClass = (row: any): boolean =>
  row.original.type === 'bibleClass' && !!row.original.Host

// Create person cell with highlighting and conflict detection
const createPersonCell = (colors: any, currentUser?: string) => ({ row, getValue }: any) => {
  const name = getValue() as string
  const isUserHighlighted = currentUser && name?.toLowerCase().includes(currentUser.split('@')[0].toLowerCase())
  const hasConflict = row.original.hasConflict
  const isJoint = isJointBibleClass(row)

  // Check if event is in the past
  const today = new Date()
  const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const eventDate = new Date(row.original.date)
  const isPastEvent = eventDate < torontoToday

  // Determine colors based on whether row is a joint Bible class
  const baseTextColor = isJoint ? colors.infoForeground : colors.textPrimary
  const pastTextColor = isJoint ? colors.infoForeground : colors.textTertiary
  const highlightColor = isJoint ? colors.infoForeground : colors.primary
  const highlightBg = isJoint ? `${colors.infoForeground}20` : colors.backgroundSecondary

  return (
    <XStack gap="$2" alignItems="center" flexWrap="wrap">
      <Text
        fontWeight={row.original.isNextEvent || (isJoint && isUserHighlighted) ? '600' : '400'}
        color={isUserHighlighted ? highlightColor : (isPastEvent ? pastTextColor : baseTextColor)}
        backgroundColor={isUserHighlighted ? highlightBg : 'transparent'}
        paddingHorizontal={isUserHighlighted ? '$2' : 0}
        borderRadius={isUserHighlighted ? '$2' : 0}
        numberOfLines={1}
        flex={1}
        opacity={isPastEvent ? 0.7 : 1}
      >
        {name || '—'}
      </Text>
      {hasConflict && name && isUserHighlighted ? <Button
          backgroundColor={colors.warning}
          color={colors.warningForeground}
          size="$1"
          disabled
          borderRadius="$2"
          paddingHorizontal="$2"
          paddingVertical="$1"
          fontSize={12}
        >
          Conflict
        </Button> : null}
    </XStack>
  )
}

// Create date cell with next event indicator and past event styling
const createDateCell = (colors: any) => ({ row, getValue }: any) => {
  const dateValue = getValue()
  const isNextEvent = row.original.isNextEvent
  const isJoint = isJointBibleClass(row)

  // Check if event is in the past
  const today = new Date()
  const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const eventDate = new Date(dateValue)
  const isPastEvent = eventDate < torontoToday

  // Determine colors based on whether row is a joint Bible class
  const baseTextColor = isJoint ? colors.infoForeground : colors.textPrimary
  const pastTextColor = isJoint ? colors.infoForeground : colors.textTertiary

  // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
  let formattedDate: string
  if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
    // Parse date-only string safely without timezone conversion
    const [year, month, day] = dateValue.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-based
    formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    })
  } else {
    // Handle full datetime strings with timezone
    const date = new Date(dateValue)
    formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      timeZone: 'America/Toronto',
    })
  }

  return (
    <XStack gap="$2" alignItems="center">
      <Text
        fontWeight={isNextEvent ? '600' : '400'}
        numberOfLines={1}
        color={isPastEvent ? pastTextColor : baseTextColor}
        opacity={isPastEvent ? 0.7 : 1}
      >
        {formattedDate}
      </Text>
      {isNextEvent ? <Button
          backgroundColor={colors.success}
          color={colors.successForeground}
          size="$1"
          disabled
          borderRadius="$2"
          paddingHorizontal="$2"
          paddingVertical="$1"
          fontSize={12}
        >
          Next
        </Button> : null}
    </XStack>
  )
}

// Create text cell for non-person fields
const createTextCell = (colors: any) => ({ row, getValue }: any) => {
  const value = getValue() as string
  const isJoint = isJointBibleClass(row)

  // Check if event is in the past
  const today = new Date()
  const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const eventDate = new Date(row.original.date)
  const isPastEvent = eventDate < torontoToday

  // Determine colors based on whether row is a joint Bible class
  const baseTextColor = isJoint ? colors.infoForeground : colors.textPrimary
  const pastTextColor = isJoint ? colors.infoForeground : colors.textTertiary

  return (
    <Text
      fontWeight={row.original.isNextEvent ? '600' : '400'}
      color={isPastEvent ? pastTextColor : baseTextColor}
      numberOfLines={1}
      opacity={isPastEvent ? 0.7 : 1}
    >
      {value || '—'}
    </Text>
  )
}

// Column width configuration: sizes tuned to fit content with comfortable padding
const COLUMN_SIZES: Record<string, { size: number; minSize: number; maxSize: number }> = {
  date:   { size: 130, minSize: 110, maxSize: 160 },
  person: { size: 150, minSize: 100, maxSize: 220 },
  text:   { size: 200, minSize: 120, maxSize: 400 },
}

// Enhanced column definitions with dynamic configuration based on schedule type
const createEnhancedColumns = (
  colors: any,
  currentUser?: string,
  scheduleType?: string
): ColumnDef<EnhancedScheduleEvent>[] => {
  const config = SCHEDULE_COLUMN_CONFIG[scheduleType as keyof typeof SCHEDULE_COLUMN_CONFIG] ||
                 SCHEDULE_COLUMN_CONFIG.memorial // Default to memorial

  return config.map((col) => {
    const sizing = COLUMN_SIZES[col.type] || COLUMN_SIZES.text
    return {
      accessorKey: col.key,
      header: col.header,
      cell: col.type === 'date'
        ? createDateCell(colors)
        : col.type === 'person'
          ? createPersonCell(colors, currentUser)
          : createTextCell(colors),
      ...sizing,
    }
  })
}

export function EnhancedScheduleResponsive({
  tabs,
  data,
  currentUser,
  onTabChange,
  activeTab,
  hasOlder = false,
  onLoadOlder,
  loading = false,
}: EnhancedScheduleResponsiveProps) {
  const [currentTab, setCurrentTab] = useState(activeTab || tabs[0]?.id || '')
  
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]
  
  const handleTabChange = useCallback((tabKey: string) => {
    setCurrentTab(tabKey)
    onTabChange?.(tabKey)
  }, [onTabChange])

  const currentData = data[currentTab] || []
  const columns = React.useMemo(() => createEnhancedColumns(colors, currentUser, currentTab), [colors, currentUser, currentTab])

  // Style override for special rows
  const getRowStyle = React.useCallback((row: any): RowStyleOverride | null => {
    // "No service at hall" memorial rows
    if (row.noServiceAtHall) {
      return {
        backgroundColor: `${colors.warning}15`,
        backgroundColorHover: `${colors.warning}25`,
        textColor: colors.textPrimary,
        textColorSecondary: colors.textSecondary,
        borderColor: `${colors.warning}40`,
      }
    }
    // Joint Bible class rows
    if (!isJointBibleClass(row)) return null
    return {
      backgroundColor: colors.info,
      backgroundColorHover: colors.infoHover,
      textColor: colors.infoForeground,
      textColorSecondary: `${colors.infoForeground}B3`, // 70% opacity
      borderColor: `${colors.infoForeground}30`, // subtle separator
    }
  }, [colors])

  // Check if row can expand based on schedule type and available secondary data
  const getRowCanExpand = React.useCallback((row: any) => {
    const event = row.original
    switch (event.type) {
      case 'bibleClass':
        // Expand only for joint Bible class details (Host, Zoom, InPerson)
        return !!(event.Host || event.ZoomURL || event.MeetingID || event.InPerson)
      case 'memorial':
        return !!(event.noServiceAtHall || event.Lunch || event.lunch || event.Activities || event.activities)
      case 'sundaySchool':
        return false // Sunday School doesn't use secondary rows currently
      case 'cyc':
        return false // CYC already shows topic in main row
      default:
        return false
    }
  }, [])

  // Render secondary information based on schedule type
  const renderSubComponent = React.useCallback(({ row }: { row: any }) => {
    const event = row.original
    const scheduleType = event.type

    return (
      <YStack gap="$2">
        {/* Joint Bible Class details — rendered on info background */}
        {scheduleType === 'bibleClass' && event.Host ? <>
            {/* MetaData title — prominent banner */}
            {event.MetaData ? (
              <Text fontSize="$4" fontWeight="800" color={colors.primary}>
                {event.MetaData}
              </Text>
            ) : (
              <Text fontSize="$3" fontWeight="700" color={colors.textPrimary}>
                Host: {event.Host}
              </Text>
            )}
            {/* In-person location — prominent with map link */}
            {event.InPerson ? <YStack
                gap="$1"
                backgroundColor={`${colors.info}10`}
                padding="$2"
                borderRadius="$2"
              >
                <XStack gap="$2" alignItems="center">
                  <MapPin size={16} color={colors.primary} />
                  <Text fontSize="$3" fontWeight="700" color={colors.primary}>
                    In Person at {event.Host}
                    {event.resolvedVenue ? ` — ${event.resolvedVenue}` : ''}
                  </Text>
                </XStack>
                {event.resolvedAddress ? <Text fontSize="$3" color={colors.primary} paddingLeft="$4">
                    {event.resolvedAddress}
                  </Text> : null}
                {event.resolvedMapUrl ? <Button
                    size="$2"
                    backgroundColor={colors.primary}
                    color={colors.primaryForeground}
                    hoverStyle={{ backgroundColor: colors.primaryHover }}
                    icon={<MapPin size={14} color={colors.primaryForeground} />}
                    marginLeft="$4"
                    alignSelf="flex-start"
                    onPress={() => {
                      if (typeof window !== 'undefined') window.open(event.resolvedMapUrl, '_blank')
                    }}
                  >
                    View Map
                  </Button> : null}
              </YStack> : null}
            {/* Meeting link — Join Now + clipboard copy */}
            {event.ZoomURL ? <XStack gap="$2" alignItems="center">
                <Button
                  size="$2"
                  backgroundColor={colors.info}
                  color={colors.infoForeground}
                  hoverStyle={{ backgroundColor: colors.infoHover }}
                  icon={<ExternalLink size={14} color={colors.infoForeground} />}
                  onPress={() => {
                    if (typeof window !== 'undefined') window.open(event.ZoomURL, '_blank')
                  }}
                >
                  Join Zoom
                </Button>
                <Button
                  size="$2"
                  variant="outlined"
                  borderColor={colors.border}
                  hoverStyle={{ backgroundColor: colors.backgroundSecondary, borderColor: colors.border }}
                  icon={<Copy size={14} color={colors.textSecondary} />}
                  onPress={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(event.ZoomURL)
                    }
                  }}
                />
              </XStack> : null}
            {event.MeetingID ? <XStack gap="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color={colors.textSecondary}>
                  Meeting ID:
                </Text>
                <Text fontSize="$3" color={colors.textPrimary} flex={1}>
                  {event.MeetingID}
                </Text>
              </XStack> : null}
            {event.MeetingPwd ? <XStack gap="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color={colors.textSecondary}>
                  Password:
                </Text>
                <Text fontSize="$3" color={colors.textPrimary} flex={1}>
                  {event.MeetingPwd}
                </Text>
              </XStack> : null}
          </> : null}

        {scheduleType === 'memorial' ? <YStack gap="$2">
            {event.noServiceAtHall ? (
              <YStack gap="$1">
                <Text fontSize="$4" fontWeight="700" color={colors.textPrimary}>
                  {resolveNoInPersonServicesMessage(event.noInPersonServicesMessage)}
                </Text>
                {(event.Activities || event.activities) ? (
                  <Text fontSize="$3" color={colors.textPrimary}>
                    {event.Activities || event.activities}
                  </Text>
                ) : null}
              </YStack>
            ) : (
              <>
                {(event.Lunch || event.lunch) ? <XStack gap="$2" alignItems="center">
                    <Text fontSize="$3" fontWeight="600" color={colors.textSecondary}>
                      Lunch:
                    </Text>
                    <Text fontSize="$3" color={colors.textPrimary} flex={1}>
                      {event.Lunch || event.lunch}
                    </Text>
                  </XStack> : null}
                {(event.Activities || event.activities) ? <XStack gap="$2" alignItems="center">
                    <Text fontSize="$3" fontWeight="600" color={colors.textSecondary}>
                      Activities:
                    </Text>
                    <Text fontSize="$3" color={colors.textPrimary} flex={1}>
                      {event.Activities || event.activities}
                    </Text>
                  </XStack> : null}
              </>
            )}
          </YStack> : null}
      </YStack>
    )
  }, [colors])

  return (
    <YStack flex={1} gap="$4">
      <ScheduleTabs
        tabs={tabs}
        activeTab={currentTab}
        onTabChange={handleTabChange}
        hasOlder={hasOlder}
        onLoadOlder={onLoadOlder}
        loading={loading}
      >
        {currentData.length > 0 ? (
          <YStack gap="$4">
            <ResponsiveDataTable
              data={currentData}
              columns={columns}
              searchPlaceholder={`Search ${tabs.find(t => t.id === currentTab)?.name.toLowerCase()} events...`}
              pageSize={currentData.length} // Show all loaded data
              maxPageSize={1000}
              renderSubComponent={renderSubComponent}
              getRowCanExpand={getRowCanExpand}
              getRowStyle={getRowStyle}
            />
          </YStack>
        ) : (
          <YStack padding="$8" alignItems="center" justifyContent="center">
            <Text color={colors.textSecondary} fontSize="$4">
              No events found for {tabs.find(t => t.id === currentTab)?.name}
            </Text>
          </YStack>
        )}
      </ScheduleTabs>
    </YStack>
  )
}