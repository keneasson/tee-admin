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
  useMedia,
  Select,
} from 'tamagui'
import { brandColors } from '../branding/brand-colors'
import { History, ChevronDown } from '@tamagui/lucide-icons'

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
  const media = useMedia()

  // Use dropdown on mobile (small screens), tabs on desktop
  const shouldUseDropdown = media.sm

  const currentTabData = tabs.find(tab => tab.id === currentTab)

  return (
    <YStack flex={1} gap="$4">
      {/* Mobile: Dropdown + Icon Button */}
      {shouldUseDropdown ? (
        <XStack
          backgroundColor={colors.backgroundSecondary}
          borderRadius="$4"
          padding="$3"
          gap="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Event Type Dropdown */}
          <YStack flex={1}>
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              marginBottom="$2"
            >
              Event Type
            </Text>
            <Select
              value={currentTab}
              onValueChange={onTabChange}
              size="$3"
              disablePreventBodyScroll
            >
              <Select.Trigger
                backgroundColor={colors.background}
                borderColor={colors.border}
                iconAfter={ChevronDown}
                width="100%"
              >
                <Select.Value>
                  <Text color={colors.textPrimary} fontWeight="500">
                    {currentTabData?.name || 'Select Type'}
                  </Text>
                </Select.Value>
              </Select.Trigger>

              <Select.Adapt when="sm" platform="touch">
                <Select.Sheet
                  modal
                  dismissOnSnapToBottom
                  forceRemoveScrollEnabled={false}
                  animationConfig={{
                    type: 'spring',
                    damping: 20,
                    mass: 1.2,
                    stiffness: 250,
                  }}
                >
                  <Select.Sheet.Frame>
                    <Select.Sheet.ScrollView>
                      <Select.Adapt.Contents />
                    </Select.Sheet.ScrollView>
                  </Select.Sheet.Frame>
                  <Select.Sheet.Overlay
                    animation="lazy"
                    enterStyle={{ opacity: 0 }}
                    exitStyle={{ opacity: 0 }}
                  />
                </Select.Sheet>
              </Select.Adapt>

              <Select.Content zIndex={200000}>
                <Select.ScrollUpButton />
                <Select.Viewport>
                  {tabs.map((tab, index) => (
                    <Select.Group key={tab.id}>
                      <Select.Item
                        index={index}
                        value={tab.id}
                        backgroundColor={currentTab === tab.id ? colors.primaryHover : 'transparent'}
                      >
                        <Select.ItemText
                          color={currentTab === tab.id ? colors.primary : colors.textPrimary}
                          fontWeight={currentTab === tab.id ? '600' : '400'}
                        >
                          {tab.name}
                        </Select.ItemText>
                        <Select.ItemIndicator marginLeft="auto">
                          <Text color={colors.primary}>✓</Text>
                        </Select.ItemIndicator>
                      </Select.Item>
                    </Select.Group>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
          </YStack>

          {/* Icon Button for Show Older Events */}
          {onLoadOlder && (
            <YStack alignItems="center">
              <Text
                fontSize="$1"
                color={colors.textSecondary}
                marginBottom="$1"
                textAlign="center"
              >
                History
              </Text>
              <Button
                size="$4"
                circular
                onPress={hasOlder ? onLoadOlder : undefined}
                disabled={loading || !hasOlder}
                backgroundColor={!hasOlder ? colors.backgroundTertiary : colors.secondary}
                borderColor={!hasOlder ? colors.border : colors.secondaryBorder}
                borderWidth={1}
                opacity={!hasOlder ? 0.6 : 1}
                hoverStyle={hasOlder ? {
                  backgroundColor: colors.secondaryHover,
                } : {}}
                pressStyle={hasOlder ? {
                  backgroundColor: colors.secondaryPressed,
                } : {}}
                // Accessibility - using aria attributes for DOM compatibility
                aria-label={
                  loading 
                    ? 'Loading older events' 
                    : hasOlder 
                      ? 'Show older events' 
                      : 'No older events available'
                }
                role="button"
                aria-disabled={loading || !hasOlder}
                aria-busy={loading}
              >
                <History 
                  size="$1.5" 
                  color={!hasOlder ? colors.textDisabled : colors.secondaryForeground}
                />
              </Button>
            </YStack>
          )}
        </XStack>
      ) : (
        /* Desktop: Original Tab Layout */
        <Tabs
          value={currentTab}
          onValueChange={onTabChange}
          orientation="horizontal"
          flexDirection="column"
          width="100%"
        >
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

            {/* Show Older Events Button - Desktop */}
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
        </Tabs>
      )}

      {/* Tab Content Area */}
      <YStack flex={1} paddingTop="$3">
        {children}
      </YStack>
    </YStack>
  )
}