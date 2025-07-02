'use client'

import React, { useState } from 'react'
import { YStack, XStack, Text, H2, H3, Button, Separator, View } from '@my/ui'
import { NavigationButtonItem } from '../navigation-button-item'
import { NavHeading, NavItem } from '../nav-item'
import { useFeatureFlag } from '@my/app/features/feature-flags'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { brandColors, type ColorMode } from './brand-colors'

// Mock navigation data
const mockPages = [
  { path: '/', label: 'Home' },
  { path: '/newsletter', label: 'Newsletter' },
  { path: '/schedule', label: 'Schedules' },
  { path: '/events', label: 'Events' },
]

const mockUser = {
  name: 'Test User',
  role: 'admin'
}

export function NavigationTesting() {
  const [currentPath, setCurrentPath] = useState('/')
  const [theme, setTheme] = useState<ColorMode>('light')
  const newNavDesign = useFeatureFlag(FEATURE_FLAGS.NEW_NAVIGATION_DESIGN)
  
  // Get colors for the selected theme
  const themeColors = brandColors[theme]
  
  const linkTo = (route: string) => () => {
    setCurrentPath(route)
  }
  
  return (
    <YStack gap="$6" padding="$4">
      <YStack gap="$4">
        <H2>Navigation Testing Environment</H2>
        <Text color="$textSecondary" fontSize="$4">
          Test navigation components with different states, themes, and feature flags.
        </Text>
        
        <XStack gap="$2" flexWrap="wrap">
          <Button
            variant={theme === 'light' ? 'outlined' : undefined}
            onPress={() => setTheme('light')}
            backgroundColor={theme === 'light' ? themeColors.backgroundSecondary : undefined}
            borderColor={theme === 'light' ? themeColors.primary : undefined}
          >
            Light Theme
          </Button>
          <Button
            variant={theme === 'dark' ? 'outlined' : undefined}
            onPress={() => setTheme('dark')}
            backgroundColor={theme === 'dark' ? themeColors.background : undefined}
            color={theme === 'dark' ? themeColors.textPrimary : undefined}
            borderColor={theme === 'dark' ? themeColors.primary : undefined}
          >
            Dark Theme
          </Button>
        </XStack>
        
        <View 
          backgroundColor={theme === 'light' ? '#F8F6F0' : '#161B22'}
          padding="$3" 
          borderRadius="$3"
          borderWidth={1}
          borderColor={theme === 'light' ? '#1B365D' : '#4A90E2'}
        >
          <Text 
            color={theme === 'light' ? '#1A1A1A' : '#FFFFFF'} 
            fontSize="$3" 
            fontWeight="600"
          >
            ✨ Now showing {theme} theme colors in action!
          </Text>
          <Text 
            color={theme === 'light' ? '#4A4A4A' : '#E0E0E0'} 
            fontSize="$2"
          >
            Switch between themes to see the navigation components change colors.
          </Text>
        </View>
        
        <Text fontSize="$3" color="$textSecondary">
          Current Path: <Text fontFamily="$body">{currentPath}</Text>
        </Text>
        <Text fontSize="$3" color="$textSecondary">
          New Navigation Design: {newNavDesign ? '✅ Enabled' : '❌ Disabled'}
        </Text>
      </YStack>
      
      <Separator />
      
      {/* Theme Preview Container */}
      <YStack gap="$4">
        <H3>Navigation with {theme} Theme</H3>
        <View
          backgroundColor={themeColors.background}
          borderRadius="$4"
          borderWidth={2}
          borderColor={themeColors.border}
          padding="$4"
          minHeight={300}
        >
          <YStack gap="$3">
            <View
              backgroundColor={themeColors.surface}
              padding="$3"
              borderRadius="$3"
              borderWidth={1}
              borderColor={themeColors.borderLight}
            >
              <Text color={themeColors.textPrimary} fontWeight="600">
                Welcome {mockUser.name}
              </Text>
            </View>
            
            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="600" color={themeColors.textSecondary}>
                ADMIN MENU
              </Text>
              <View
                backgroundColor={currentPath === '/email-tester' ? themeColors.primary : themeColors.surface}
                padding="$2"
                borderRadius="$2"
                borderWidth={1}
                borderColor={themeColors.borderLight}
                pressStyle={{ backgroundColor: themeColors.interactiveHover }}
                cursor="pointer"
                onPress={linkTo('/email-tester')}
              >
                <Text color={currentPath === '/email-tester' ? themeColors.primaryForeground : themeColors.textPrimary}>
                  📧 Email Tester
                </Text>
              </View>
              
              <View
                backgroundColor={currentPath === '/brand/colours' ? themeColors.primary : themeColors.surface}
                padding="$2"
                borderRadius="$2"
                borderWidth={1}
                borderColor={themeColors.borderLight}
                pressStyle={{ backgroundColor: themeColors.interactiveHover }}
                cursor="pointer"
                onPress={linkTo('/brand/colours')}
              >
                <Text color={currentPath === '/brand/colours' ? themeColors.primaryForeground : themeColors.textPrimary}>
                  🎨 Brand Colors
                </Text>
              </View>
              
              <View
                backgroundColor={currentPath === '/brand/typography' ? themeColors.primary : themeColors.surface}
                padding="$2"
                borderRadius="$2"
                borderWidth={1}
                borderColor={themeColors.borderLight}
                pressStyle={{ backgroundColor: themeColors.interactiveHover }}
                cursor="pointer"
                onPress={linkTo('/brand/typography')}
              >
                <Text color={currentPath === '/brand/typography' ? themeColors.primaryForeground : themeColors.textPrimary}>
                  ✍️ Brand Typography
                </Text>
              </View>
            </YStack>
            
            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="600" color={themeColors.textSecondary}>
                MAIN MENU
              </Text>
              {mockPages.map((page) => (
                <View
                  key={page.path}
                  backgroundColor={currentPath === page.path ? themeColors.secondary : themeColors.surface}
                  padding="$2"
                  borderRadius="$2"
                  borderWidth={1}
                  borderColor={themeColors.borderLight}
                  pressStyle={{ backgroundColor: themeColors.interactiveHover }}
                  cursor="pointer"
                  onPress={linkTo(page.path)}
                >
                  <Text color={currentPath === page.path ? themeColors.secondaryForeground : themeColors.textPrimary}>
                    {page.label}
                  </Text>
                </View>
              ))}
            </YStack>
          </YStack>
        </View>
      </YStack>
      
      {/* Feature Flag Testing */}
      {newNavDesign && (
        <>
          <Separator />
          <YStack gap="$4">
            <H3>New Navigation Design ({theme} theme)</H3>
            <View
              backgroundColor={themeColors.backgroundSecondary}
              borderRadius="$4"
              borderWidth={2}
              borderColor={themeColors.border}
              padding="$4"
              minHeight={300}
            >
              <YStack gap="$3">
                <View
                  backgroundColor={themeColors.primary}
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius="$3"
                >
                  <Text color={themeColors.primaryForeground} fontWeight="600">
                    Welcome {mockUser.name}
                  </Text>
                </View>
                
                <YStack gap="$2">
                  <View
                    backgroundColor={themeColors.secondary}
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$2"
                  >
                    <Text fontSize="$2" color={themeColors.secondaryForeground} fontWeight="600">
                      ADMIN TOOLS
                    </Text>
                  </View>
                  
                  <YStack gap="$1">
                    <View
                      backgroundColor={currentPath === '/email-tester' ? themeColors.accent : 'transparent'}
                      onPress={linkTo('/email-tester')}
                      borderRadius="$2"
                      padding="$2"
                      cursor="pointer"
                    >
                      <Text color={currentPath === '/email-tester' ? themeColors.accentForeground : themeColors.textPrimary}>
                        📧 Email Tester
                      </Text>
                    </View>
                    
                    <View
                      backgroundColor={currentPath === '/brand/colours' ? themeColors.accent : 'transparent'}
                      onPress={linkTo('/brand/colours')}
                      borderRadius="$2"
                      padding="$2"
                      cursor="pointer"
                    >
                      <Text color={currentPath === '/brand/colours' ? themeColors.accentForeground : themeColors.textPrimary}>
                        🎨 Brand Colors
                      </Text>
                    </View>
                    
                    <View
                      backgroundColor={currentPath === '/brand/typography' ? themeColors.accent : 'transparent'}
                      onPress={linkTo('/brand/typography')}
                      borderRadius="$2"
                      padding="$2"
                      cursor="pointer"
                    >
                      <Text color={currentPath === '/brand/typography' ? themeColors.accentForeground : themeColors.textPrimary}>
                        ✍️ Typography
                      </Text>
                    </View>
                  </YStack>
                </YStack>
                
                <YStack gap="$2">
                  <View
                    backgroundColor={themeColors.info}
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    borderRadius="$2"
                  >
                    <Text fontSize="$2" color={themeColors.infoForeground} fontWeight="600">
                      MAIN PAGES
                    </Text>
                  </View>
                  
                  <YStack gap="$1">
                    {mockPages.map((page) => (
                      <View
                        key={page.path}
                        backgroundColor={currentPath === page.path ? themeColors.primary : 'transparent'}
                        onPress={linkTo(page.path)}
                        borderRadius="$2"
                        padding="$2"
                        cursor="pointer"
                      >
                        <Text color={currentPath === page.path ? themeColors.primaryForeground : themeColors.textPrimary}>
                          {page.label}
                        </Text>
                      </View>
                    ))}
                  </YStack>
                </YStack>
              </YStack>
            </View>
          </YStack>
        </>
      )}
      
      <Separator />
      
      {/* Navigation States Testing */}
      <YStack gap="$4">
        <H3>Navigation States Testing</H3>
        <Text color="$textSecondary" fontSize="$3">
          Test various interaction states and hover effects.
        </Text>
        
        <XStack flexWrap="wrap" gap="$3">
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600">Active State</Text>
            <NavigationButtonItem
              linkTo={() => {}}
              text="Active Item"
              active={true}
            />
          </YStack>
          
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600">Inactive State</Text>
            <NavigationButtonItem
              linkTo={() => {}}
              text="Inactive Item"
              active={false}
            />
          </YStack>
          
          <YStack gap="$2">
            <Text fontSize="$3" fontWeight="600">Long Text</Text>
            <NavigationButtonItem
              linkTo={() => {}}
              text="Very Long Navigation Item Text"
              active={false}
            />
          </YStack>
        </XStack>
      </YStack>
      
      <Separator />
      
      <YStack gap="$2">
        <H3>Implementation Notes</H3>
        <Text color="$textSecondary" fontSize="$3">
          • Navigation uses feature flags to control rollout of new designs
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Colors automatically adapt to light/dark theme
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Active states use brand color palette
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Mobile responsive with collapsible menu
        </Text>
        <Text color="$textSecondary" fontSize="$3">
          • Icon integration available with new design
        </Text>
      </YStack>
    </YStack>
  )
}