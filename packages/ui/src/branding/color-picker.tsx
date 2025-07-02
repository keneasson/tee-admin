'use client'

import { useState, useCallback } from 'react'
import { YStack, XStack, Text, H3, H4, Button, Input, Separator, View, ScrollView } from '@my/ui'
import { brandColors } from './brand-colors'

interface ColorPickerProps {
  initialColor: string
  colorName: string
  onColorChange: (color: string) => void
  colorCategory: string
}

// Simple hex color validation
const isValidHex = (hex: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)
}

// Convert hex to RGB for calculations
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

// Calculate luminance for contrast ratio
const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const val = c / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

// Calculate contrast ratio
const getContrastRatio = (color1: string, color2: string): number => {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) return 0
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)
  
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  
  return (brightest + 0.05) / (darkest + 0.05)
}

export function ColorPicker({ initialColor, colorName, onColorChange, colorCategory }: ColorPickerProps) {
  const [currentColor, setCurrentColor] = useState(initialColor)
  const [hexInput, setHexInput] = useState(initialColor)
  const [isValidInput, setIsValidInput] = useState(true)
  
  const handleColorChange = useCallback((newColor: string) => {
    if (isValidHex(newColor)) {
      setCurrentColor(newColor)
      setHexInput(newColor)
      onColorChange(newColor)
      setIsValidInput(true)
    } else {
      setIsValidInput(false)
    }
  }, [onColorChange])
  
  const handleHexInputChange = (value: string) => {
    setHexInput(value)
    if (isValidHex(value)) {
      handleColorChange(value)
    } else {
      setIsValidInput(false)
    }
  }
  
  // Quick color suggestions based on category
  const getColorSuggestions = (category: string) => {
    switch (category) {
      case 'primary':
        return ['#1B365D', '#0066CC', '#004080', '#2B4A6B', '#003D5C']
      case 'secondary':
        return ['#B8860B', '#DAA520', '#FF8C00', '#CD853F', '#D2691E']
      case 'accent':
        return ['#6B8E5A', '#7CB342', '#8BC34A', '#689F38', '#558B2F']
      case 'success':
        return ['#2D7D32', '#4CAF50', '#66BB6A', '#388E3C', '#2E7D32']
      case 'warning':
        return ['#E65100', '#FF9800', '#FFA726', '#F57C00', '#EF6C00']
      case 'error':
        return ['#C62828', '#F44336', '#E53935', '#D32F2F', '#C62828']
      default:
        return ['#1B365D', '#B8860B', '#6B8E5A', '#2D7D32', '#E65100']
    }
  }
  
  const suggestions = getColorSuggestions(colorCategory)
  
  // Calculate contrast with common backgrounds
  const contrastWithWhite = getContrastRatio(currentColor, '#FFFFFF')
  const contrastWithBlack = getContrastRatio(currentColor, '#000000')
  const contrastWithLightBg = getContrastRatio(currentColor, '#F8F6F0')
  const contrastWithDarkBg = getContrastRatio(currentColor, '#0D1117')
  
  return (
    <YStack gap="$4" padding="$4" backgroundColor="$backgroundSecondary" borderRadius="$4" borderWidth={1} borderColor="$borderLight">
      <YStack gap="$2">
        <H3>{colorName} Color Picker</H3>
        <Text color="$textSecondary" fontSize="$3">
          Adjust the {colorName.toLowerCase()} color and see real-time accessibility feedback.
        </Text>
      </YStack>
      
      {/* Current Color Display */}
      <XStack gap="$4" alignItems="center">
        <View
          width={80}
          height={80}
          backgroundColor={currentColor}
          borderRadius="$4"
          borderWidth={2}
          borderColor="$border"
        />
        <YStack gap="$2">
          <Text fontWeight="600">Current Color</Text>
          <Text fontFamily="$body" fontSize="$3">{currentColor}</Text>
          <Text fontSize="$2" color="$textSecondary">
            Category: {colorCategory}
          </Text>
        </YStack>
      </XStack>
      
      {/* Hex Input */}
      <YStack gap="$2">
        <Text fontWeight="600">Hex Color Code</Text>
        <XStack gap="$2" alignItems="center">
          <Input
            value={hexInput}
            onChangeText={handleHexInputChange}
            placeholder="#000000"
            fontFamily="$body"
            borderColor={isValidInput ? '$border' : '$error'}
            flex={1}
          />
          <Button
            size="$3"
            disabled={!isValidInput}
            onPress={() => handleColorChange(hexInput)}
          >
            Apply
          </Button>
        </XStack>
        {!isValidInput && (
          <Text color="$error" fontSize="$2">
            Please enter a valid hex color (e.g., #FF0000 or #F00)
          </Text>
        )}
      </YStack>
      
      {/* Color Suggestions */}
      <YStack gap="$2">
        <Text fontWeight="600">Suggested Colors</Text>
        <XStack gap="$2" flexWrap="wrap">
          {suggestions.map((suggestedColor, index) => (
            <Button
              key={index}
              size="$3"
              backgroundColor={suggestedColor}
              borderWidth={2}
              borderColor={currentColor === suggestedColor ? '$primary' : '$border'}
              onPress={() => handleColorChange(suggestedColor)}
              width={40}
              height={40}
              borderRadius="$2"
              pressStyle={{ scale: 0.9 }}
            />
          ))}
        </XStack>
      </YStack>
      
      <Separator />
      
      {/* Accessibility Information */}
      <YStack gap="$3">
        <H4>Accessibility Analysis</H4>
        
        <YStack gap="$2">
          <Text fontWeight="600">Contrast Ratios</Text>
          
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$3">On White Background:</Text>
            <XStack gap="$2" alignItems="center">
              <Text fontFamily="$body" fontSize="$3">{contrastWithWhite.toFixed(2)}:1</Text>
              <View
                width={8}
                height={8}
                borderRadius={4}
                backgroundColor={contrastWithWhite >= 4.5 ? '$success' : '$error'}
              />
            </XStack>
          </XStack>
          
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$3">On Black Background:</Text>
            <XStack gap="$2" alignItems="center">
              <Text fontFamily="$body" fontSize="$3">{contrastWithBlack.toFixed(2)}:1</Text>
              <View
                width={8}
                height={8}
                borderRadius={4}
                backgroundColor={contrastWithBlack >= 4.5 ? '$success' : '$error'}
              />
            </XStack>
          </XStack>
          
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$3">On Light Theme:</Text>
            <XStack gap="$2" alignItems="center">
              <Text fontFamily="$body" fontSize="$3">{contrastWithLightBg.toFixed(2)}:1</Text>
              <View
                width={8}
                height={8}
                borderRadius={4}
                backgroundColor={contrastWithLightBg >= 4.5 ? '$success' : '$error'}
              />
            </XStack>
          </XStack>
          
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize="$3">On Dark Theme:</Text>
            <XStack gap="$2" alignItems="center">
              <Text fontFamily="$body" fontSize="$3">{contrastWithDarkBg.toFixed(2)}:1</Text>
              <View
                width={8}
                height={8}
                borderRadius={4}
                backgroundColor={contrastWithDarkBg >= 4.5 ? '$success' : '$error'}
              />
            </XStack>
          </XStack>
        </YStack>
        
        <YStack gap="$1">
          <Text fontSize="$2" color="$textSecondary">
            • <Text fontWeight="600">4.5:1</Text> minimum for WCAG AA normal text
          </Text>
          <Text fontSize="$2" color="$textSecondary">
            • <Text fontWeight="600">3:1</Text> minimum for WCAG AA large text
          </Text>
          <Text fontSize="$2" color="$textSecondary">
            • <Text fontWeight="600">7:1</Text> recommended for WCAG AAA
          </Text>
        </YStack>
      </YStack>
    </YStack>
  )
}