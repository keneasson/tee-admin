'use client'

import React, { useState } from 'react'
import { YStack, XStack, Text, View, Button, Dialog } from '@my/ui'
import { brandColors, type ColorMode } from '../branding/brand-colors'

interface CollapsibleNavigationProps {
  /** Child navigation items */
  children: React.ReactNode
  /** Theme mode for color selection */
  mode?: ColorMode
  /** Header content (logo, user info, etc.) */
  header?: React.ReactNode
  /** Footer content (version, links, etc.) */
  footer?: React.ReactNode
  /** Whether the navigation is collapsible on desktop */
  collapsibleOnDesktop?: boolean
  /** Whether the navigation starts collapsed on desktop */
  defaultCollapsed?: boolean
  /** Minimum width when collapsed */
  collapsedWidth?: number
  /** Full width when expanded */
  expandedWidth?: number
  /** Whether to show navigation labels when collapsed */
  showLabelsWhenCollapsed?: boolean
}

export function CollapsibleNavigation({
  children,
  mode = 'light',
  header,
  footer,
  collapsibleOnDesktop = true,
  defaultCollapsed = false,
  collapsedWidth = 60,
  expandedWidth = 280,
  showLabelsWhenCollapsed = false
}: CollapsibleNavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const colors = brandColors[mode]
  
  const toggleCollapsed = () => setIsCollapsed(!isCollapsed)
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  
  // Desktop Navigation Sidebar
  const DesktopNavigation = () => (
    <View
      backgroundColor={colors.backgroundSecondary}
      borderRightWidth={1}
      borderRightColor={colors.border}
      width={isCollapsed ? collapsedWidth : expandedWidth}
      height="100vh"
      overflow="hidden"
      animation="quick"
    >
      <YStack flex={1}>
        {/* Header Section */}
        <View
          backgroundColor={colors.surface}
          borderBottomWidth={1}
          borderBottomColor={colors.borderLight}
          padding="$3"
        >
          <XStack alignItems="center" justifyContent="space-between">
            {(!isCollapsed || showLabelsWhenCollapsed) && header && (
              <View flex={1}>
                {header}
              </View>
            )}
            
            {collapsibleOnDesktop && (
              <Button
                size="$2"
                onPress={toggleCollapsed}
                backgroundColor="transparent"
                borderWidth={0}
                padding="$1"
              >
                <Text fontSize="$4" color={colors.textSecondary}>
                  {isCollapsed ? '→' : '←'}
                </Text>
              </Button>
            )}
          </XStack>
        </View>
        
        {/* Navigation Content */}
        <YStack
          flex={1}
          padding={isCollapsed ? '$1' : '$3'}
          gap={isCollapsed ? '$1' : '$2'}
          overflow="scroll"
        >
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                ...child.props,
                // Pass collapsed state to children
                isNavigationCollapsed: isCollapsed,
                showLabels: !isCollapsed || showLabelsWhenCollapsed,
                mode
              })
            }
            return child
          })}
        </YStack>
        
        {/* Footer Section */}
        {footer && (!isCollapsed || showLabelsWhenCollapsed) && (
          <View
            backgroundColor={colors.surface}
            borderTopWidth={1}
            borderTopColor={colors.borderLight}
            padding="$3"
          >
            {footer}
          </View>
        )}
      </YStack>
    </View>
  )
  
  // Mobile Navigation Header
  const MobileNavigationHeader = () => (
    <View
      backgroundColor={colors.surface}
      borderBottomWidth={1}
      borderBottomColor={colors.border}
      padding="$3"
      $sm={{ display: 'flex' }}
      $md={{ display: 'none' }}
    >
      <XStack alignItems="center" justifyContent="space-between">
        {header && (
          <View flex={1}>
            {header}
          </View>
        )}
        
        <Button
          size="$3"
          onPress={toggleMobileMenu}
          backgroundColor="transparent"
          borderWidth={0}
        >
          <Text fontSize="$5" color={colors.textPrimary}>
            {isMobileMenuOpen ? '✕' : '☰'}
          </Text>
        </Button>
      </XStack>
    </View>
  )
  
  // Mobile Navigation Dialog
  const MobileNavigationDialog = () => (
    <Dialog
      modal
      open={isMobileMenuOpen}
      onOpenChange={setIsMobileMenuOpen}
    >
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
            'quicker',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          width="90%"
          height="90%"
          backgroundColor={colors.background}
        >
          <YStack flex={1} padding="$4" gap="$3">
            {/* Mobile Header */}
            {header && (
              <View
                backgroundColor={colors.backgroundSecondary}
                padding="$3"
                borderRadius="$3"
                marginBottom="$2"
              >
                {header}
              </View>
            )}
            
            {/* Mobile Navigation Items */}
            <YStack flex={1} gap="$2">
              {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                  return React.cloneElement(child, {
                    ...child.props,
                    isMobileNavigation: true,
                    onNavigate: () => setIsMobileMenuOpen(false),
                    mode
                  })
                }
                return child
              })}
            </YStack>
            
            {/* Mobile Footer */}
            {footer && (
              <View
                backgroundColor={colors.backgroundSecondary}
                padding="$3"
                borderRadius="$3"
                marginTop="$2"
              >
                {footer}
              </View>
            )}
          </YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
  
  return (
    <>
      {/* Desktop Navigation - Hidden on mobile */}
      <View $sm={{ display: 'none' }} $md={{ display: 'flex' }}>
        <DesktopNavigation />
      </View>
      
      {/* Mobile Navigation Header - Hidden on desktop */}
      <MobileNavigationHeader />
      
      {/* Mobile Navigation Dialog */}
      <MobileNavigationDialog />
    </>
  )
}

// Enhanced navigation wrapper that combines all our components
interface NavigationContainerProps {
  /** Child navigation groups and items */
  children: React.ReactNode
  /** Theme mode */
  mode?: ColorMode
  /** User information for header */
  user?: {
    name: string
    role: string
    avatar?: string
  }
  /** Application branding */
  branding?: {
    logo?: React.ReactNode
    title?: string
    version?: string
  }
  /** Additional header content */
  headerContent?: React.ReactNode
  /** Additional footer content */
  footerContent?: React.ReactNode
}

export function NavigationContainer({
  children,
  mode = 'light',
  user,
  branding,
  headerContent,
  footerContent
}: NavigationContainerProps) {
  const colors = brandColors[mode]
  
  const Header = () => (
    <YStack gap="$2">
      {branding && (
        <XStack alignItems="center" gap="$2">
          {branding.logo}
          {branding.title && (
            <Text fontSize="$5" fontWeight="700" color={colors.textPrimary}>
              {branding.title}
            </Text>
          )}
        </XStack>
      )}
      
      {user && (
        <View
          backgroundColor={colors.backgroundTertiary}
          padding="$2"
          borderRadius="$2"
        >
          <Text fontSize="$3" fontWeight="600" color={colors.textPrimary}>
            {user.name}
          </Text>
          <Text fontSize="$2" color={colors.textSecondary}>
            {user.role}
          </Text>
        </View>
      )}
      
      {headerContent}
    </YStack>
  )
  
  const Footer = () => (
    <YStack gap="$2">
      {branding?.version && (
        <Text fontSize="$2" color={colors.textTertiary} textAlign="center">
          v{branding.version}
        </Text>
      )}
      {footerContent}
    </YStack>
  )
  
  return (
    <CollapsibleNavigation
      mode={mode}
      header={<Header />}
      footer={<Footer />}
    >
      {children}
    </CollapsibleNavigation>
  )
}