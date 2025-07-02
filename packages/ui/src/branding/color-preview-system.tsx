'use client'

import { useState } from 'react'
import { YStack, XStack, Text, H3, H4, Button, View, ScrollView } from '@my/ui'
import { brandColors, type ColorMode, type ColorToken } from './brand-colors'

interface ColorChanges {
  [key: string]: string // colorToken -> newColor
}

interface ColorPreviewSystemProps {
  mode: ColorMode
  colorChanges: ColorChanges
  onResetChanges: () => void
  onApplyChanges: () => void
}

// Real site component examples
const SiteExamples = ({ colors, title }: { colors: any, title: string }) => (
  <YStack gap="$3">
    <Text fontSize="$3" fontWeight="600" color="$textSecondary">{title}</Text>
    
    {/* Navigation Example */}
    <YStack gap="$2" backgroundColor={colors.backgroundSecondary} padding="$3" borderRadius="$3">
      <Text fontSize="$2" color="$textTertiary">Navigation</Text>
      <XStack gap="$2">
        <View backgroundColor={colors.primary} padding="$2" borderRadius="$2">
          <Text color={colors.primaryForeground} fontSize="$2">Home</Text>
        </View>
        <View backgroundColor={colors.secondary} padding="$2" borderRadius="$2">
          <Text color={colors.secondaryForeground} fontSize="$2">About</Text>
        </View>
        <View backgroundColor="transparent" padding="$2" borderRadius="$2">
          <Text color={colors.textPrimary} fontSize="$2">Contact</Text>
        </View>
      </XStack>
    </YStack>
    
    {/* Card Example */}
    <YStack gap="$2" backgroundColor={colors.surface} padding="$3" borderRadius="$3" borderWidth={1} borderColor={colors.border}>
      <Text fontSize="$2" color="$textTertiary">Content Card</Text>
      <Text color={colors.textPrimary} fontWeight="600">Card Title</Text>
      <Text color={colors.textSecondary} fontSize="$3">
        This is sample content showing how text appears on surface backgrounds.
      </Text>
      <XStack gap="$2" marginTop="$2">
        <View backgroundColor={colors.accent} padding="$1.5" borderRadius="$2">
          <Text color={colors.accentForeground} fontSize="$2">Tag</Text>
        </View>
        <View backgroundColor={colors.info} padding="$1.5" borderRadius="$2">
          <Text color={colors.infoForeground} fontSize="$2">Info</Text>
        </View>
      </XStack>
    </YStack>
    
    {/* Form Example */}
    <YStack gap="$2" backgroundColor={colors.background} padding="$3" borderRadius="$3" borderWidth={1} borderColor={colors.borderLight}>
      <Text fontSize="$2" color="$textTertiary">Form Elements</Text>
      <YStack gap="$2">
        <Text color={colors.textPrimary} fontSize="$3">Email Address</Text>
        <View backgroundColor={colors.surface} borderWidth={1} borderColor={colors.border} padding="$2" borderRadius="$2">
          <Text color={colors.textSecondary} fontSize="$3">user@example.com</Text>
        </View>
        <XStack gap="$2">
          <View backgroundColor={colors.success} padding="$2" borderRadius="$2" flex={1}>
            <Text color={colors.successForeground} fontSize="$2" textAlign="center">Save</Text>
          </View>
          <View backgroundColor={colors.error} padding="$2" borderRadius="$2" flex={1}>
            <Text color={colors.errorForeground} fontSize="$2" textAlign="center">Delete</Text>
          </View>
        </XStack>
      </YStack>
    </YStack>
    
    {/* Alert Examples */}
    <YStack gap="$2">
      <Text fontSize="$2" color="$textTertiary">Status Messages</Text>
      <View backgroundColor={colors.success} padding="$2" borderRadius="$2" borderWidth={1} borderColor={colors.border}>
        <Text color={colors.successForeground} fontSize="$2">✓ Success: Changes saved successfully</Text>
      </View>
      <View backgroundColor={colors.warning} padding="$2" borderRadius="$2" borderWidth={1} borderColor={colors.border}>
        <Text color={colors.warningForeground} fontSize="$2">⚠ Warning: Please review your changes</Text>
      </View>
      <View backgroundColor={colors.error} padding="$2" borderRadius="$2" borderWidth={1} borderColor={colors.border}>
        <Text color={colors.errorForeground} fontSize="$2">✗ Error: Something went wrong</Text>
      </View>
    </YStack>
  </YStack>
)

