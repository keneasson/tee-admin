'use client'

import React from 'react'
import { YStack, XStack, Text, View, Separator } from '@my/ui'
import { brandColors, type ColorMode } from '../branding/brand-colors'

interface NavigationGroupProps {
  /** Title of the navigation group */
  title: string
  /** Child navigation items */
  children: React.ReactNode
  /** Theme mode for color selection */
  mode?: ColorMode
  /** Whether the group is collapsible */
  collapsible?: boolean
  /** Whether the group is initially collapsed (only if collapsible) */
  defaultCollapsed?: boolean
  /** Optional icon for the group */
  icon?: string | React.ReactNode
  /** Optional description for the group */
  description?: string
  /** Whether to show a separator after the group */
  showSeparator?: boolean
}

export function NavigationGroup({
  title,
  children,
  mode = 'light',
  collapsible = false,
  defaultCollapsed = false,
  icon,
  description,
  showSeparator = true
}: NavigationGroupProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const colors = brandColors[mode]
  
  const toggleCollapsed = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed)
    }
  }
  
  return (
    <YStack gap="$2">
      {/* Group Header */}
      <View
        backgroundColor={colors.backgroundSecondary}
        borderRadius="$2"
        padding="$2"
        pressStyle={collapsible ? { backgroundColor: colors.backgroundTertiary } : undefined}
        cursor={collapsible ? 'pointer' : 'default'}
        onPress={collapsible ? toggleCollapsed : undefined}
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <XStack alignItems="center" gap="$2" flex={1}>
            {/* Icon */}
            {icon && (
              <View
                width={16}
                height={16}
                alignItems="center"
                justifyContent="center"
              >
                {typeof icon === 'string' ? (
                  <Text fontSize={16} color={colors.textSecondary}>
                    {icon}
                  </Text>
                ) : (
                  icon
                )}
              </View>
            )}
            
            {/* Title and Description */}
            <YStack flex={1}>
              <Text
                fontSize="$2"
                fontWeight="600"
                color={colors.textSecondary}
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                {title}
              </Text>
              
              {description && (
                <Text
                  fontSize="$1"
                  color={colors.textTertiary}
                  numberOfLines={1}
                >
                  {description}
                </Text>
              )}
            </YStack>
          </XStack>
          
          {/* Collapse Indicator */}
          {collapsible && (
            <Text
              fontSize="$3"
              color={colors.textTertiary}
              animation="quick"
              rotate={isCollapsed ? '0deg' : '90deg'}
            >
              ▶
            </Text>
          )}
        </XStack>
      </View>
      
      {/* Group Content */}
      {(!collapsible || !isCollapsed) && (
        <YStack gap="$1" paddingLeft="$2">
          {children}
        </YStack>
      )}
      
      {/* Separator */}
      {showSeparator && (
        <Separator
          marginVertical="$2"
          borderColor={colors.borderLight}
        />
      )}
    </YStack>
  )
}

// Quick helper for creating admin sections
export function AdminNavigationGroup({
  children,
  mode = 'light'
}: {
  children: React.ReactNode
  mode?: ColorMode
}) {
  return (
    <NavigationGroup
      title="Admin Tools"
      icon="⚙️"
      description="Administrative functions and settings"
      mode={mode}
      collapsible
      defaultCollapsed={false}
    >
      {children}
    </NavigationGroup>
  )
}

// Quick helper for creating main navigation sections
export function MainNavigationGroup({
  children,
  mode = 'light'
}: {
  children: React.ReactNode
  mode?: ColorMode
}) {
  return (
    <NavigationGroup
      title="Main Menu"
      icon="🏠"
      description="Primary navigation pages"
      mode={mode}
      collapsible={false}
    >
      {children}
    </NavigationGroup>
  )
}