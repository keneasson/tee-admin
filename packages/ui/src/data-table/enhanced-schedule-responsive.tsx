'use client'

import React, { useState, useCallback } from 'react'
import { ResponsiveDataTable } from './responsive-data-table'
import { ScheduleTabs, type ScheduleTab } from './schedule-tabs'
import { type ColumnDef } from '@tanstack/react-table'
import { YStack, Text, Button, XStack, useThemeName } from 'tamagui'
import { brandColors, type ColorMode } from '../branding/brand-colors'

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

// Create person cell with highlighting and conflict detection
const createPersonCell = (colors: any, currentUser?: string) => ({ row, getValue }: any) => {
  const name = getValue() as string
  const isUserHighlighted = currentUser && name?.toLowerCase().includes(currentUser.split('@')[0].toLowerCase())
  const hasConflict = row.original.hasConflict
  
  // Check if event is in the past
  const today = new Date()
  const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const eventDate = new Date(row.original.date)
  const isPastEvent = eventDate < torontoToday
  
  return (
    <XStack gap="$2" alignItems="center" flexWrap="wrap">
      <Text 
        fontWeight={row.original.isNextEvent ? '600' : '400'}
        color={isUserHighlighted ? colors.primary : (isPastEvent ? colors.textTertiary : colors.textPrimary)}
        backgroundColor={isUserHighlighted ? colors.backgroundSecondary : 'transparent'}
        paddingHorizontal={isUserHighlighted ? '$2' : 0}
        borderRadius={isUserHighlighted ? '$2' : 0}
        numberOfLines={1}
        flex={1}
        opacity={isPastEvent ? 0.7 : 1}
      >
        {name || '—'}
      </Text>
      {hasConflict && name && isUserHighlighted && (
        <Button 
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
        </Button>
      )}
    </XStack>
  )
}

// Create date cell with next event indicator and past event styling
const createDateCell = (colors: any) => ({ row, getValue }: any) => {
  const dateValue = getValue()
  const isNextEvent = row.original.isNextEvent
  
  // Check if event is in the past
  const today = new Date()
  const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const eventDate = new Date(dateValue)
  const isPastEvent = eventDate < torontoToday
  
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
        color={isPastEvent ? colors.textTertiary : colors.textPrimary}
        opacity={isPastEvent ? 0.7 : 1}
      >
        {formattedDate}
      </Text>
      {isNextEvent && (
        <Button 
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
        </Button>
      )}
    </XStack>
  )
}

// Create text cell for non-person fields
const createTextCell = (colors: any) => ({ row, getValue }: any) => {
  const value = getValue() as string
  
  // Check if event is in the past
  const today = new Date()
  const torontoToday = new Date(today.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const eventDate = new Date(row.original.date)
  const isPastEvent = eventDate < torontoToday
  
  return (
    <Text 
      fontWeight={row.original.isNextEvent ? '600' : '400'}
      color={isPastEvent ? colors.textTertiary : colors.textPrimary}
      numberOfLines={1}
      opacity={isPastEvent ? 0.7 : 1}
    >
      {value || '—'}
    </Text>
  )
}

// Enhanced column definitions with dynamic configuration based on schedule type
const createEnhancedColumns = (
  colors: any, 
  currentUser?: string, 
  scheduleType?: string
): ColumnDef<EnhancedScheduleEvent>[] => {
  const config = SCHEDULE_COLUMN_CONFIG[scheduleType as keyof typeof SCHEDULE_COLUMN_CONFIG] || 
                 SCHEDULE_COLUMN_CONFIG.memorial // Default to memorial
  
  return config.map((col) => ({
    accessorKey: col.key,
    header: col.header,
    cell: col.type === 'date' 
      ? createDateCell(colors)
      : col.type === 'person' 
        ? createPersonCell(colors, currentUser)
        : createTextCell(colors),
    size: col.type === 'date' ? 120 : col.type === 'text' ? 150 : 200,
    minSize: col.type === 'date' ? 100 : col.type === 'text' ? 120 : 150,
    maxSize: col.type === 'date' ? 140 : col.type === 'text' ? 200 : 300,
  }))
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

  // Check if row can expand based on schedule type and available secondary data
  const getRowCanExpand = React.useCallback((row: any) => {
    const event = row.original
    switch (event.type) {
      case 'bibleClass':
        return !!(event.Topic || event.topic)
      case 'memorial':
        return !!(event.Lunch || event.lunch || event.Activities || event.activities)
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
      <YStack gap="$2" padding="$2">
        {scheduleType === 'bibleClass' && (event.Topic || event.topic) && (
          <XStack gap="$2" alignItems="center">
            <Text fontSize="$3" fontWeight="600" color={colors.textSecondary}>
              Topic:
            </Text>
            <Text fontSize="$3" color={colors.textPrimary} flex={1}>
              {event.Topic || event.topic}
            </Text>
          </XStack>
        )}
        
        {scheduleType === 'memorial' && (
          <YStack gap="$1">
            {(event.Lunch || event.lunch) && (
              <XStack gap="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color={colors.textSecondary}>
                  Lunch:
                </Text>
                <Text fontSize="$3" color={colors.textPrimary} flex={1}>
                  {event.Lunch || event.lunch}
                </Text>
              </XStack>
            )}
            {(event.Activities || event.activities) && (
              <XStack gap="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color={colors.textSecondary}>
                  Activities:
                </Text>
                <Text fontSize="$3" color={colors.textPrimary} flex={1}>
                  {event.Activities || event.activities}
                </Text>
              </XStack>
            )}
          </YStack>
        )}
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