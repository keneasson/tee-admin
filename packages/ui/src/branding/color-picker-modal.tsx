'use client'

import { useState, useCallback, useMemo } from 'react'
import { YStack, XStack, Text, Button, Input, Separator, View, H4, Slider, Dialog, Adapt, Sheet } from '@my/ui'

interface ColorPickerModalProps {
  initialColor: string
  colorName: string
  onColorChange: (color: string) => void
  onClose: () => void
  isOpen: boolean
}

// Convert hex to HSL
const hexToHsl = (hex: string): [number, number, number] => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2

  if (max === min) {
    h = s = 0 // achromatic
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

// Convert HSL to hex
const hslToHex = (h: number, s: number, l: number): string => {
  h = h / 360
  s = s / 100
  l = l / 100

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }

  let r, g, b
  if (s === 0) {
    r = g = b = l // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Generate smart color suggestions based on the current color
const generateSmartSuggestions = (baseColor: string): string[] => {
  const [h, s, l] = hexToHsl(baseColor)
  
  const suggestions: string[] = []
  
  // Lightness variations (keeping hue and saturation)
  for (let i = 10; i <= 90; i += 20) {
    if (Math.abs(i - l) > 10) { // Avoid colors too close to the base
      suggestions.push(hslToHex(h, s, i))
    }
  }
  
  // Saturation variations (keeping hue and lightness)
  for (let i = 20; i <= 100; i += 30) {
    if (Math.abs(i - s) > 15) {
      suggestions.push(hslToHex(h, i, l))
    }
  }
  
  // Hue variations (keeping saturation and lightness similar)
  const hueShifts = [-60, -30, 30, 60, 120, 180]
  hueShifts.forEach(shift => {
    const newHue = (h + shift + 360) % 360
    suggestions.push(hslToHex(newHue, Math.max(30, s), l))
  })
  
  // Complementary and triadic colors
  suggestions.push(hslToHex((h + 180) % 360, s, l)) // Complementary
  suggestions.push(hslToHex((h + 120) % 360, s, l)) // Triadic 1
  suggestions.push(hslToHex((h + 240) % 360, s, l)) // Triadic 2
  
  // Remove duplicates and return first 12
  return Array.from(new Set(suggestions)).slice(0, 12)
}

// Simple hex color validation
const isValidHex = (hex: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

// Calculate contrast ratio for accessibility
const getContrastRatio = (color1: string, color2: string): number => {
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

export function ColorPickerModal({ initialColor, colorName, onColorChange, onClose, isOpen }: ColorPickerModalProps) {
  const [currentColor, setCurrentColor] = useState(initialColor)
  const [hexInput, setHexInput] = useState(initialColor)
  const [isValidInput, setIsValidInput] = useState(true)
  
  // Parse HSL values from current color
  const [h, s, l] = useMemo(() => hexToHsl(currentColor), [currentColor])
  
  const handleColorUpdate = useCallback((newColor: string) => {
    if (isValidHex(newColor)) {
      setCurrentColor(newColor)
      setHexInput(newColor)
      setIsValidInput(true)
    } else {
      setIsValidInput(false)
    }
  }, [])

  const handleHSLChange = useCallback((newH: number, newS: number, newL: number) => {
    const newColor = hslToHex(newH, newS, newL)
    handleColorUpdate(newColor)
  }, [handleColorUpdate])

  const handleHexInputChange = (value: string) => {
    setHexInput(value)
    if (isValidHex(value)) {
      handleColorUpdate(value)
    } else {
      setIsValidInput(false)
    }
  }

  const handleApply = () => {
    if (isValidInput) {
      onColorChange(currentColor)
      onClose()
    }
  }

  const smartSuggestions = useMemo(() => generateSmartSuggestions(currentColor), [currentColor])
  
  // Calculate contrast with common backgrounds
  const contrastWithWhite = getContrastRatio(currentColor, '#FFFFFF')
  const contrastWithBlack = getContrastRatio(currentColor, '#000000')

  const modalContent = (
    <YStack gap="$4" padding="$4" maxWidth={400}>
      <YStack gap="$2">
        <H4>{colorName} Color Picker</H4>
        <Text color="$textSecondary" fontSize="$3">
          Use the sliders or suggestions to find the perfect color.
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
            HSL({h}, {s}%, {l}%)
          </Text>
        </YStack>
      </XStack>
      
      {/* HSL Sliders */}
      <YStack gap="$3">
        <Text fontWeight="600">Color Adjustments</Text>
        
        {/* Hue Slider */}
        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <Text fontSize="$3">Hue</Text>
            <Text fontSize="$3" color="$textSecondary">{h}°</Text>
          </XStack>
          <Slider
            value={[h]}
            onValueChange={(value) => handleHSLChange(value[0], s, l)}
            max={360}
            step={1}
            backgroundColor="$backgroundSecondary"
          >
            <Slider.Track backgroundColor="$borderLight">
              <Slider.TrackActive backgroundColor="$primary" />
            </Slider.Track>
            <Slider.Thumb size="$1" index={0} backgroundColor="$primary" />
          </Slider>
        </YStack>
        
        {/* Saturation Slider */}
        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <Text fontSize="$3">Saturation</Text>
            <Text fontSize="$3" color="$textSecondary">{s}%</Text>
          </XStack>
          <Slider
            value={[s]}
            onValueChange={(value) => handleHSLChange(h, value[0], l)}
            max={100}
            step={1}
          >
            <Slider.Track backgroundColor="$borderLight">
              <Slider.TrackActive backgroundColor="$primary" />
            </Slider.Track>
            <Slider.Thumb size="$1" index={0} backgroundColor="$primary" />
          </Slider>
        </YStack>
        
        {/* Lightness Slider */}
        <YStack gap="$2">
          <XStack justifyContent="space-between">
            <Text fontSize="$3">Lightness</Text>
            <Text fontSize="$3" color="$textSecondary">{l}%</Text>
          </XStack>
          <Slider
            value={[l]}
            onValueChange={(value) => handleHSLChange(h, s, value[0])}
            max={100}
            step={1}
          >
            <Slider.Track backgroundColor="$borderLight">
              <Slider.TrackActive backgroundColor="$primary" />
            </Slider.Track>
            <Slider.Thumb size="$1" index={0} backgroundColor="$primary" />
          </Slider>
        </YStack>
      </YStack>
      
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
        </XStack>
        {!isValidInput && (
          <Text color="$error" fontSize="$2">
            Please enter a valid hex color (e.g., #FF0000 or #F00)
          </Text>
        )}
      </YStack>
      
      {/* Smart Color Suggestions */}
      <YStack gap="$2">
        <Text fontWeight="600">Smart Suggestions</Text>
        <Text fontSize="$2" color="$textSecondary">
          Based on your current color's hue, saturation, and brightness
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {smartSuggestions.map((suggestedColor, index) => (
            <Button
              key={index}
              size="$3"
              backgroundColor={suggestedColor}
              borderWidth={2}
              borderColor={currentColor === suggestedColor ? '$primary' : '$border'}
              onPress={() => handleColorUpdate(suggestedColor)}
              width={36}
              height={36}
              borderRadius="$2"
              pressStyle={{ scale: 0.9 }}
            />
          ))}
        </XStack>
      </YStack>
      
      <Separator />
      
      {/* Accessibility Information */}
      <YStack gap="$2">
        <Text fontWeight="600">Accessibility</Text>
        
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$3">On White:</Text>
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
          <Text fontSize="$3">On Black:</Text>
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
        
        <Text fontSize="$2" color="$textSecondary">
          4.5:1 minimum for WCAG AA compliance
        </Text>
      </YStack>
      
      {/* Action Buttons */}
      <XStack gap="$2" justifyContent="flex-end">
        <Button variant="outlined" onPress={onClose}>
          Cancel
        </Button>
        <Button 
          backgroundColor="$primary" 
          color="$primaryForeground" 
          onPress={handleApply}
          disabled={!isValidInput}
        >
          Apply Color
        </Button>
      </XStack>
    </YStack>
  )

  return (
    <Dialog modal open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        
        <Dialog.Content
          bordered
          elevate
          key="content"
          animateOnly={['transform', 'opacity']}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          maxWidth={450}
        >
          {modalContent}
        </Dialog.Content>
      </Dialog.Portal>
      
      {/* Mobile Adaptation */}
      <Adapt when="sm" platform="touch">
        <Sheet
          modal
          dismissOnSnapToBottom
          open={isOpen}
          onOpenChange={(open: boolean) => !open && onClose()}
        >
          <Sheet.Frame padding="$4" space="$4">
            <Sheet.Handle />
            {modalContent}
          </Sheet.Frame>
          <Sheet.Overlay />
        </Sheet>
      </Adapt>
    </Dialog>
  )
}