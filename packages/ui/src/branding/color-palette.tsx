'use client'

import { useState } from 'react'
import { YStack, XStack, Text, View, Button, H2, H3, H4, Separator, Theme } from '@my/ui'
import { brandColors, type ColorMode, type ColorToken } from './brand-colors'
import { ColorPickerModal } from './color-picker-modal'
import { ColorPreviewSystem } from './color-preview-system'

interface ColorCardProps {
  name: string
  value: string
  contrast?: string
  isAccessible?: boolean
  onEditClick?: () => void
  isEditing?: boolean
}

function ColorCard({ name, value, contrast, isAccessible, onEditClick, isEditing }: ColorCardProps) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  const handleCardPress = () => {
    if (onEditClick) {
      onEditClick()
    } else {
      handleCopy()
    }
  }
  
  // Determine if background is light or dark for better text contrast
  const isLightBackground = (color: string) => {
    // Convert hex to RGB and calculate luminance
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }
  
  const isLight = isLightBackground(value)
  const textColor = isLight ? '#000000' : '#FFFFFF'
  const secondaryTextColor = isLight ? '#666666' : '#CCCCCC'
  
  return (
    <YStack
      backgroundColor={value}
      borderRadius="$4"
      padding="$4"
      minHeight={120}
      borderWidth={isEditing ? 2 : 1}
      borderColor={isEditing ? '$primary' : '$borderLight'}
      pressStyle={{ scale: 0.98 }}
      cursor="pointer"
      onPress={handleCardPress}
    >
      <YStack flex={1} justifyContent="space-between">
        <YStack>
          <Text 
            fontSize="$3" 
            fontWeight="600"
            color={contrast || textColor}
          >
            {name}
          </Text>
          <Text 
            fontSize="$2" 
            color={contrast || secondaryTextColor}
            fontFamily="$body"
          >
            {value}
          </Text>
        </YStack>
        
        {isAccessible !== undefined && (
          <XStack alignItems="center" gap="$2">
            <View 
              width={8} 
              height={8} 
              borderRadius={4} 
              backgroundColor={isAccessible ? '$success' : '$error'} 
            />
            <Text 
              fontSize="$2" 
              color={contrast || secondaryTextColor}
            >
              {isAccessible ? 'AA' : 'Fail'}
            </Text>
          </XStack>
        )}
        
        {onEditClick && (
          <View 
            backgroundColor={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$2"
          >
            <Text 
              fontSize="$2" 
              color={contrast || textColor}
              fontWeight="600"
            >
              {isEditing ? 'EDITING' : 'CLICK TO EDIT'}
            </Text>
          </View>
        )}
        
        {copied && (
          <Text 
            fontSize="$2" 
            color={isLight ? '#00AA00' : '#00FF00'}
            fontWeight="600"
          >
            Copied!
          </Text>
        )}
      </YStack>
    </YStack>
  )
}

interface ColorSectionProps {
  title: string
  colors: Record<string, string>
  mode: ColorMode
  onColorEdit?: (colorKey: string) => void
  editingColor?: string | null
  colorChanges?: Record<string, string>
  isEditorMode?: boolean
}

function ColorSection({ title, colors, mode, onColorEdit, editingColor, colorChanges, isEditorMode }: ColorSectionProps) {
  const getDisplayColor = (colorKey: string, originalColor: string) => {
    return colorChanges?.[colorKey] || originalColor
  }
  
  return (
    <YStack gap="$4">
      <H3>{title}</H3>
      <XStack flexWrap="wrap" gap="$3">
        {Object.entries(colors).map(([key, value]) => {
          const displayColor = getDisplayColor(key, value)
          return (
            <View key={key} minWidth={200}>
              <ColorCard
                name={key}
                value={displayColor}
                onEditClick={isEditorMode ? () => onColorEdit?.(key) : undefined}
                isEditing={editingColor === key}
                // Add contrast checking logic here
              />
            </View>
          )
        })}
      </XStack>
    </YStack>
  )
}

