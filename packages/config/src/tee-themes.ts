import { createThemeBuilder } from '@tamagui/theme-builder'
import { tokens } from '@tamagui/config/v3'

// Brand colors from our existing system
const brandColors = {
  light: {
    // Primary colors - Deep blue with religious/trustworthy feel
    primary: '#1B365D', // Rich navy blue
    primaryForeground: '#FFFFFF',
    
    // Secondary colors - Warm gold/amber for warmth and tradition
    secondary: '#B8860B', // Dark goldenrod
    secondaryForeground: '#FFFFFF',
    
    // Accent colors - Sage green for peace and growth
    accent: '#6B8E5A', // Sage green
    accentForeground: '#FFFFFF',
    
    // Semantic colors - Enhanced for accessibility
    success: '#2D7D32', // Darker green
    successForeground: '#FFFFFF',
    warning: '#E65100', // Darker orange
    warningForeground: '#FFFFFF',
    error: '#C62828', // Darker red
    errorForeground: '#FFFFFF',
    info: '#1565C0', // Darker blue
    infoForeground: '#FFFFFF',
    
    // Text colors - High contrast hierarchy
    textPrimary: '#1A1A1A', // Near black
    textSecondary: '#4A4A4A', // Dark gray
    textTertiary: '#6B6B6B', // Medium gray
    textDisabled: '#A8A8A8', // Light gray
    
    // Background colors - Warm and welcoming
    background: '#FEFEFE', // Off-white
    backgroundSecondary: '#F8F6F0', // Warm light gray
    backgroundTertiary: '#F2F0E8', // Slightly warmer
    
    // Surface colors
    surface: '#FFFFFF',
    surfaceSecondary: '#F8F6F0',
    
    // Border colors
    border: '#D0CFC4', // Warm gray border
    borderLight: '#E8E6DD', // Very light warm border
    
    // Interactive colors
    interactive: '#1B365D',
    interactiveHover: '#2A4A73',
    interactivePressed: '#153056',
    interactiveDisabled: '#D0CFC4',
    
    // Primary interaction states
    primaryHover: '#2A4A73',
    primaryPressed: '#153056',
  },
  
  dark: {
    // Primary colors - Bright enough for dark mode
    primary: '#4A90E2', // Bright blue
    primaryForeground: '#000000',
    
    // Secondary colors - Warm gold that pops
    secondary: '#FFB000', // Bright gold
    secondaryForeground: '#000000',
    
    // Accent colors - Fresh green
    accent: '#8BC34A', // Light green
    accentForeground: '#000000',
    
    // Semantic colors - Bright and accessible
    success: '#4CAF50', // Material green
    successForeground: '#000000',
    warning: '#FF9800', // Material orange
    warningForeground: '#000000',
    error: '#F44336', // Material red
    errorForeground: '#FFFFFF',
    info: '#2196F3', // Material blue
    infoForeground: '#000000',
    
    // Text colors - Excellent contrast for dark mode
    textPrimary: '#FFFFFF', // Pure white
    textSecondary: '#E0E0E0', // Light gray
    textTertiary: '#B0B0B0', // Medium gray
    textDisabled: '#666666', // Darker gray
    
    // Background colors - Rich and warm dark tones
    background: '#0D1117', // Rich dark blue-black
    backgroundSecondary: '#161B22', // Slightly lighter
    backgroundTertiary: '#21262D', // Medium dark
    
    // Surface colors
    surface: '#161B22',
    surfaceSecondary: '#21262D',
    
    // Border colors
    border: '#30363D', // Subtle gray border
    borderLight: '#21262D', // Very subtle
    
    // Interactive colors
    interactive: '#4A90E2',
    interactiveHover: '#5BA0F2',
    interactivePressed: '#3A80D2',
    interactiveDisabled: '#30363D',
    
    // Primary interaction states
    primaryHover: '#5BA0F2',
    primaryPressed: '#3A80D2',
  }
} as const

