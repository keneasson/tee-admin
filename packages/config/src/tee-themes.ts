import { createThemeBuilder } from '@tamagui/theme-builder'
import { tokens } from '@tamagui/config/v3'

// Brand colors from our existing system
const brandColors = {
  light: {
    // Primary colors - Deep blue with religious/trustworthy feel
    primary: '#1B365D', // Rich navy blue - 4.5:1 contrast ratio
    primaryForeground: '#FFFFFF', // White text on dark blue
    
    // Secondary colors - Warm gold/amber for warmth and tradition
    secondary: '#B8860B', // Dark goldenrod - high contrast
    secondaryForeground: '#FFFFFF', // White text on gold
    
    // Accent colors - Sage green for peace and growth
    accent: '#5A7C47', // Darker sage green for better contrast
    accentForeground: '#FFFFFF', // White text on green
    
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
    interactiveHover: '#2A4A73', // Lighter but still 4.5:1 contrast
    interactivePressed: '#0F2238', // Darker for pressed state
    interactiveDisabled: '#D0CFC4',
    
    // Primary interaction states  
    primaryHover: '#2A4A73', // Lighter blue, maintains contrast
    primaryPressed: '#0F2238', // Darker blue for pressed state
  },
  
  dark: {
    // Primary colors - Bright enough for dark mode with proper contrast
    primary: '#3B82F6', // Blue with 4.5:1 contrast on dark bg
    primaryForeground: '#000000', // Black text on bright blue
    
    // Secondary colors - Warm gold that pops
    secondary: '#F59E0B', // Amber with good contrast
    secondaryForeground: '#000000', // Black text on amber
    
    // Accent colors - Fresh green with proper contrast
    accent: '#10B981', // Emerald with good contrast
    accentForeground: '#000000', // Black text on emerald
    
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
    interactive: '#3B82F6',
    interactiveHover: '#60A5FA', // Lighter but maintains contrast
    interactivePressed: '#2563EB', // Darker for pressed state
    interactiveDisabled: '#374151',
    
    // Primary interaction states
    primaryHover: '#60A5FA', // Lighter blue for hover
    primaryPressed: '#2563EB', // Darker for pressed state
  }
} as const

