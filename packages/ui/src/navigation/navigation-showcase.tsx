'use client'

import React, { useState } from 'react'
import { YStack, XStack, Text, H2, H3, H4, Button, Separator, View } from '@my/ui'
import { brandColors, type ColorMode } from '../branding/brand-colors'
import { 
  EnhancedNavigationButton,
  NavigationGroup,
  AdminNavigationGroup,
  MainNavigationGroup,
  RoleBasedNavigation,
  AdminOnlyNavigation,
  OwnerOnlyNavigation,
  NavigationContainer,
  useUserRole
} from './'

export function NavigationShowcase() {
  const [mode, setMode] = useState<ColorMode>('light')
  const [currentPath, setCurrentPath] = useState('/')
  const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium')
  const colors = brandColors[mode]
  const userRole = useUserRole()
  
  const navigateTo = (path: string) => () => setCurrentPath(path)
  
  return (
    <YStack gap="$6" padding="$4">
      {/* Header */}
      <YStack gap="$4">
        <H2>Enhanced Navigation System</H2>
        <Text color="$textSecondary" fontSize="$4">
          Comprehensive navigation components with brand integration, role-based access, and mobile responsiveness.
        </Text>
        
        <XStack gap="$3" flexWrap="wrap">
          <XStack alignItems="center" gap="$2">
            <Button 
              variant={mode === 'light' ? 'outlined' : undefined}
              onPress={() => setMode('light')}
              backgroundColor={mode === 'light' ? colors.backgroundSecondary : undefined}
            >
              Light Theme
            </Button>
            <Button 
              variant={mode === 'dark' ? 'outlined' : undefined}
              onPress={() => setMode('dark')}
              backgroundColor={mode === 'dark' ? colors.background : undefined}
              color={mode === 'dark' ? colors.textPrimary : undefined}
            >
              Dark Theme
            </Button>
          </XStack>
          
          <XStack alignItems="center" gap="$2">
            <Text fontSize="$3" color="$textSecondary">Size:</Text>
            {(['small', 'medium', 'large'] as const).map(size => (
              <Button
                key={size}
                size="$2"
                variant={selectedSize === size ? 'outlined' : undefined}
                onPress={() => setSelectedSize(size)}
              >
                {size}
              </Button>
            ))}
          </XStack>
        </XStack>
      </YStack>
      
      <Separator />
      
      {/* Enhanced Navigation Buttons */}
      <YStack gap="$4">
        <H3>Enhanced Navigation Buttons</H3>
        <Text color="$textSecondary" fontSize="$3">
          New navigation buttons with brand colors, icons, badges, and descriptions.
        </Text>
        
        <View
          backgroundColor={colors.background}
          borderRadius="$4"
          borderWidth={2}
          borderColor={colors.border}
          padding="$4"
        >
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
              Navigation Examples ({mode} theme)
            </Text>
            
            <YStack gap="$2">
              <EnhancedNavigationButton
                onPress={navigateTo('/')}
                text="Dashboard"
                icon="🏠"
                active={currentPath === '/'}
                mode={mode}
                size={selectedSize}
                description="Main overview and statistics"
              />
              
              <EnhancedNavigationButton
                onPress={navigateTo('/events')}
                text="Events"
                icon="📅"
                active={currentPath === '/events'}
                mode={mode}
                size={selectedSize}
                badge={3}
                description="Manage church events and schedules"
              />
              
              <EnhancedNavigationButton
                onPress={navigateTo('/newsletter')}
                text="Newsletter"
                icon="📧"
                active={currentPath === '/newsletter'}
                mode={mode}
                size={selectedSize}
                badge={true}
                description="Send and manage newsletters"
              />
              
              <EnhancedNavigationButton
                onPress={() => {}}
                text="Disabled Item"
                icon="🚫"
                disabled
                mode={mode}
                size={selectedSize}
                description="This item is disabled"
              />
            </YStack>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      {/* Navigation Groups */}
      <YStack gap="$4">
        <H3>Navigation Groups</H3>
        <Text color="$textSecondary" fontSize="$3">
          Organized navigation sections with collapsible groups and role-based visibility.
        </Text>
        
        <View
          backgroundColor={colors.backgroundSecondary}
          borderRadius="$4"
          borderWidth={2}
          borderColor={colors.border}
          padding="$4"
        >
          <YStack gap="$3">
            <MainNavigationGroup mode={mode}>
              <EnhancedNavigationButton
                onPress={navigateTo('/')}
                text="Home"
                icon="🏠"
                active={currentPath === '/'}
                mode={mode}
                size={selectedSize}
              />
              <EnhancedNavigationButton
                onPress={navigateTo('/events')}
                text="Events"
                icon="📅"
                active={currentPath === '/events'}
                mode={mode}
                size={selectedSize}
                badge={2}
              />
              <EnhancedNavigationButton
                onPress={navigateTo('/newsletter')}
                text="Newsletter"
                icon="📧"
                active={currentPath === '/newsletter'}
                mode={mode}
                size={selectedSize}
              />
            </MainNavigationGroup>
            
            <AdminNavigationGroup mode={mode}>
              <EnhancedNavigationButton
                onPress={navigateTo('/brand/colours')}
                text="Brand Colors"
                icon="🎨"
                active={currentPath === '/brand/colours'}
                mode={mode}
                size={selectedSize}
                description="Manage brand color palette"
              />
              <EnhancedNavigationButton
                onPress={navigateTo('/brand/typography')}
                text="Typography"
                icon="✍️"
                active={currentPath === '/brand/typography'}
                mode={mode}
                size={selectedSize}
              />
              <EnhancedNavigationButton
                onPress={navigateTo('/email-tester')}
                text="Email Tester"
                icon="📬"
                active={currentPath === '/email-tester'}
                mode={mode}
                size={selectedSize}
                badge={1}
              />
            </AdminNavigationGroup>
            
            <NavigationGroup
              title="Settings"
              icon="⚙️"
              description="System configuration"
              mode={mode}
              collapsible
              defaultCollapsed={true}
            >
              <EnhancedNavigationButton
                onPress={navigateTo('/settings/general')}
                text="General Settings"
                icon="📋"
                active={currentPath === '/settings/general'}
                mode={mode}
                size={selectedSize}
              />
              <EnhancedNavigationButton
                onPress={navigateTo('/settings/users')}
                text="User Management"
                icon="👥"
                active={currentPath === '/settings/users'}
                mode={mode}
                size={selectedSize}
              />
            </NavigationGroup>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      {/* Role-Based Navigation */}
      <YStack gap="$4">
        <H3>Role-Based Navigation</H3>
        <Text color="$textSecondary" fontSize="$3">
          Navigation items automatically shown/hidden based on user permissions.
        </Text>
        
        <View
          backgroundColor={colors.surface}
          borderRadius="$4"
          borderWidth={1}
          borderColor={colors.borderLight}
          padding="$4"
        >
          <YStack gap="$3">
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
              Current User: {userRole.role || 'Not authenticated'} 
              {userRole.isAdminOrOwner && <Text color={colors.success}> (Admin Access)</Text>}
            </Text>
            
            <YStack gap="$2">
              {/* Always visible */}
              <EnhancedNavigationButton
                onPress={navigateTo('/public')}
                text="Public Page"
                icon="🌐"
                active={currentPath === '/public'}
                mode={mode}
                size={selectedSize}
                description="Visible to all users"
              />
              
              {/* Admin only */}
              <AdminOnlyNavigation>
                <EnhancedNavigationButton
                  onPress={navigateTo('/admin')}
                  text="Admin Dashboard"
                  icon="👑"
                  active={currentPath === '/admin'}
                  mode={mode}
                  size={selectedSize}
                  description="Admin only - brand management"
                  badge="ADMIN"
                />
              </AdminOnlyNavigation>
              
              {/* Owner only */}
              <OwnerOnlyNavigation>
                <EnhancedNavigationButton
                  onPress={navigateTo('/owner')}
                  text="Owner Settings"
                  icon="🔒"
                  active={currentPath === '/owner'}
                  mode={mode}
                  size={selectedSize}
                  description="Owner only - system settings"
                  badge="OWNER"
                />
              </OwnerOnlyNavigation>
              
              {/* Custom role requirements */}
              <RoleBasedNavigation requiredRole={['ADMIN', 'OWNER']} exactMatch>
                <EnhancedNavigationButton
                  onPress={navigateTo('/advanced')}
                  text="Advanced Features"
                  icon="🚀"
                  active={currentPath === '/advanced'}
                  mode={mode}
                  size={selectedSize}
                  description="Admin or Owner required"
                  badge="PLUS"
                />
              </RoleBasedNavigation>
            </YStack>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      {/* Mobile Preview */}
      <YStack gap="$4">
        <H3>Mobile Navigation Preview</H3>
        <Text color="$textSecondary" fontSize="$3">
          Preview of how navigation appears on mobile devices with collapsible menu.
        </Text>
        
        <View
          backgroundColor={colors.background}
          borderRadius="$4"
          borderWidth={2}
          borderColor={colors.border}
          padding="$2"
          maxWidth={375}
          alignSelf="center"
        >
          {/* Mock mobile header */}
          <View
            backgroundColor={colors.surface}
            borderBottomWidth={1}
            borderBottomColor={colors.border}
            padding="$3"
            borderTopLeftRadius="$3"
            borderTopRightRadius="$3"
          >
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
                TEE Admin
              </Text>
              <Button
                size="$3"
                variant="ghost"
                backgroundColor="transparent"
                borderWidth={0}
              >
                <Text fontSize="$5" color={colors.textPrimary}>☰</Text>
              </Button>
            </XStack>
          </View>
          
          {/* Mock mobile content */}
          <YStack padding="$3" gap="$2">
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
              Mobile Navigation
            </Text>
            <Text fontSize="$3" color={colors.textSecondary}>
              Tap the menu button (☰) to open the navigation drawer with all menu items.
              Navigation automatically adapts to mobile screen sizes.
            </Text>
          </YStack>
        </View>
      </YStack>
      
      <Separator />
      
      {/* Implementation Status */}
      <YStack gap="$4">
        <H3>Implementation Status</H3>
        
        <YStack gap="$3">
          <View
            backgroundColor={colors.success}
            padding="$3"
            borderRadius="$3"
            borderWidth={1}
            borderColor={colors.successForeground}
          >
            <Text color={colors.successForeground} fontWeight="600" marginBottom="$2">
              ✅ Phase 1 Complete - Core Components
            </Text>
            <YStack gap="$1">
              <Text color={colors.successForeground} fontSize="$3">
                • EnhancedNavigationButton with brand colors, icons, badges
              </Text>
              <Text color={colors.successForeground} fontSize="$3">
                • NavigationGroup with collapsible sections
              </Text>
              <Text color={colors.successForeground} fontSize="$3">
                • RoleBasedNavigation with permission checking
              </Text>
              <Text color={colors.successForeground} fontSize="$3">
                • CollapsibleNavigation for mobile responsiveness
              </Text>
            </YStack>
          </View>
          
          <View
            backgroundColor={colors.info}
            padding="$3"
            borderRadius="$3"
            borderWidth={1}
            borderColor={colors.infoForeground}
          >
            <Text color={colors.infoForeground} fontWeight="600" marginBottom="$2">
              🚀 Next: Feature Flag Integration
            </Text>
            <YStack gap="$1">
              <Text color={colors.infoForeground} fontSize="$3">
                • NEW_NAVIGATION_DESIGN feature flag ready (0% rollout)
              </Text>
              <Text color={colors.infoForeground} fontSize="$3">
                • NavigationFeatureGate component created
              </Text>
              <Text color={colors.infoForeground} fontSize="$3">
                • Ready for safe rollout testing
              </Text>
            </YStack>
          </View>
        </YStack>
      </YStack>
    </YStack>
  )
}