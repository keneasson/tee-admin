'use client'

import React, { useState } from 'react'
import { usePathname, useRouter } from 'solito/navigation'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { Text, YStack, XStack, View, Button, useThemeName, useThemeContext, useMedia, Sheet, ScrollView } from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { NavitemLogout } from '@my/app/provider/auth/navItem-logout'
import { ThemeToggle } from './theme-toggle'
import { NotificationBell } from '@my/ui/src/notifications/notification-bell'
import { Menu, X } from '@tamagui/lucide-icons'
import { getBrand } from '@my/app/config/brand'

type UserSession = {
  name?: string | null
  email?: string | null
  role?: string
  /** Signed-in user's home ecclesia, shown in the header */
  ecclesia?: string | null
  /** Recording Brother designation — grants content-manager nav access */
  isRecordingBrother?: boolean
}

type SimpleEnhancedNavigationProps = {
  children: React.ReactNode
  /** User session data passed from platform-specific auth */
  user?: UserSession | null
  /** Sign out function passed from platform-specific auth */
  onSignOut?: () => void
  /** Unread notification count (feature-flagged) */
  notificationCount?: number
  /** Handler when bell icon is pressed */
  onNotificationPress?: () => void
}

type MainPageType = {
  path: string
  label: string
}

const pages: MainPageType[] = [
  { path: '/', label: 'Home' },
  { path: '/newsletter', label: 'Newsletter' },
  { path: '/schedule', label: 'Schedules' },
  { path: '/events', label: 'Events' },
]

// Admin Tools - Email Management
const emailAdminPages: MainPageType[] = [
  { path: '/admin/email/sender', label: 'Email Sender' },
  { path: '/admin/email/inter-ecclesia', label: 'Inter-Ecclesia' },
  { path: '/admin/email/lists', label: 'Email Lists' },
  { path: '/admin/email/schedule', label: 'Schedule Emails to Send' },
]

// Content managers — available to content authors (admin/owner + rep/recorder/RB).
// Per-ecclesia scoping is enforced by the routes themselves.
const contentManagerPages: MainPageType[] = [
  { path: '/admin/events', label: 'Event Manager' },
  { path: '/admin/news', label: 'News Manager' },
  { path: '/admin/meetings', label: 'Meeting Manager' },
]

// Admin Tools - System Management (admin/owner only)
const systemAdminPages: MainPageType[] = [
  { path: '/admin/youtube', label: 'YouTube' },
  { path: '/admin/schedule-overrides', label: 'Service Overrides' },
  { path: '/admin/data-sync', label: 'Data Sync' },
  { path: '/admin/directory-email-sync', label: 'Directory Email Sync' },
  { path: '/admin/metrics', label: 'Metrics' },
  { path: '/admin/email-tester', label: 'Email Tester' },
]

// Community pages visible to all authenticated users (member+)
const communityPages: MainPageType[] = [
  { path: '/directory/ecclesias', label: 'Ecclesial Directory' },
  { path: '/directory/people', label: 'Contact List' },
]

// Brand System Tools
const brandAdminPages: MainPageType[] = [
  { path: '/admin/ui-ux/brand/colours', label: 'Brand Colors' },
  { path: '/admin/ui-ux/brand/typography', label: 'Typography' },
  { path: '/admin/ui-ux/brand/components', label: 'Components' },
  { path: '/admin/ui-ux/brand/navigation', label: 'Navigation' },
  { path: '/admin/evolution/feature-flags', label: 'Feature Flags' },
]