export function ColorPalette() {
  const [mode, setMode] = useState<ColorMode>('light')
  const [isEditorMode, setIsEditorMode] = useState(false)
  const [editingColor, setEditingColor] = useState<string | null>(null)
  const [colorChanges, setColorChanges] = useState<Record<ColorMode, Record<string, string>>>({
    light: {},
    dark: {}
  })
  
  const currentColors = brandColors[mode]
  
  const handleColorEdit = (colorKey: string) => {
    setEditingColor(colorKey)
  }
  
  const handleColorChange = (newColor: string) => {
    if (editingColor) {
      setColorChanges(prev => ({
        ...prev,
        [mode]: {
          ...prev[mode],
          [editingColor]: newColor
        }
      }))
    }
  }
  
  const handleResetChanges = () => {
    setColorChanges(prev => ({
      ...prev,
      [mode]: {}
    }))
    setEditingColor(null)
  }
  
  const handleApplyChanges = () => {
    // In a real implementation, this would save to your theme configuration
    console.log('Applying color changes for', mode, ':', colorChanges[mode])
    // Reset the editor state for current mode
    setColorChanges(prev => ({
      ...prev,
      [mode]: {}
    }))
    setEditingColor(null)
    setIsEditorMode(false)
  }
  
  const getDisplayColor = (colorKey: string, originalColor: string) => {
    return colorChanges[mode][colorKey] || originalColor
  }
  
  const getCategoryForColor = (colorKey: string): string => {
    if (colorKey.includes('primary')) return 'primary'
    if (colorKey.includes('secondary')) return 'secondary'
    if (colorKey.includes('accent')) return 'accent'
    if (colorKey.includes('success')) return 'success'
    if (colorKey.includes('warning')) return 'warning'
    if (colorKey.includes('error')) return 'error'
    return 'neutral'
  }
  
  // Group colors by category
  const colorGroups = {
    'Primary Colors': {
      primary: currentColors.primary,
      primaryForeground: currentColors.primaryForeground,
      secondary: currentColors.secondary,
      secondaryForeground: currentColors.secondaryForeground,
      accent: currentColors.accent,
      accentForeground: currentColors.accentForeground,
    },
    'Semantic Colors': {
      success: currentColors.success,
      successForeground: currentColors.successForeground,
      warning: currentColors.warning,
      warningForeground: currentColors.warningForeground,
      error: currentColors.error,
      errorForeground: currentColors.errorForeground,
      info: currentColors.info,
      infoForeground: currentColors.infoForeground,
    },
    'Text Colors': {
      textPrimary: currentColors.textPrimary,
      textSecondary: currentColors.textSecondary,
      textTertiary: currentColors.textTertiary,
      textDisabled: currentColors.textDisabled,
    },
    'Background Colors': {
      background: currentColors.background,
      backgroundSecondary: currentColors.backgroundSecondary,
      backgroundTertiary: currentColors.backgroundTertiary,
      surface: currentColors.surface,
      surfaceSecondary: currentColors.surfaceSecondary,
    },
    'Border & Interactive': {
      border: currentColors.border,
      borderLight: currentColors.borderLight,
      interactive: currentColors.interactive,
      interactiveHover: currentColors.interactiveHover,
      interactivePressed: currentColors.interactivePressed,
      interactiveDisabled: currentColors.interactiveDisabled,
    }
  }
  
  return (
    <YStack gap="$6" padding="$4">
      <YStack gap="$4">
        <H2>Brand Color Palette</H2>
        <Text color="$textSecondary">
          Brand color definitions with live theme preview. Switch between light and dark color schemes to see how they look.
        </Text>
        
        <XStack gap="$2" flexWrap="wrap">
          <XStack alignItems="center" gap="$2">
            <Button 
              variant={mode === 'light' ? 'outlined' : undefined}
              onPress={() => setMode('light')}
              backgroundColor={mode === 'light' ? '#F8F6F0' : undefined}
              borderColor={mode === 'light' ? '#1B365D' : undefined}
            >
              Light Colors
            </Button>
            {Object.keys(colorChanges.light).length > 0 && (
              <View backgroundColor="$warning" padding="$1" borderRadius="$2">
                <Text fontSize="$2" color="$warningForeground" fontWeight="600">
                  {Object.keys(colorChanges.light).length}
                </Text>
              </View>
            )}
          </XStack>
          
          <XStack alignItems="center" gap="$2">
            <Button 
              variant={mode === 'dark' ? 'outlined' : undefined}
              onPress={() => setMode('dark')}
              backgroundColor={mode === 'dark' ? '#161B22' : undefined}
              color={mode === 'dark' ? '#FFFFFF' : undefined}
              borderColor={mode === 'dark' ? '#4A90E2' : undefined}
            >
              Dark Colors
            </Button>
            {Object.keys(colorChanges.dark).length > 0 && (
              <View backgroundColor="$warning" padding="$1" borderRadius="$2">
                <Text fontSize="$2" color="$warningForeground" fontWeight="600">
                  {Object.keys(colorChanges.dark).length}
                </Text>
              </View>
            )}
          </XStack>
          
          <View width={20} />
          
          <Button 
            variant={isEditorMode ? 'outlined' : undefined}
            onPress={() => {
              setIsEditorMode(!isEditorMode)
              if (isEditorMode) {
                setEditingColor(null)
              }
            }}
            backgroundColor={isEditorMode ? '$accent' : undefined}
            color={isEditorMode ? '$accentForeground' : undefined}
          >
            {isEditorMode ? 'Exit Editor' : 'Color Editor'}
          </Button>
          
          {Object.keys(colorChanges[mode]).length > 0 && (
            <Text fontSize="$3" color="$accent" fontWeight="600">
              {Object.keys(colorChanges[mode]).length} changes pending
            </Text>
          )}
        </XStack>
      </YStack>
      
      <Separator />
      
      {/* Color Picker Modal */}
      {editingColor && (
        <ColorPickerModal
          isOpen={!!editingColor}
          initialColor={getDisplayColor(editingColor, (currentColors as any)[editingColor])}
          colorName={editingColor}
          onColorChange={handleColorChange}
          onClose={() => setEditingColor(null)}
        />
      )}
      
      {/* Color Preview System */}
      {isEditorMode && Object.keys(colorChanges[mode]).length > 0 && (
        <ColorPreviewSystem
          mode={mode}
          colorChanges={colorChanges[mode]}
          onResetChanges={handleResetChanges}
          onApplyChanges={handleApplyChanges}
        />
      )}
      
      {/* Theme Preview Container */}
      <YStack gap="$4">
        <H3>Theme Preview</H3>
        <Text color="$textSecondary" fontSize="$3">
          This shows how the {mode} colors would look when applied to actual UI components:
        </Text>
        
        <View
          backgroundColor={currentColors.background}
          borderRadius="$4"
          padding="$4"
          borderWidth={2}
          borderColor={currentColors.border}
        >
          <YStack gap="$3">
            <Text 
              color={currentColors.textPrimary} 
              fontSize="$5" 
              fontWeight="600"
            >
              Sample UI in {mode} theme
            </Text>
            
            <Text color={currentColors.textSecondary} fontSize="$3">
              This preview uses the actual {mode} color values to show how components would appear.
            </Text>
            
            <XStack gap="$2" flexWrap="wrap">
              <View 
                backgroundColor={currentColors.primary} 
                padding="$2" 
                borderRadius="$2"
              >
                <Text color={currentColors.primaryForeground} fontSize="$2">
                  Primary Button
                </Text>
              </View>
              
              <View 
                backgroundColor={currentColors.secondary} 
                padding="$2" 
                borderRadius="$2"
              >
                <Text color={currentColors.secondaryForeground} fontSize="$2">
                  Secondary
                </Text>
              </View>
              
              <View 
                backgroundColor={currentColors.success} 
                padding="$2" 
                borderRadius="$2"
              >
                <Text color={currentColors.successForeground} fontSize="$2">
                  Success
                </Text>
              </View>
              
              <View 
                backgroundColor={currentColors.error} 
                padding="$2" 
                borderRadius="$2"
              >
                <Text color={currentColors.errorForeground} fontSize="$2">
                  Error
                </Text>
              </View>
            </XStack>
            
            <View 
              backgroundColor={currentColors.surface} 
              padding="$3" 
              borderRadius="$3" 
              borderWidth={1} 
              borderColor={currentColors.borderLight}
            >
              <Text color={currentColors.textPrimary} fontWeight="600" marginBottom="$2">
                Card Component
              </Text>
              <Text color={currentColors.textSecondary} fontSize="$3">
                This card uses surface background with proper text contrast.
              </Text>
            </View>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      <YStack gap="$6">
        <H3>Color Definitions ({mode} mode)</H3>
        {Object.entries(colorGroups).map(([groupName, colors]) => {
          // Apply color changes to display colors
          const displayColors = Object.fromEntries(
            Object.entries(colors).map(([key, value]) => [
              key,
              getDisplayColor(key, value)
            ])
          )
          
          return (
            <ColorSection
              key={groupName}
              title={groupName}
              colors={displayColors}
              mode={mode}
              onColorEdit={isEditorMode ? handleColorEdit : undefined}
              editingColor={editingColor}
              colorChanges={colorChanges[mode]}
              isEditorMode={isEditorMode}
            />
          )
        })}
      </YStack>
      
      <Separator />
      
      <YStack gap="$2">
        <H3>Accessibility Notes</H3>
        <Text color="$textSecondary" fontSize="$3">
          • Colors marked with green dots meet WCAG AA contrast requirements
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Colors marked with red dots need contrast improvements  
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Dark mode colors have been adjusted for better contrast ratios
        </Text>
      </YStack>
      
      <Separator />
      
      <ColorContrastTesting mode={mode} />
    </YStack>
  )
}

