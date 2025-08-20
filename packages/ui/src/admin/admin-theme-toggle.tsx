import React from 'react'
import { XStack, YStack, Text, Button, Switch, Label } from 'tamagui'
import { Settings, Sun, Moon, Monitor } from '@tamagui/lucide-icons'
import { useThemeContext } from '../theme-provider'
import { useAdminSpacing } from '../hooks/use-admin-spacing'

interface AdminThemeToggleProps {
  showLabel?: boolean
  compact?: boolean
}

/**
 * Admin theme toggle component that allows switching between:
 * - Admin/Standard modes
 * - Light/Dark themes
 * Automatically preserves the selected base theme when switching modes
 */
export function AdminThemeToggle({ 
  showLabel = true, 
  compact = false 
}: AdminThemeToggleProps) {
  const { theme, setTheme, toggleTheme, isAdminTheme, getBaseTheme, setAdminMode } = useThemeContext()
  const { card, text, button } = useAdminSpacing()
  
  const baseTheme = getBaseTheme()
  
  const handleAdminModeToggle = (enabled: boolean) => {
    setAdminMode(enabled)
  }
  
  if (compact) {
    return (
      <XStack space={card.space} alignItems="center">
        <Button
          size={button.size}
          variant="outlined"
          icon={Settings}
          onPress={() => handleAdminModeToggle(!isAdminTheme)}
          backgroundColor={isAdminTheme ? '$primary' : 'transparent'}
          color={isAdminTheme ? '$primaryForeground' : '$color'}
        />
        <Button
          size={button.size}
          variant="outlined"
          icon={baseTheme === 'dark' ? Moon : Sun}
          onPress={toggleTheme}
        />
      </XStack>
    )
  }
  
  return (
    <YStack space={card.space} padding={card.padding} backgroundColor="$backgroundSecondary" borderRadius="$4">
      {showLabel && (
        <XStack space={card.space} alignItems="center">
          <Settings size={button.iconSize} color="$color" />
          <Text fontSize={text.headerSize} fontWeight="600">Theme Settings</Text>
        </XStack>
      )}
      
      <YStack space={card.space}>
        {/* Admin Mode Toggle */}
        <XStack space={card.space} alignItems="center" justifyContent="space-between">
          <YStack flex={1}>
            <Text fontSize={text.size} fontWeight="500">Admin Mode</Text>
            <Text fontSize={text.size} color="$textSecondary">
              Condensed interface for administrative tasks
            </Text>
          </YStack>
          <Switch
            id="admin-mode"
            size="$3"
            checked={isAdminTheme}
            onCheckedChange={handleAdminModeToggle}
          >
            <Switch.Thumb animation="quick" />
          </Switch>
        </XStack>
        
        {/* Theme Toggle */}
        <XStack space={card.space} alignItems="center" justifyContent="space-between">
          <YStack flex={1}>
            <Text fontSize={text.size} fontWeight="500">Appearance</Text>
            <Text fontSize={text.size} color="$textSecondary">
              {baseTheme === 'dark' ? 'Dark' : 'Light'} theme
            </Text>
          </YStack>
          <XStack space="$1">
            <Button
              size={button.size}
              variant={baseTheme === 'light' ? 'solid' : 'outlined'}
              icon={Sun}
              onPress={() => {
                if (baseTheme !== 'light') toggleTheme()
              }}
            >
              Light
            </Button>
            <Button
              size={button.size}
              variant={baseTheme === 'dark' ? 'solid' : 'outlined'}
              icon={Moon}
              onPress={() => {
                if (baseTheme !== 'dark') toggleTheme()
              }}
            >
              Dark
            </Button>
          </XStack>
        </XStack>
        
        {/* Current Theme Display */}
        <XStack space={card.space} alignItems="center" padding="$2" backgroundColor="$background" borderRadius="$3">
          <Monitor size={button.iconSize} color="$textSecondary" />
          <Text fontSize="$2" color="$textSecondary">
            Current: {theme.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
        </XStack>
      </YStack>
    </YStack>
  )
}

// Compact version for headers/toolbars
export function AdminThemeToggleCompact() {
  return <AdminThemeToggle compact showLabel={false} />
}

// Full version for settings pages
export function AdminThemeToggleFull() {
  return <AdminThemeToggle compact={false} showLabel />
}