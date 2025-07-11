'use client'

import React, { useState, useCallback } from 'react'
import { BaseDataTable } from './base-data-table'
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
}

// Props for the enhanced schedule table
export interface EnhancedScheduleTableProps {
  tabs: ScheduleTab[]
  data: Record<string, EnhancedScheduleEvent[]>
  currentUser?: string
  onTabChange?: (tabKey: string) => void
  activeTab?: string
}

// Enhanced column definitions with conflict detection and user highlighting
const createEnhancedColumns = (colors: any, currentUser?: string): ColumnDef<EnhancedScheduleEvent>[] => [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => {
      const date = new Date(row.getValue('date'))
      const isNextEvent = row.original.isNextEvent
      return (
        <XStack gap="$2" alignItems="center">
          <Text fontWeight={isNextEvent ? '600' : '400'}>
            {date.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
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
    },
  },
  {
    accessorKey: 'time',
    header: 'Time',
    cell: ({ row }) => (
      <Text fontWeight={row.original.isNextEvent ? '600' : '400'}>
        {row.getValue('time')}
      </Text>
    ),
  },
  {
    accessorKey: 'event',
    header: 'Event',
    cell: ({ row }) => (
      <Text fontWeight={row.original.isNextEvent ? '600' : '400'}>
        {row.getValue('event')}
      </Text>
    ),
  },
  {
    accessorKey: 'presider',
    header: 'Presider',
    cell: ({ row }) => {
      const name = row.getValue('presider') as string
      const isUserHighlighted = currentUser && name.includes(currentUser)
      const hasConflict = row.original.hasConflict
      
      return (
        <XStack gap="$2" alignItems="center">
          <Text 
            fontWeight={row.original.isNextEvent ? '600' : '400'}
            color={isUserHighlighted ? colors.primary : colors.textPrimary}
            backgroundColor={isUserHighlighted ? colors.backgroundSecondary : 'transparent'}
            paddingHorizontal={isUserHighlighted ? '$2' : 0}
            borderRadius={isUserHighlighted ? '$2' : 0}
          >
            {name}
          </Text>
          {hasConflict && (
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
    },
  },
  {
    accessorKey: 'speaker',
    header: 'Speaker',
    cell: ({ row }) => {
      const name = row.getValue('speaker') as string
      const isUserHighlighted = currentUser && name?.includes(currentUser)
      
      return name ? (
        <Text 
          fontWeight={row.original.isNextEvent ? '600' : '400'}
          color={isUserHighlighted ? colors.primary : colors.textPrimary}
          backgroundColor={isUserHighlighted ? colors.backgroundSecondary : 'transparent'}
          paddingHorizontal={isUserHighlighted ? '$2' : 0}
          borderRadius={isUserHighlighted ? '$2' : 0}
        >
          {name}
        </Text>
      ) : (
        <Text color={colors.textSecondary}>—</Text>
      )
    },
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => (
      <Text 
        fontWeight={row.original.isNextEvent ? '600' : '400'}
        color={colors.textSecondary}
      >
        {row.getValue('location')}
      </Text>
    ),
  },
]

export function EnhancedScheduleTable({
  tabs,
  data,
  currentUser,
  onTabChange,
  activeTab,
}: EnhancedScheduleTableProps) {
  const [currentTab, setCurrentTab] = useState(activeTab || tabs[0]?.id || '')
  
  const handleTabChange = useCallback((tabKey: string) => {
    setCurrentTab(tabKey)
    onTabChange?.(tabKey)
  }, [onTabChange])

  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const currentData = data[currentTab] || []
  const columns = React.useMemo(() => createEnhancedColumns(colors, currentUser), [colors, currentUser])

  return (
    <YStack flex={1} gap="$4">
      <ScheduleTabs
        tabs={tabs}
        activeTab={currentTab}
        onTabChange={handleTabChange}
      >
        {currentData.length > 0 ? (
          <BaseDataTable
            data={currentData}
            columns={columns}
            searchPlaceholder={`Search ${tabs.find(t => t.id === currentTab)?.name.toLowerCase()} events...`}
            pageSize={10}
            maxPageSize={100}
          />
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