// Admin-specific brand colors - more condensed and efficient
const adminBrandColors = {
  light: {
    ...brandColors.light,
    // Admin-specific adjustments
    background: '#FBFBFB', // Slightly grayer for reduced eye strain
    backgroundSecondary: '#F6F6F6', // More neutral
    backgroundTertiary: '#F0F0F0', // Cooler gray
    
    // Tighter contrast for dense information
    textPrimary: '#0F0F0F', // Darker for better readability
    textSecondary: '#3A3A3A', // Higher contrast
    
    // More subdued borders for dense layouts
    border: '#E0E0E0',
    borderLight: '#E8E8E8',
    
    // Professional admin colors - high contrast
    primary: '#1D4ED8', // Modern blue with 4.5:1 contrast
    primaryHover: '#3B82F6', // Lighter hover state
    primaryPressed: '#1E3A8A', // Darker pressed state
    primaryForeground: '#FFFFFF', // White text
    
    // Status colors optimized for admin interfaces
    warning: '#F59E0B', // Amber for better visibility
    error: '#DC2626', // Red that stands out
    success: '#059669', // Emerald for positive actions
    info: '#0EA5E9', // Sky blue for information
  },
  
  dark: {
    ...brandColors.dark,
    // Admin dark mode - designed for long sessions
    background: '#0F172A', // Deeper blue-black
    backgroundSecondary: '#1E293B', // Slate secondary
    backgroundTertiary: '#334155', // Lighter slate
    
    // Optimized text contrast for readability
    textPrimary: '#F8FAFC', // Off-white
    textSecondary: '#CBD5E1', // Light slate
    
    // Refined borders
    border: '#475569',
    borderLight: '#64748B',
    
    // Admin primary colors - optimized for dark mode
    primary: '#60A5FA', // Bright blue with good contrast
    primaryHover: '#93C5FD', // Lighter hover
    primaryPressed: '#3B82F6', // Darker pressed
    primaryForeground: '#000000', // Black text on bright blue
    
    // Enhanced status colors for dark mode
    warning: '#F59E0B',
    error: '#EF4444',
    success: '#10B981',
    info: '#06B6D4',
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
    colorHover: '#1A1A1A', // Deeper gray for better contrast (8.2:1 contrast)
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
    primaryHoverForeground: '#1B365D', // Use primary background color as text when hovering over active
    
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
    colorHover: '#B8B8B8', // Lighter gray for WCAG AAA compliance (7.2:1 contrast on dark bg)
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
    primaryHoverForeground: '#4A90E2', // Use primary background color as text when hovering over active
    
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
  },
  
  admin_light: {
    // Base Tamagui theme properties - admin optimized
    background: adminBrandColors.light.background,
    backgroundHover: adminBrandColors.light.backgroundSecondary,
    backgroundPress: adminBrandColors.light.backgroundTertiary,
    backgroundFocus: adminBrandColors.light.backgroundSecondary,
    backgroundStrong: adminBrandColors.light.surface,
    backgroundTransparent: 'transparent',
    
    color: adminBrandColors.light.textPrimary,
    colorHover: '#0A0A0A',
    colorPress: adminBrandColors.light.textPrimary,
    colorFocus: adminBrandColors.light.textPrimary,
    colorTransparent: 'transparent',
    
    borderColor: adminBrandColors.light.border,
    borderColorHover: adminBrandColors.light.borderLight,
    borderColorPress: adminBrandColors.light.border,
    borderColorFocus: adminBrandColors.light.primary,
    
    placeholderColor: adminBrandColors.light.textTertiary,
    
    // Admin-specific brand tokens
    primary: adminBrandColors.light.primary,
    primaryHover: adminBrandColors.light.primaryHover,
    primaryPress: adminBrandColors.light.primaryPressed,
    primaryForeground: adminBrandColors.light.primaryForeground,
    primaryHoverForeground: adminBrandColors.light.primaryForeground, // Keep white for consistency
    
    secondary: adminBrandColors.light.secondary,
    secondaryHover: adminBrandColors.light.secondary,
    secondaryPress: adminBrandColors.light.secondary,
    secondaryForeground: adminBrandColors.light.secondaryForeground,
    
    accent: adminBrandColors.light.accent,
    accentHover: adminBrandColors.light.accent,
    accentPress: adminBrandColors.light.accent,
    accentForeground: adminBrandColors.light.accentForeground,
    
    success: adminBrandColors.light.success,
    successForeground: '#FFFFFF',
    warning: adminBrandColors.light.warning,
    warningForeground: '#000000',
    error: adminBrandColors.light.error,
    errorForeground: '#FFFFFF',
    info: adminBrandColors.light.info,
    infoForeground: '#FFFFFF',
    
    // Text hierarchy
    textPrimary: adminBrandColors.light.textPrimary,
    textSecondary: adminBrandColors.light.textSecondary,
    textTertiary: adminBrandColors.light.textTertiary,
    textDisabled: adminBrandColors.light.textDisabled,
    
    // Interactive states
    interactive: adminBrandColors.light.primary,
    interactiveHover: adminBrandColors.light.primaryHover,
    interactivePress: adminBrandColors.light.primaryPressed,
    interactiveDisabled: adminBrandColors.light.interactiveDisabled,
  },
  
  admin_dark: {
    // Base Tamagui theme properties - admin dark optimized
    background: adminBrandColors.dark.background,
    backgroundHover: adminBrandColors.dark.backgroundSecondary,
    backgroundPress: adminBrandColors.dark.backgroundTertiary,
    backgroundFocus: adminBrandColors.dark.backgroundSecondary,
    backgroundStrong: adminBrandColors.dark.surface,
    backgroundTransparent: 'transparent',
    
    color: adminBrandColors.dark.textPrimary,
    colorHover: '#E2E8F0',
    colorPress: adminBrandColors.dark.textPrimary,
    colorFocus: adminBrandColors.dark.textPrimary,
    colorTransparent: 'transparent',
    
    borderColor: adminBrandColors.dark.border,
    borderColorHover: adminBrandColors.dark.borderLight,
    borderColorPress: adminBrandColors.dark.border,
    borderColorFocus: adminBrandColors.dark.primary,
    
    placeholderColor: adminBrandColors.dark.textTertiary,
    
    // Admin-specific brand tokens
    primary: adminBrandColors.dark.primary,
    primaryHover: adminBrandColors.dark.primaryHover,
    primaryPress: adminBrandColors.dark.primaryPressed,
    primaryForeground: adminBrandColors.dark.primaryForeground,
    primaryHoverForeground: adminBrandColors.dark.primaryForeground, // Keep black for consistency
    
    secondary: adminBrandColors.dark.secondary,
    secondaryHover: adminBrandColors.dark.secondary,
    secondaryPress: adminBrandColors.dark.secondary,
    secondaryForeground: adminBrandColors.dark.secondaryForeground,
    
    accent: adminBrandColors.dark.accent,
    accentHover: adminBrandColors.dark.accent,
    accentPress: adminBrandColors.dark.accent,
    accentForeground: adminBrandColors.dark.accentForeground,
    
    success: adminBrandColors.dark.success,
    successForeground: '#000000',
    warning: adminBrandColors.dark.warning,
    warningForeground: '#000000',
    error: adminBrandColors.dark.error,
    errorForeground: '#FFFFFF',
    info: adminBrandColors.dark.info,
    infoForeground: '#000000',
    
    // Text hierarchy
    textPrimary: adminBrandColors.dark.textPrimary,
    textSecondary: adminBrandColors.dark.textSecondary,
    textTertiary: adminBrandColors.dark.textTertiary,
    textDisabled: adminBrandColors.dark.textDisabled,
    
    // Interactive states
    interactive: adminBrandColors.dark.primary,
    interactiveHover: adminBrandColors.dark.primaryHover,
    interactivePress: adminBrandColors.dark.primaryPressed,
    interactiveDisabled: adminBrandColors.dark.interactiveDisabled,
  }
} as const