// Create TEE-specific themes based on our brand colors
export const teeThemes = {
  light: {
    // Base Tamagui theme properties
    background: brandColors.light.background,
    backgroundHover: brandColors.light.backgroundSecondary,
    backgroundPress: brandColors.light.backgroundTertiary,
    backgroundFocus: brandColors.light.backgroundSecondary,
    backgroundStrong: brandColors.light.surface,
    backgroundTransparent: 'transparent',
    
    color: brandColors.light.textPrimary,
    colorHover: brandColors.light.textSecondary,
    colorPress: brandColors.light.textPrimary,
    colorFocus: brandColors.light.textPrimary,
    colorTransparent: 'transparent',
    
    borderColor: brandColors.light.border,
    borderColorHover: brandColors.light.borderLight,
    borderColorPress: brandColors.light.border,
    borderColorFocus: brandColors.light.primary,
    
    placeholderColor: brandColors.light.textTertiary,
    
    // Brand-specific tokens
    primary: brandColors.light.primary,
    primaryHover: brandColors.light.primaryHover,
    primaryPress: brandColors.light.primaryPressed,
    primaryForeground: brandColors.light.primaryForeground,
    
    secondary: brandColors.light.secondary,
    secondaryHover: brandColors.light.secondary,
    secondaryPress: brandColors.light.secondary,
    secondaryForeground: brandColors.light.secondaryForeground,
    
    accent: brandColors.light.accent,
    accentHover: brandColors.light.accent,
    accentPress: brandColors.light.accent,
    accentForeground: brandColors.light.accentForeground,
    
    success: brandColors.light.success,
    successForeground: brandColors.light.successForeground,
    warning: brandColors.light.warning,
    warningForeground: brandColors.light.warningForeground,
    error: brandColors.light.error,
    errorForeground: brandColors.light.errorForeground,
    info: brandColors.light.info,
    infoForeground: brandColors.light.infoForeground,
    
    // Text hierarchy
    textPrimary: brandColors.light.textPrimary,
    textSecondary: brandColors.light.textSecondary,
    textTertiary: brandColors.light.textTertiary,
    textDisabled: brandColors.light.textDisabled,
    
    // Interactive states
    interactive: brandColors.light.interactive,
    interactiveHover: brandColors.light.interactiveHover,
    interactivePress: brandColors.light.interactivePressed,
    interactiveDisabled: brandColors.light.interactiveDisabled,
  },
  
  dark: {
    // Base Tamagui theme properties
    background: brandColors.dark.background,
    backgroundHover: brandColors.dark.backgroundSecondary,
    backgroundPress: brandColors.dark.backgroundTertiary,
    backgroundFocus: brandColors.dark.backgroundSecondary,
    backgroundStrong: brandColors.dark.surface,
    backgroundTransparent: 'transparent',
    
    color: brandColors.dark.textPrimary,
    colorHover: brandColors.dark.textSecondary,
    colorPress: brandColors.dark.textPrimary,
    colorFocus: brandColors.dark.textPrimary,
    colorTransparent: 'transparent',
    
    borderColor: brandColors.dark.border,
    borderColorHover: brandColors.dark.borderLight,
    borderColorPress: brandColors.dark.border,
    borderColorFocus: brandColors.dark.primary,
    
    placeholderColor: brandColors.dark.textTertiary,
    
    // Brand-specific tokens
    primary: brandColors.dark.primary,
    primaryHover: brandColors.dark.primaryHover,
    primaryPress: brandColors.dark.primaryPressed,
    primaryForeground: brandColors.dark.primaryForeground,
    
    secondary: brandColors.dark.secondary,
    secondaryHover: brandColors.dark.secondary,
    secondaryPress: brandColors.dark.secondary,
    secondaryForeground: brandColors.dark.secondaryForeground,
    
    accent: brandColors.dark.accent,
    accentHover: brandColors.dark.accent,
    accentPress: brandColors.dark.accent,
    accentForeground: brandColors.dark.accentForeground,
    
    success: brandColors.dark.success,
    successForeground: brandColors.dark.successForeground,
    warning: brandColors.dark.warning,
    warningForeground: brandColors.dark.warningForeground,
    error: brandColors.dark.error,
    errorForeground: brandColors.dark.errorForeground,
    info: brandColors.dark.info,
    infoForeground: brandColors.dark.infoForeground,
    
    // Text hierarchy
    textPrimary: brandColors.dark.textPrimary,
    textSecondary: brandColors.dark.textSecondary,
    textTertiary: brandColors.dark.textTertiary,
    textDisabled: brandColors.dark.textDisabled,
    
    // Interactive states
    interactive: brandColors.dark.interactive,
    interactiveHover: brandColors.dark.interactiveHover,
    interactivePress: brandColors.dark.interactivePressed,
    interactiveDisabled: brandColors.dark.interactiveDisabled,
  }
} as const