export const SimpleEnhancedNavigation: React.FC<SimpleEnhancedNavigationProps> = ({ children, user, onSignOut, notificationCount, onNotificationPress }) => {
  const router = useRouter()
  const currentPath = usePathname()
  const themeName = useThemeName()
  const { setTheme } = useThemeContext()
  const media = useMedia()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  // Use theme-aware colors
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const brand = getBrand()

  const navigateTo = (path: string) => () => {
    router.push(path)
    // Close mobile menu after navigation
    setMobileMenuOpen(false)
  }

  // Sidebar brand mark. Brand identity and the verse live in the page header
  // (Banner), not here. `compact` is the persistent mobile top bar.
  const BrandHeader = ({ compact }: { compact?: boolean }) => (
    <YStack flex={1} paddingRight="$2">
      <Text fontSize={compact ? '$5' : '$6'} fontWeight="700" color={colors.textPrimary}>
        {brand.primary}
      </Text>
      {brand.secondary ? (
        <Text fontSize={compact ? '$1' : '$2'} fontWeight="500" color={colors.textSecondary}>
          {brand.secondary}
        </Text>
      ) : null}
    </YStack>
  )

  // Navigation content component (shared between desktop and mobile)
  const NavigationContent = () => (
    <YStack gap="$3" flex={1}>
      {/* Header - stays fixed at top */}
      <View flexDirection="row" alignItems="flex-start" justifyContent="space-between">
        <BrandHeader />
        <XStack gap="$2" alignItems="center">
          {user && onNotificationPress && notificationCount !== undefined ? (
            <NotificationBell
              unreadCount={notificationCount}
              onPress={onNotificationPress}
            />
          ) : null}
          <ThemeToggle onThemeChange={setTheme} />
          {/* Close button for mobile */}
          {media.sm ? <Button
              size="$3"
              circular
              icon={X}
              onPress={() => setMobileMenuOpen(false)}
              backgroundColor="transparent"
            /> : null}
        </XStack>
      </View>

      {/* Scrollable navigation content */}
      <ScrollView flex={1} showsVerticalScrollIndicator={true}>
        <YStack gap="$3" paddingBottom="$4">
      {user ? <Button
          onPress={navigateTo('/profile')}
          backgroundColor={colors.backgroundTertiary}
          padding="$2"
          borderRadius="$2"
          justifyContent="flex-start"
          hoverStyle={{
            backgroundColor: colors.backgroundSecondary,
          }}
        >
          <YStack>
            <Text fontSize="$3" fontWeight="600" color={colors.textPrimary}>
              {user.name}
            </Text>
            <Text fontSize="$2" color={colors.textSecondary}>
              {user.role || 'Guest'}
            </Text>
          </YStack>
        </Button> : <Button
          onPress={navigateTo('/auth/signin')}
          backgroundColor={colors.primary}
          padding="$2"
          borderRadius="$2"
          justifyContent="flex-start"
          hoverStyle={{
            backgroundColor: colors.primaryHover,
          }}
        >
          <Text fontSize="$3" fontWeight="600" color={colors.primaryForeground}>
            Sign In
          </Text>
        </Button>}

      {/* Main Navigation */}
      <YStack gap="$1">
        <Text
          fontSize="$2"
          fontWeight="600"
          color={colors.textSecondary}
          textTransform="uppercase"
        >
          News & Schedule
        </Text>
        {pages.map((page) => (
          <Button
            key={page.path}
            onPress={navigateTo(page.path)}
            backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
            borderRadius="$2"
            justifyContent="flex-start"
            paddingHorizontal="$3"
            paddingVertical="$2"
            hoverStyle={{
              backgroundColor: currentPath === page.path ? colors.primaryHover : colors.backgroundSecondary,
            }}
          >
            <Text
              color={currentPath === page.path ? colors.primaryForeground : colors.textPrimary}
              fontWeight={currentPath === page.path ? '600' : '400'}
              hoverStyle={{
                color: currentPath === page.path ? colors.primaryForeground : colors.textSecondary,
              }}
            >
              {page.label}
            </Text>
          </Button>
        ))}
      </YStack>

{/* Email Admin Tools */}
      {user &&
        (user.role === ROLES.ADMIN || user.role === ROLES.OWNER) ? <YStack gap="$1">
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              textTransform="uppercase"
            >
              Email Tools
            </Text>
            {emailAdminPages.map((page) => (
              <Button
                key={page.path}
                onPress={navigateTo(page.path)}
                backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical="$2"
                hoverStyle={{
                  backgroundColor: currentPath === page.path ? colors.primaryHover : colors.backgroundSecondary,
                }}
              >
                <Text
                  color={
                    currentPath === page.path ? colors.primaryForeground : colors.textPrimary
                  }
                  fontWeight={currentPath === page.path ? '600' : '400'}
                  hoverStyle={{
                    color: currentPath === page.path ? colors.primaryForeground : colors.textSecondary,
                  }}
                >
                  {page.label}
                </Text>
              </Button>
            ))}
          </YStack> : null}

      {/* Community - for members, rep, recorder, admin, owner */}
      {user &&
        (user.role === ROLES.MEMBER || user.role === ROLES.REP || user.role === ROLES.RECORDER ||
         user.role === ROLES.ADMIN || user.role === ROLES.OWNER) ? <YStack gap="$1">
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              textTransform="uppercase"
            >
              Community
            </Text>
            {communityPages.map((page) => {
              const isActive = currentPath?.startsWith(page.path) ?? false
              return (
              <Button
                key={page.path}
                onPress={navigateTo(page.path)}
                backgroundColor={isActive ? colors.primary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical="$2"
                hoverStyle={{
                  backgroundColor: isActive ? colors.primaryHover : colors.backgroundSecondary,
                }}
              >
                <Text
                  color={
                    isActive ? colors.primaryForeground : colors.textPrimary
                  }
                  fontWeight={isActive ? '600' : '400'}
                  hoverStyle={{
                    color: isActive ? colors.primaryForeground : colors.textSecondary,
                  }}
                >
                  {page.label}
                </Text>
              </Button>
              )
            })}
          </YStack> : null}

      {/* Content Managers — admin/owner + rep/recorder/RB (routes enforce ecclesia scope) */}
      {user &&
        (user.role === ROLES.ADMIN ||
          user.role === ROLES.OWNER ||
          user.role === ROLES.REP ||
          user.role === ROLES.RECORDER ||
          user.isRecordingBrother) ? <YStack gap="$1">
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              textTransform="uppercase"
            >
              Content
            </Text>
            {contentManagerPages.map((page) => (
              <Button
                key={page.path}
                onPress={navigateTo(page.path)}
                backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical="$2"
                hoverStyle={{
                  backgroundColor: currentPath === page.path ? colors.primaryHover : colors.backgroundSecondary,
                }}
              >
                <Text
                  color={
                    currentPath === page.path ? colors.primaryForeground : colors.textPrimary
                  }
                  fontWeight={currentPath === page.path ? '600' : '400'}
                  hoverStyle={{
                    color: currentPath === page.path ? colors.primaryForeground : colors.textSecondary,
                  }}
                >
                  {page.label}
                </Text>
              </Button>
            ))}
          </YStack> : null}

      {/* System Admin Tools */}
      {user &&
        (user.role === ROLES.ADMIN || user.role === ROLES.OWNER) ? <YStack gap="$1">
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              textTransform="uppercase"
            >
              System Tools
            </Text>
            {systemAdminPages.map((page) => (
              <Button
                key={page.path}
                onPress={navigateTo(page.path)}
                backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical="$2"
                hoverStyle={{
                  backgroundColor: currentPath === page.path ? colors.primaryHover : colors.backgroundSecondary,
                }}
              >
                <Text
                  color={
                    currentPath === page.path ? colors.primaryForeground : colors.textPrimary
                  }
                  fontWeight={currentPath === page.path ? '600' : '400'}
                  hoverStyle={{
                    color: currentPath === page.path ? colors.primaryForeground : colors.textSecondary,
                  }}
                >
                  {page.label}
                </Text>
              </Button>
            ))}
          </YStack> : null}

      {/* Brand System Tools */}
      {user &&
        (user.role === ROLES.ADMIN || user.role === ROLES.OWNER) ? <YStack gap="$1">
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              textTransform="uppercase"
            >
              Brand System
            </Text>
            {brandAdminPages.map((page) => (
              <Button
                key={page.path}
                onPress={navigateTo(page.path)}
                backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical="$2"
                hoverStyle={{
                  backgroundColor: currentPath === page.path ? colors.primaryHover : colors.backgroundSecondary,
                }}
              >
                <Text
                  color={
                    currentPath === page.path ? colors.primaryForeground : colors.textPrimary
                  }
                  fontWeight={currentPath === page.path ? '600' : '400'}
                  hoverStyle={{
                    color: currentPath === page.path ? colors.primaryForeground : colors.textSecondary,
                  }}
                >
                  {page.label}
                </Text>
              </Button>
            ))}
          </YStack> : null}
        </YStack>
      </ScrollView>

      {/* Sign out - stays fixed at bottom (Sign In lives at the top of the menu) */}
      {user ? (
        <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor={colors.border}>
          <NavitemLogout onSignOut={onSignOut} />
        </YStack>
      ) : null}
    </YStack>
  )

  // Mobile layout (hamburger menu)
  if (media.sm) {
    return (
      <View flex={1} backgroundColor={colors.background}>
        {/* Mobile Header */}
        <XStack
          backgroundColor={colors.backgroundSecondary}
          borderBottomWidth={1}
          borderBottomColor={colors.border}
          padding="$3"
          alignItems="center"
          justifyContent="space-between"
        >
          <BrandHeader compact />
          <XStack gap="$2" alignItems="center">
            {user && onNotificationPress && notificationCount !== undefined ? (
              <NotificationBell
                unreadCount={notificationCount}
                onPress={onNotificationPress}
              />
            ) : null}
            <Button
              size="$3"
              circular
              icon={Menu}
              onPress={() => setMobileMenuOpen(true)}
              backgroundColor="transparent"
            />
          </XStack>
        </XStack>

        {/* Mobile Menu Sheet */}
        <Sheet
          modal
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          snapPoints={[85]}
          position={0}
          dismissOnSnapToBottom
        >
          <Sheet.Overlay />
          <Sheet.Frame
            backgroundColor={colors.backgroundSecondary}
            padding="$4"
          >
            <NavigationContent />
          </Sheet.Frame>
        </Sheet>

        {/* Main Content */}
        <View flex={1}>
          {children}
        </View>
      </View>
    )
  }

  // Desktop layout (sidebar)
  return (
    <View 
      flex={1} 
      flexDirection="row" 
      backgroundColor={colors.background} 
      style={{ minHeight: '100vh' }}
    >
      {/* Desktop Navigation Sidebar */}
      <View
        backgroundColor={colors.backgroundSecondary}
        borderRightWidth={1}
        borderRightColor={colors.border}
        width={250}
        style={{ height: '100vh' }}
        padding="$3"
      >
        <NavigationContent />
      </View>

      {/* Main Content Area */}
      <View flex={1} backgroundColor={colors.background}>
        {children}
      </View>
    </View>
  )
}