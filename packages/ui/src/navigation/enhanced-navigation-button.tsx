'use client'

import React from 'react'
import { YStack, XStack, Text, View } from '@my/ui'
import { brandColors, type ColorMode } from '../branding/brand-colors'

interface EnhancedNavigationButtonProps {
  /** Function to execute when button is pressed */
  onPress: () => void
  /** Display text for the navigation item */
  text: string
  /** Whether this navigation item is currently active */
  active?: boolean
  /** Optional icon to display before text */
  icon?: string | React.ReactNode
  /** Theme mode for color selection */
  mode?: ColorMode
  /** Whether to show a notification badge */
  badge?: number | boolean
  /** Whether the button is disabled */
  disabled?: boolean
  /** Size variant of the button */
  size?: 'small' | 'medium' | 'large'
  /** Additional description text */
  description?: string
}

export function EnhancedNavigationButton({
  onPress,
  text,
  active = false,
  icon,
  mode = 'light',
  badge,
  disabled = false,
  size = 'medium',
  description
}: EnhancedNavigationButtonProps) {
  const colors = brandColors[mode]
  
  // Size-based styling
  const sizeStyles = {
    small: {
      padding: '$2',
      fontSize: '$3' as const,
      iconSize: '$3' as const,
      minHeight: 40
    },
    medium: {
      padding: '$3',
      fontSize: '$4' as const,
      iconSize: '$4' as const,
      minHeight: 48
    },
    large: {
      padding: '$4',
      fontSize: '$5' as const,
      iconSize: '$5' as const,
      minHeight: 56
    }
  }
  
  const currentSize = sizeStyles[size]
  
  return (
    <View
      backgroundColor={active ? colors.primary : 'transparent'}
      borderRadius="$3"
      borderWidth={1}
      borderColor={active ? colors.primary : colors.borderLight}
      pressStyle={{
        backgroundColor: active ? colors.primaryPressed : colors.interactiveHover,
        scale: 0.98
      }}
      hoverStyle={{
        backgroundColor: active ? colors.primaryHover : colors.interactiveHover,
        borderColor: active ? colors.primaryHover : colors.border
      }}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      opacity={disabled ? 0.5 : 1}
      minHeight={currentSize.minHeight}
      animation="quick"
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        padding={currentSize.padding}
        gap="$2"
      >
        <XStack alignItems="center" gap="$2" flex={1}>
          {/* Icon */}
          {icon && (
            <View
              width={24}
              height={24}
              alignItems="center"
              justifyContent="center"
            >
              {typeof icon === 'string' ? (
                <Text
                  fontSize={currentSize.iconSize}
                  color={active ? colors.primaryForeground : colors.textPrimary}
                >
                  {icon}
                </Text>
              ) : (
                icon
              )}
            </View>
          )}
          
          {/* Text Content */}
          <YStack flex={1} gap="$1">
            <Text
              color={active ? colors.primaryForeground : colors.textPrimary}
              fontSize={currentSize.fontSize}
              fontWeight={active ? '600' : '500'}
              numberOfLines={1}
            >
              {text}
            </Text>
            
            {description && (
              <Text
                color={active ? colors.primaryForeground : colors.textSecondary}
                fontSize="$2"
                numberOfLines={2}
                opacity={0.8}
              >
                {description}
              </Text>
            )}
          </YStack>
        </XStack>
        
        {/* Badge */}
        {badge && (
          <View
            backgroundColor={active ? colors.accent : colors.error}
            borderRadius="$6"
            minWidth={20}
            height={20}
            alignItems="center"
            justifyContent="center"
            paddingHorizontal="$1"
          >
            <Text
              color={active ? colors.accentForeground : colors.errorForeground}
              fontSize="$2"
              fontWeight="600"
            >
              {typeof badge === 'number' ? badge : '•'}
            </Text>
          </View>
        )}
      </XStack>
    </View>
  )
}

// Legacy compatibility wrapper
export function NavigationButtonItem({
  linkTo,
  text,
  active
}: {
  linkTo: () => void
  text: string
  active: boolean
}) {
  return (
    <EnhancedNavigationButton
      onPress={linkTo}
      text={text}
      active={active}
    />
  )
}