export function ColorPreviewSystem({ mode, colorChanges, onResetChanges, onApplyChanges }: ColorPreviewSystemProps) {
  const [previewMode, setPreviewMode] = useState<'split' | 'before' | 'after'>('split')
  
  // Get original colors
  const originalColors = brandColors[mode]
  
  // Apply changes to create new color set
  const modifiedColors = { ...originalColors }
  Object.entries(colorChanges).forEach(([token, newColor]) => {
    if (token in modifiedColors) {
      (modifiedColors as any)[token] = newColor
    }
  })
  
  const hasChanges = Object.keys(colorChanges).length > 0
  const changeCount = Object.keys(colorChanges).length
  
  return (
    <YStack gap="$4">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <H3>Color Preview System</H3>
          <XStack gap="$2">
            <Text fontSize="$3" color="$textSecondary">
              {changeCount} {changeCount === 1 ? 'change' : 'changes'} pending
            </Text>
            {hasChanges && (
              <>
                <Button size="$3" variant="outlined" onPress={onResetChanges}>
                  Reset
                </Button>
                <Button size="$3" backgroundColor="$success" color="$successForeground" onPress={onApplyChanges}>
                  Apply Changes
                </Button>
              </>
            )}
          </XStack>
        </XStack>
        
        <Text color="$textSecondary" fontSize="$3">
          See how your color changes affect real site components. Switch between views to compare.
        </Text>
        
        {/* View Mode Controls */}
        <XStack gap="$2" backgroundColor="$backgroundTertiary" padding="$2" borderRadius="$3">
          <Button
            size="$3"
            variant={previewMode === 'split' ? 'outlined' : undefined}
            onPress={() => setPreviewMode('split')}
            flex={1}
          >
            Split View
          </Button>
          <Button
            size="$3"
            variant={previewMode === 'before' ? 'outlined' : undefined}
            onPress={() => setPreviewMode('before')}
            flex={1}
          >
            Current
          </Button>
          <Button
            size="$3"
            variant={previewMode === 'after' ? 'outlined' : undefined}
            onPress={() => setPreviewMode('after')}
            flex={1}
          >
            Preview
          </Button>
        </XStack>
      </YStack>
      
      {/* Changed Colors Summary */}
      {hasChanges && (
        <YStack gap="$2" backgroundColor="$backgroundSecondary" padding="$3" borderRadius="$3">
          <H4>Pending Changes</H4>
          <YStack gap="$2">
            {Object.entries(colorChanges).map(([token, newColor]) => (
              <XStack key={token} justifyContent="space-between" alignItems="center">
                <Text fontSize="$3" fontWeight="600">{token}</Text>
                <XStack gap="$2" alignItems="center">
                  <View
                    width={20}
                    height={20}
                    backgroundColor={(originalColors as any)[token]}
                    borderRadius="$1"
                    borderWidth={1}
                    borderColor="$border"
                  />
                  <Text fontSize="$2">→</Text>
                  <View
                    width={20}
                    height={20}
                    backgroundColor={newColor}
                    borderRadius="$1"
                    borderWidth={1}
                    borderColor="$border"
                  />
                  <Text fontFamily="$body" fontSize="$2" color="$textSecondary">
                    {newColor}
                  </Text>
                </XStack>
              </XStack>
            ))}
          </YStack>
        </YStack>
      )}
      
      {/* Preview Content */}
      <ScrollView maxHeight={600}>
        {previewMode === 'split' && (
          <XStack gap="$4">
            <YStack flex={1} gap="$3">
              <SiteExamples colors={originalColors} title="Current Colors" />
            </YStack>
            <View width={1} backgroundColor="$border" />
            <YStack flex={1} gap="$3">
              <SiteExamples colors={modifiedColors} title="With Your Changes" />
            </YStack>
          </XStack>
        )}
        
        {previewMode === 'before' && (
          <SiteExamples colors={originalColors} title="Current Colors" />
        )}
        
        {previewMode === 'after' && (
          <SiteExamples colors={modifiedColors} title="Preview with Changes" />
        )}
      </ScrollView>
      
      {/* Usage Examples */}
      {hasChanges && (
        <YStack gap="$2" backgroundColor="$backgroundTertiary" padding="$3" borderRadius="$3">
          <H4>Implementation Notes</H4>
          <Text fontSize="$3" color="$textSecondary">
            When you apply these changes, they will be saved to your brand configuration. 
            You can then integrate them into your Tamagui theme configuration.
          </Text>
          <YStack gap="$1" marginTop="$2">
            {Object.entries(colorChanges).map(([token, newColor]) => (
              <Text key={token} fontFamily="$body" fontSize="$2" color="$textTertiary">
                {token}: '{newColor}'
              </Text>
            ))}
          </YStack>
        </YStack>
      )}
      
      {!hasChanges && (
        <YStack gap="$2" backgroundColor="$backgroundSecondary" padding="$4" borderRadius="$3" alignItems="center">
          <Text fontSize="$4" color="$textSecondary">No changes yet</Text>
          <Text fontSize="$3" color="$textTertiary" textAlign="center">
            Use the color picker above to modify colors and see live preview here.
          </Text>
        </YStack>
      )}
    </YStack>
  )
}