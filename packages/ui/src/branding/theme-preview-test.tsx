'use client'

import { YStack, XStack, Text, View, Button } from '@my/ui'
import { brandColors } from './brand-colors'

// Simple test component to verify theme switching works
export function ThemePreviewTest() {
  const lightColors = brandColors.light
  const darkColors = brandColors.dark
  
  return (
    <YStack gap="$4" padding="$4">
      <Text fontSize="$5" fontWeight="600">Theme Preview Test</Text>
      
      {/* Light Theme Preview */}
      <View
        backgroundColor={lightColors.background}
        padding="$4"
        borderRadius="$4"
        borderWidth={1}
        borderColor={lightColors.border}
      >
        <Text color={lightColors.textPrimary} fontWeight="600" marginBottom="$2">
          Light Theme
        </Text>
        <Text color={lightColors.textSecondary} marginBottom="$3">
          Background: {lightColors.background}
        </Text>
        <XStack gap="$2">
          <View backgroundColor={lightColors.primary} padding="$2" borderRadius="$2">
            <Text color={lightColors.primaryForeground} fontSize="$2">Primary</Text>
          </View>
          <View backgroundColor={lightColors.secondary} padding="$2" borderRadius="$2">
            <Text color={lightColors.secondaryForeground} fontSize="$2">Secondary</Text>
          </View>
        </XStack>
      </View>
      
      {/* Dark Theme Preview */}
      <View
        backgroundColor={darkColors.background}
        padding="$4"
        borderRadius="$4"
        borderWidth={1}
        borderColor={darkColors.border}
      >
        <Text color={darkColors.textPrimary} fontWeight="600" marginBottom="$2">
          Dark Theme
        </Text>
        <Text color={darkColors.textSecondary} marginBottom="$3">
          Background: {darkColors.background}
        </Text>
        <XStack gap="$2">
          <View backgroundColor={darkColors.primary} padding="$2" borderRadius="$2">
            <Text color={darkColors.primaryForeground} fontSize="$2">Primary</Text>
          </View>
          <View backgroundColor={darkColors.secondary} padding="$2" borderRadius="$2">
            <Text color={darkColors.secondaryForeground} fontSize="$2">Secondary</Text>
          </View>
        </XStack>
      </View>
    </YStack>
  )
}