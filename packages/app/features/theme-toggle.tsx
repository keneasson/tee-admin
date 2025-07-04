import React from 'react'
import { Button, useTheme, useThemeName } from 'tamagui'
import { Sun, Moon } from '@tamagui/lucide-icons'

export interface ThemeToggleProps {
  onThemeChange?: (theme: 'light' | 'dark') => void
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ onThemeChange }) => {
  const theme = useTheme()
  const themeName = useThemeName()
  
  const isDark = themeName.includes('dark')
  const nextTheme = isDark ? 'light' : 'dark'
  
  const handleToggle = () => {
    onThemeChange?.(nextTheme)
  }
  
  return (
    <Button
      onPress={handleToggle}
      size="$3"
      variant="outlined"
      circular
      backgroundColor="$background"
      borderColor="$borderColor"
      hoverStyle={{
        backgroundColor: '$backgroundHover',
        borderColor: '$borderColorHover',
      }}
      pressStyle={{
        backgroundColor: '$backgroundPress',
        borderColor: '$borderColorPress',
      }}
      aria-label={`Switch to ${nextTheme} theme`}
      id="theme-toggle"
    >
      {isDark ? (
        <Sun size={16} color="$textPrimary" />
      ) : (
        <Moon size={16} color="$textPrimary" />
      )}
    </Button>
  )
}