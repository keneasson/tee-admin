'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'solito/navigation'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  NavigationContainer,
  EnhancedNavigationButton,
  NavigationGroup,
  AdminNavigationGroup,
  MainNavigationGroup,
  RoleBasedNavigation,
  AdminOnlyNavigation,
  MemberPlusNavigation,
} from '@my/ui/src/navigation'
import { NavitemLogout } from '@my/app/provider/auth/navItem-logout'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { Text, YStack, View } from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'

type WithNavigationProps = {
  children: React.ReactNode
}

type MainPageType = {
  path: string
  label: string
  icon?: string
}

const pages: MainPageType[] = [
  { path: '/', label: 'Home', icon: '🏠' },
  { path: '/newsletter', label: 'Newsletter', icon: '📧' },
  { path: '/schedule', label: 'Schedules', icon: '📅' },
  { path: '/events', label: 'Events', icon: '🎉' },
]

const adminPages: MainPageType[] = [
  { path: '/email-tester', label: 'Email Tester', icon: '📬' },
  { path: '/brand/colours', label: 'Brand Colors', icon: '🎨' },
  { path: '/brand/typography', label: 'Typography', icon: '✍️' },
  { path: '/brand/components', label: 'Components', icon: '🧩' },
  { path: '/brand/navigation', label: 'Navigation', icon: '🧭' },
  { path: '/brand/navigation-showcase', label: 'Nav Showcase', icon: '✨' },
  { path: '/brand/playground', label: 'Feature Flags', icon: '🚀' },
]

export const EnhancedWithNavigation: React.FC<WithNavigationProps> = ({ children }) => {
  const { data: session } = useSession()
  const router = useRouter()
  const currentPath = usePathname()

  const navigateTo = (path: string) => () => {
    router.push(path)
  }

  // Custom header with user info
  const Header = () => (
    <YStack gap="$2">
      {/* App Branding */}
      <View>
        <Text fontSize="$6" fontWeight="700" color="$textPrimary">
          TEE Portal
        </Text>
      </View>

      {/* User Welcome */}
      {session?.user && (
        <View
          backgroundColor="$backgroundTertiary"
          padding="$3"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderLight"
        >
          <Text fontSize="$4" fontWeight="600" color="$textPrimary">
            Welcome back!
          </Text>
          <Text fontSize="$3" color="$textSecondary">
            {session.user.name}
          </Text>
          <Text fontSize="$2" color="$textTertiary">
            {session.user.role}
          </Text>
        </View>
      )}
    </YStack>
  )

  // Custom footer with logout/login
  const Footer = () => (
    <YStack gap="$2">
      {session?.user ? <NavitemLogout /> : <LogInUser />}

      <View
        backgroundColor="$backgroundTertiary"
        padding="$2"
        borderRadius="$2"
        alignItems="center"
      >
        <Text fontSize="$1" color="$textTertiary">
          v2.0.0 • Enhanced UI
        </Text>
      </View>
    </YStack>
  )

  return (
    <View flex={1} flexDirection="row">
      {/* Enhanced Navigation Sidebar */}
      <NavigationContainer
        mode="light"
        user={
          session?.user
            ? {
                name: session.user.name || 'User',
                role: session.user.role || 'Guest',
              }
            : undefined
        }
        branding={{
          title: 'TEE Admin',
          version: '2.0.0',
        }}
        headerContent={<Header />}
        footerContent={<Footer />}
      >
        {/* Main Navigation */}
        <MainNavigationGroup>
          {pages.map((page) => (
            <EnhancedNavigationButton
              key={page.path}
              onPress={navigateTo(page.path)}
              text={page.label}
              icon={page.icon}
              active={currentPath === page.path}
              mode="light"
              description={`Navigate to ${page.label}`}
            />
          ))}
        </MainNavigationGroup>

        {/* Member Navigation */}
        <MemberPlusNavigation>
          <NavigationGroup
            title="Member Area"
            icon="👤"
            description="Personal settings and profile"
            collapsible
            defaultCollapsed={true}
          >
            <EnhancedNavigationButton
              onPress={navigateTo('/profile')}
              text="Profile"
              icon="👤"
              active={currentPath === '/profile'}
              mode="light"
              description="Manage your profile settings"
            />
          </NavigationGroup>
        </MemberPlusNavigation>

        {/* Admin Navigation */}
        <AdminOnlyNavigation>
          <AdminNavigationGroup>
            {adminPages.map((page) => (
              <EnhancedNavigationButton
                key={page.path}
                onPress={navigateTo(page.path)}
                text={page.label}
                icon={page.icon}
                active={currentPath === page.path}
                mode="light"
                description={`Admin: ${page.label}`}
                badge={page.path.includes('showcase') ? 'NEW' : undefined}
              />
            ))}
          </AdminNavigationGroup>
        </AdminOnlyNavigation>
      </NavigationContainer>

      {/* Main Content Area */}
      <View
        flex={1}
        backgroundColor="$background"
        borderLeftWidth={1}
        borderLeftColor="$borderLight"
      >
        {children}
      </View>
    </View>
  )
}
