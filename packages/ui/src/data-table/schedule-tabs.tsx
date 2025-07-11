'use client'

import React, { useState } from 'react'
import {
  Tabs,
  YStack,
  XStack,
  Text,
  Button,
  ScrollView,
  useThemeName,
} from 'tamagui'
import { brandColors } from '../branding/brand-colors'

export interface ScheduleTab {
  id: string
  name: string
  key: string
}

export interface ScheduleTabsProps {
  tabs: ScheduleTab[]
  activeTab?: string
  onTabChange: (tabKey: string) => void
  children?: React.ReactNode
  hasOlder?: boolean
  onLoadOlder?: () => void
  loading?: boolean
}

export function ScheduleTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  hasOlder = false,
  onLoadOlder,
  loading = false,
}: ScheduleTabsProps) {
  const currentTab = activeTab || tabs[0]?.id || ''
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  return (
    <YStack flex={1} gap="$4">
      {/* Horizontal Tab Navigation */}
      <Tabs
        value={currentTab}
        onValueChange={onTabChange}
        orientation="horizontal"
        flexDirection="column"
        width="100%"
      >
        {/* Tab List with Show Older Events Button */}
        <XStack
          backgroundColor={colors.backgroundSecondary}
          borderRadius="$4"
          padding="$2"
          gap="$2"
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Tabs */}
          <Tabs.List
            backgroundColor="transparent"
            borderRadius="$0"
            padding="$0"
            gap="$1"
            disablePassBorderRadius
            flex={1}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <XStack gap="$1">
                {tabs.map((tab) => (
                  <Tabs.Tab
                    key={tab.id}
                    value={tab.id}
                    backgroundColor={currentTab === tab.id ? colors.primary : "transparent"}
                    borderRadius="$3"
                    paddingHorizontal="$4"
                    paddingVertical="$2"
                    minWidth={120}
                    justifyContent="center"
                    alignItems="center"
                    pressStyle={{
                      backgroundColor: colors.primaryPressed,
                    }}
                    focusStyle={{
                      backgroundColor: colors.primaryHover,
                    }}
                    animation="quick"
                    hoverStyle={{
                      backgroundColor: colors.primaryHover,
                    }}
                    onMouseEnter={() => setHoveredTab(tab.id)}
                    onMouseLeave={() => setHoveredTab(null)}
                  >
                    <Text
                      fontWeight={currentTab === tab.id ? '600' : '400'}
                      color={
                        currentTab === tab.id 
                          ? colors.primaryForeground 
                          : hoveredTab === tab.id 
                            ? colors.primaryForeground 
                            : colors.textSecondary
                      }
                      fontSize="$3"
                      numberOfLines={1}
                    >
                      {tab.name}
                    </Text>
                  </Tabs.Tab>
                ))}
              </XStack>
            </ScrollView>
          </Tabs.List>

          {/* Show Older Events Button - Always visible but disabled when no more data */}
          {onLoadOlder && (
            <Button
              size="$3"
              onPress={hasOlder ? onLoadOlder : undefined}
              disabled={loading || !hasOlder}
              backgroundColor={!hasOlder ? colors.backgroundTertiary : colors.secondary}
              color={!hasOlder ? colors.textDisabled : colors.secondaryForeground}
              borderRadius="$3"
              paddingHorizontal="$3"
              paddingVertical="$2"
              minWidth={140}
              opacity={!hasOlder ? 0.6 : 1}
              hoverStyle={hasOlder ? {
                backgroundColor: colors.interactiveHover,
              } : {}}
              pressStyle={hasOlder ? {
                backgroundColor: colors.interactivePressed,
              } : {}}
            >
              <Text
                fontSize="$2"
                fontWeight="600"
                color={!hasOlder ? colors.textDisabled : colors.secondaryForeground}
                numberOfLines={1}
              >
                {loading ? 'Loading...' : (hasOlder ? 'Show Older Events' : 'No Older Events')}
              </Text>
            </Button>
          )}
        </XStack>

        {/* Tab Content Area */}
        <YStack flex={1} paddingTop="$3">
          {children}
        </YStack>
      </Tabs>
    </YStack>
  )
}