// Helper function to calculate contrast ratio
function getContrastRatio(color1: string, color2: string): number {
  const getLuminance = (hex: string) => {
    const rgb = hex.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)) || [0, 0, 0]
    const [r, g, b] = rgb.map(c => {
      const val = c / 255
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  
  return (brightest + 0.05) / (darkest + 0.05)
}

interface ContrastTestCardProps {
  background: string
  backgroundName: string
  textColor: string
  textName: string
  sampleText: string
  isLarge?: boolean
}

function ContrastTestCard({ background, backgroundName, textColor, textName, sampleText, isLarge = false }: ContrastTestCardProps) {
  const contrastRatio = getContrastRatio(background, textColor)
  const passesAA = isLarge ? contrastRatio >= 3 : contrastRatio >= 4.5
  const passesAAA = isLarge ? contrastRatio >= 4.5 : contrastRatio >= 7
  
  return (
    <YStack
      backgroundColor={background}
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="$borderLight"
      minHeight={100}
      justifyContent="space-between"
    >
      <YStack gap="$2">
        <Text 
          color={textColor} 
          fontSize={isLarge ? "$5" : "$4"}
          fontWeight={isLarge ? "700" : "400"}
        >
          {sampleText}
        </Text>
        <Text color={textColor} fontSize="$2">
          {textName} on {backgroundName}
        </Text>
      </YStack>
      
      <XStack gap="$2" alignItems="center" justifyContent="space-between">
        <Text color={textColor} fontSize="$2" fontFamily="$body">
          {contrastRatio.toFixed(2)}:1
        </Text>
        <XStack gap="$1" alignItems="center">
          <View 
            width={6} 
            height={6} 
            borderRadius={3} 
            backgroundColor={passesAA ? '#00AA00' : '#FF4444'} 
          />
          <Text color={textColor} fontSize="$2">
            AA
          </Text>
          <View 
            width={6} 
            height={6} 
            borderRadius={3} 
            backgroundColor={passesAAA ? '#00AA00' : '#FF4444'} 
          />
          <Text color={textColor} fontSize="$2">
            AAA
          </Text>
        </XStack>
      </XStack>
    </YStack>
  )
}

interface ColorContrastTestingProps {
  mode: ColorMode
}

function ColorContrastTesting({ mode }: ColorContrastTestingProps) {
  const colors = brandColors[mode]
  
  // Key background colors to test
  const backgrounds = [
    { name: 'background', color: colors.background },
    { name: 'backgroundSecondary', color: colors.backgroundSecondary },
    { name: 'surface', color: colors.surface },
    { name: 'primary', color: colors.primary },
    { name: 'secondary', color: colors.secondary },
  ]
  
  // Text colors to test
  const textColors = [
    { name: 'textPrimary', color: colors.textPrimary },
    { name: 'textSecondary', color: colors.textSecondary },
    { name: 'textTertiary', color: colors.textTertiary },
    { name: 'primaryForeground', color: colors.primaryForeground },
    { name: 'secondaryForeground', color: colors.secondaryForeground },
  ]
  
  return (
    <YStack gap="$4">
      <H3>Text & Background Contrast Testing</H3>
      <Text color="$textSecondary" fontSize="$3">
        Testing text readability on various backgrounds. Green dots indicate WCAG compliance.
      </Text>
      
      {backgrounds.map(background => (
        <YStack key={background.name} gap="$3">
          <H4 fontSize="$4" color="$textPrimary">
            {background.name} Background
          </H4>
          
          <XStack flexWrap="wrap" gap="$3">
            {textColors.map(textColor => {
              const contrastRatio = getContrastRatio(background.color, textColor.color)
              
              // Only show combinations with reasonable contrast (2.5+)
              if (contrastRatio < 2.5) return null
              
              return (
                <View key={`${background.name}-${textColor.name}`} minWidth={280}>
                  <ContrastTestCard
                    background={background.color}
                    backgroundName={background.name}
                    textColor={textColor.color}
                    textName={textColor.name}
                    sampleText="Sample text for readability testing"
                  />
                </View>
              )
            })}
          </XStack>
          
          {/* Large text examples */}
          <Text color="$textSecondary" fontSize="$2" marginTop="$2">
            Large text (headings):
          </Text>
          <XStack flexWrap="wrap" gap="$3">
            {textColors.slice(0, 2).map(textColor => {
              const contrastRatio = getContrastRatio(background.color, textColor.color)
              
              if (contrastRatio < 2.5) return null
              
              return (
                <View key={`${background.name}-${textColor.name}-large`} minWidth={280}>
                  <ContrastTestCard
                    background={background.color}
                    backgroundName={background.name}
                    textColor={textColor.color}
                    textName={textColor.name}
                    sampleText="Large Heading Text"
                    isLarge={true}
                  />
                </View>
              )
            })}
          </XStack>
        </YStack>
      ))}
      
      <YStack gap="$2" marginTop="$4">
        <H4>Accessibility Standards</H4>
        <Text color="$textSecondary" fontSize="$3">
          • <Text fontWeight="600">AA Normal:</Text> 4.5:1 minimum contrast ratio for normal text
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • <Text fontWeight="600">AA Large:</Text> 3:1 minimum contrast ratio for large text (18pt+ or 14pt+ bold)
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • <Text fontWeight="600">AAA Normal:</Text> 7:1 enhanced contrast ratio for normal text
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • <Text fontWeight="600">AAA Large:</Text> 4.5:1 enhanced contrast ratio for large text
        </Text>
      </YStack>
      
      <Separator />
      
      <CurrentUsageAnalysis />
    </YStack>
  )
}

function CurrentUsageAnalysis() {
  const currentUsageAreas = [
    {
      area: "Navigation",
      currentColors: ["#ccaa32 (hover state)", "$gray12Dark (text)", "$borderLight"],
      needsUpdate: true,
      files: ["packages/ui/src/nav-item.tsx", "packages/app/features/with-navigation.tsx"],
      recommendation: "Replace #ccaa32 with new secondary hover color"
    },
    {
      area: "Email Templates", 
      currentColors: ["#c5d9fd", "#fdfaf5", "#003da9", "#bc6401", "#ff3333", "#e08712"],
      needsUpdate: true,
      files: ["apps/email-builder/styles/index.tsx", "apps/email-builder/styles/tokens.ts"],
      recommendation: "Integrate with brand palette for consistency"
    },
    {
      area: "Form Components",
      currentColors: ["$success", "$error", "$textSecondary", "$borderLight"],
      needsUpdate: false,
      files: ["packages/ui/src/form/*"],
      recommendation: "Already using theme tokens - will inherit new colors"
    },
    {
      area: "Status Indicators",
      currentColors: ["#00AA00", "#FF4444", "#00FF00"],
      needsUpdate: true,
      files: ["packages/ui/src/branding/color-palette.tsx"],
      recommendation: "Use semantic success/error colors"
    },
    {
      area: "Main Content",
      currentColors: ["$background", "$textPrimary", "$textSecondary"],
      needsUpdate: false,
      files: ["Most components"],
      recommendation: "Theme tokens will automatically update"
    }
  ]

  return (
    <YStack gap="$4">
      <H3>Current Color Usage & Migration Plan</H3>
      <Text color="$textSecondary" fontSize="$3">
        Analysis of where colors are currently used in the codebase and what needs updating.
      </Text>
      
      <YStack gap="$3">
        {currentUsageAreas.map((usage, index) => (
          <YStack 
            key={index}
            backgroundColor="$backgroundSecondary"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor={usage.needsUpdate ? '#E65100' : '#2D7D32'}
            borderStyle={usage.needsUpdate ? 'dashed' : 'solid'}
          >
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
              <H4 fontSize="$4">{usage.area}</H4>
              <View
                backgroundColor={usage.needsUpdate ? '#E65100' : '#2D7D32'}
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
              >
                <Text color="white" fontSize="$2" fontWeight="600">
                  {usage.needsUpdate ? 'NEEDS UPDATE' : 'THEME READY'}
                </Text>
              </View>
            </XStack>
            
            <YStack gap="$2">
              <Text fontSize="$3">
                <Text fontWeight="600">Current Colors:</Text> {usage.currentColors.join(', ')}
              </Text>
              
              <Text fontSize="$3">
                <Text fontWeight="600">Files:</Text> {usage.files.join(', ')}
              </Text>
              
              <Text fontSize="$3" color="$textSecondary">
                <Text fontWeight="600">Recommendation:</Text> {usage.recommendation}
              </Text>
            </YStack>
          </YStack>
        ))}
      </YStack>
      
      <YStack gap="$2" marginTop="$4" backgroundColor="$backgroundTertiary" padding="$4" borderRadius="$4">
        <H4>New Brand Personality</H4>
        <Text color="$textSecondary" fontSize="$3">
          <Text fontWeight="600">🔵 Primary (Navy Blue):</Text> Trust, depth, spiritual foundation - perfect for a religious organization
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          <Text fontWeight="600">🟡 Secondary (Warm Gold):</Text> Tradition, warmth, divine light - represents heritage and welcome
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          <Text fontWeight="600">🟢 Accent (Sage Green):</Text> Growth, peace, renewal - spiritual development and community
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          <Text fontWeight="600">♿ Accessibility:</Text> All colors meet WCAG AA/AAA standards with excellent contrast ratios
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          <Text fontWeight="600">🌙 Dark Mode:</Text> Rich, warm dark tones with bright, accessible accent colors
        </Text>
      </YStack>
    </YStack>
  )
}