'use client'

import React from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'solito/navigation'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { Text, YStack, XStack, View, Button, useThemeName } from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { NavitemLogout } from '@my/app/provider/auth/navItem-logout'
import { LogInUser } from '@my/app/provider/auth/log-in-user'

type SimpleEnhancedNavigationProps = {
  children: React.ReactNode
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

const adminPages: MainPageType[] = [
  { path: '/email-tester', label: 'Email Tester' },
  { path: '/brand/colours', label: 'Brand Colors' },
  { path: '/brand/typography', label: 'Typography' },
  { path: '/brand/components', label: 'Components' },
  { path: '/brand/navigation', label: 'Navigation' },
  { path: '/brand/playground', label: 'Feature Flags' },
]

export const SimpleEnhancedNavigation: React.FC<SimpleEnhancedNavigationProps> = ({ children }) => {
  const { data: session } = useSession()
  const router = useRouter()
  const currentPath = usePathname()
  const themeName = useThemeName()
  
  // Use theme-aware colors
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const navigateTo = (path: string) => () => {
    router.push(path)
  }

  return (
    <View 
      flex={1} 
      flexDirection="row" 
      backgroundColor={colors.background} 
      style={{ minHeight: '100vh' }}
    >
      {/* Simple Navigation Sidebar */}
      <View
        backgroundColor={colors.backgroundSecondary}
        borderRightWidth={1}
        borderRightColor={colors.border}
        width={250}
        style={{ height: '100vh' }}
        padding="$3"
      >
        <YStack gap="$3">
          {/* Header */}
          <View>
            <Text fontSize="$6" fontWeight="700" color={colors.textPrimary}>
              TEE Portal
            </Text>
          </View>

          {session?.user && (
            <View backgroundColor={colors.backgroundTertiary} padding="$2" borderRadius="$2">
              <Text fontSize="$3" fontWeight="600" color={colors.textPrimary}>
                {session.user.name}
              </Text>
              <Text fontSize="$2" color={colors.textSecondary}>
                {(session.user as any)?.role || 'Guest'}
              </Text>
            </View>
          )}

          {/* Main Navigation */}
          <YStack gap="$1">
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              textTransform="uppercase"
            >
              Main Menu
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
              >
                <Text
                  color={currentPath === page.path ? colors.primaryForeground : colors.textPrimary}
                  fontWeight={currentPath === page.path ? '600' : '400'}
                >
                  {page.label}
                </Text>
              </Button>
            ))}
          </YStack>

          {/* Admin Navigation */}
          {session?.user &&
            ((session.user as any)?.role === ROLES.ADMIN || (session.user as any)?.role === ROLES.OWNER) && (
              <YStack gap="$1">
                <Text
                  fontSize="$2"
                  fontWeight="600"
                  color={colors.textSecondary}
                  textTransform="uppercase"
                >
                  Admin Tools
                </Text>
                {adminPages.map((page) => (
                  <Button
                    key={page.path}
                    onPress={navigateTo(page.path)}
                    backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                    borderRadius="$2"
                    justifyContent="flex-start"
                    paddingHorizontal="$3"
                    paddingVertical="$2"
                  >
                    <Text
                      color={
                        currentPath === page.path ? colors.primaryForeground : colors.textPrimary
                      }
                      fontWeight={currentPath === page.path ? '600' : '400'}
                    >
                      {page.label}
                    </Text>
                  </Button>
                ))}
              </YStack>
            )}

          {/* Auth */}
          <YStack gap="$2" marginTop="auto">
            {session?.user ? <NavitemLogout /> : <LogInUser />}
          </YStack>
        </YStack>
      </View>

      {/* Main Content Area */}
      <View flex={1} backgroundColor={colors.background}>
        {children}
      </View>
    </View>
  )
}
