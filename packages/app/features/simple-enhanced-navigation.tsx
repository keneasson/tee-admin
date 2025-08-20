'use client'

import { ROLES } from '@my/app/provider/auth/auth-roles'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { NavitemLogout } from '@my/app/provider/auth/navItem-logout'
import {
  Button,
  Dialog,
  Text,
  useMedia,
  useThemeContext,
  useThemeName,
  View,
  XStack,
  YStack,
} from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { ChevronDown, ChevronRight, Menu, X } from '@tamagui/lucide-icons'
import { useSession } from 'next-auth/react'
import React, { useState } from 'react'
import { usePathname, useRouter } from 'solito/navigation'
import { ThemeToggle } from './theme-toggle'

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
  { path: '/admin/events', label: 'Event Editor' },
  { path: '/brand/playground', label: 'Feature Flags' },
]

const communicationPages: MainPageType[] = [
  { path: '/email-tester', label: 'Email Tester' },
  { path: '/admin/newsletter/curate', label: 'Newsletter Curation' },
  { path: '/admin/email-queue', label: 'Email Queue' },
]

const designPages: MainPageType[] = [
  { path: '/brand/colours', label: 'Brand Colors' },
  { path: '/brand/typography', label: 'Typography' },
  { path: '/brand/components', label: 'Components' },
  { path: '/brand/navigation', label: 'Navigation' },
]

export const SimpleEnhancedNavigation: React.FC<SimpleEnhancedNavigationProps> = ({ children }) => {
  const { data: session } = useSession()
  const router = useRouter()
  const currentPath = usePathname() || '/'
  const themeName = useThemeName()
  const { setTheme } = useThemeContext()
  const media = useMedia()

  // Use theme-aware colors
  const mode = themeName === 'dark' ? 'dark' : 'light'
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
      {/* Mobile Navigation or Desktop Sidebar */}
      {media.sm ? (
        <MobileNavigation
          session={session || null}
          currentPath={currentPath}
          colors={colors}
          navigateTo={navigateTo}
          setTheme={(theme: 'light' | 'dark') => setTheme(theme)}
        />
      ) : (
        <DesktopNavigation
          session={session || null}
          currentPath={currentPath}
          colors={colors}
          navigateTo={navigateTo}
          setTheme={(theme: 'light' | 'dark') => setTheme(theme)}
        />
      )}

      {/* Main Content Area */}
      <View
        flex={1}
        backgroundColor={colors.background}
        $sm={{ marginTop: 60 }} // Account for mobile header
      >
        {children}
      </View>
    </View>
  )
}

// Desktop Navigation Component
type NavigationProps = {
  session: any
  currentPath: string
  colors: any
  navigateTo: (path: string) => () => void
  setTheme: (theme: 'light' | 'dark') => void
}

const DesktopNavigation: React.FC<NavigationProps> = ({
  session,
  currentPath,
  colors,
  navigateTo,
  setTheme,
}) => {
  return (
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
        <View flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text fontSize={22} fontWeight="700" color={colors.textPrimary}>
            TEE Portal
          </Text>
          <ThemeToggle onThemeChange={setTheme} />
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

        <NavigationMenu
          session={session}
          currentPath={currentPath}
          colors={colors}
          navigateTo={navigateTo}
          setTheme={(theme: 'light' | 'dark') => setTheme(theme)}
        />

        {/* Auth */}
        <YStack gap="$2" marginTop="auto">
          {session?.user ? <NavitemLogout /> : <LogInUser />}
        </YStack>
      </YStack>
    </View>
  )
}

// Mobile Navigation Component
const MobileNavigation: React.FC<NavigationProps> = ({
  session,
  currentPath,
  colors,
  navigateTo,
  setTheme,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
  }

  const navigateAndClose = (path: string) => () => {
    navigateTo(path)()
    setIsOpen(false)
  }

  return (
    <>
      {/* Mobile Header */}
      <View
        position="absolute"
        top={0}
        left={0}
        right={0}
        backgroundColor={colors.backgroundSecondary}
        borderBottomWidth={1}
        borderBottomColor={colors.border}
        padding="$3"
        zIndex={999}
        height={60}
      >
        <XStack alignItems="center" justifyContent="space-between">
          <Text fontSize="$5" fontWeight="700" color={colors.textPrimary}>
            TEE Portal
          </Text>
          <XStack alignItems="center" gap="$2">
            <ThemeToggle onThemeChange={setTheme} />
            {/* Mobile Navigation Dialog */}
            <Dialog open={isOpen} onOpenChange={handleOpenChange} modal>
              <Dialog.Trigger asChild>
                <Button size="$3" variant="outlined" color="$red10">
                  <Menu size="$1.5" color={colors.textPrimary} />
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay key="overlay" />
                {/* @ts-ignore - Tamagui Dialog types are too strict */}
                <Dialog.Content
                  w="90%"
                  h="90%"
                  backgroundColor={colors.background}
                  borderWidth={1}
                  borderColor={colors.border}
                  borderRadius="$4"
                  p="$4"
                  position="relative"
                >
                  <Dialog.Title asChild>
                    <Text fontSize={22} fontWeight="700" color={colors.textPrimary} letterSpacing={0}>
                      TEE Portal
                    </Text>
                  </Dialog.Title>

                  {/* Close button positioned absolutely in top-right */}
                  <Dialog.Close asChild>
                    <Button
                      position="absolute"
                      top="$3"
                      right="$3"
                      size="$3"
                      width="$3"
                      height="$3"
                      backgroundColor={colors.backgroundSecondary}
                      borderRadius="$2"
                      borderWidth={1}
                      borderColor={colors.border}
                      padding={0}
                      alignItems="center"
                      justifyContent="center"
                      hoverStyle={{
                        backgroundColor: colors.backgroundTertiary,
                      }}
                      pressStyle={{
                        backgroundColor: colors.backgroundTertiary,
                      }}
                    >
                      <X size="$1" color={colors.textPrimary} />
                    </Button>
                  </Dialog.Close>

                  <YStack flex={1} marginTop="$2" minHeight={0}>
                    {/* Fixed header content */}
                    {session?.user && (
                      <View
                        backgroundColor={colors.backgroundTertiary}
                        padding="$3"
                        borderRadius="$3"
                        marginBottom="$3"
                      >
                        <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
                          {session.user.name}
                        </Text>
                        <Text fontSize="$3" color={colors.textSecondary}>
                          {(session.user as any)?.role || 'Guest'}
                        </Text>
                      </View>
                    )}

                    {/* Scrollable navigation content */}
                    <YStack flex={1} minHeight={0}>
                      <NavigationMenu
                        session={session}
                        currentPath={currentPath}
                        colors={colors}
                        navigateTo={navigateAndClose}
                        setTheme={(theme: 'light' | 'dark') => setTheme(theme)}
                        isMobile={true}
                      />
                    </YStack>

                    {/* Fixed footer content */}
                    <YStack
                      gap="$2"
                      marginTop="$3"
                      paddingTop="$2"
                      borderTopWidth={1}
                      borderTopColor={colors.border}
                    >
                      {session?.user ? (
                        <NavitemLogout handleOpenChange={handleOpenChange} />
                      ) : (
                        <LogInUser handleOpenChange={handleOpenChange} />
                      )}
                    </YStack>
                  </YStack>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog>
          </XStack>
        </XStack>
      </View>
    </>
  )
}

// Shared Navigation Menu Component
type NavigationMenuProps = NavigationProps & {
  isMobile?: boolean
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({
  session,
  currentPath,
  colors,
  navigateTo,
  isMobile = false,
}) => {
  const [isDesignExpanded, setIsDesignExpanded] = useState(false)
  const [isCommunicationExpanded, setIsCommunicationExpanded] = useState(false)

  // Check if any design page is currently active
  const isDesignPageActive = designPages.some((page) => currentPath === page.path)
  
  // Check if any communication page is currently active
  const isCommunicationPageActive = communicationPages.some((page) => currentPath === page.path)

  const NavigationContent = (
    <>
      {/* Main Navigation */}
      <YStack gap="$1">
        <Text fontSize="$2" fontWeight="600" color={colors.textSecondary} textTransform="uppercase">
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
            paddingVertical={isMobile ? '$3' : '$2'}
            hoverStyle={{
              backgroundColor:
                currentPath === page.path ? colors.primaryHover : colors.backgroundSecondary,
            }}
          >
            <Text
              color={currentPath === page.path ? colors.primaryForeground : colors.textPrimary}
              fontWeight={currentPath === page.path ? '600' : '400'}
              fontSize={isMobile ? '$4' : '$3'}
              hoverStyle={{
                color: currentPath === page.path ? colors.primaryForeground : colors.textSecondary,
              }}
            >
              {page.label}
            </Text>
          </Button>
        ))}
      </YStack>

      {/* Admin Navigation */}
      {session?.user &&
        ((session.user as any)?.role === ROLES.ADMIN ||
          (session.user as any)?.role === ROLES.OWNER) && (
          <YStack gap="$1">
            <Text
              fontSize="$2"
              fontWeight="600"
              color={colors.textSecondary}
              textTransform="uppercase"
            >
              Admin Tools
            </Text>

            {/* Regular Admin Pages */}
            {adminPages.map((page) => (
              <Button
                key={page.path}
                onPress={navigateTo(page.path)}
                backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical={isMobile ? '$3' : '$2'}
                hoverStyle={{
                  backgroundColor:
                    currentPath === page.path ? colors.primaryHover : colors.backgroundSecondary,
                }}
              >
                <Text
                  color={currentPath === page.path ? colors.primaryForeground : colors.textPrimary}
                  fontWeight={currentPath === page.path ? '600' : '400'}
                  fontSize={isMobile ? '$4' : '$3'}
                  hoverStyle={{
                    color:
                      currentPath === page.path ? colors.primaryForeground : colors.textSecondary,
                  }}
                >
                  {page.label}
                </Text>
              </Button>
            ))}

            {/* Communication Tools Accordion */}
            <YStack gap="$1">
              {/* Communication Section Header */}
              <Button
                onPress={() => setIsCommunicationExpanded(!isCommunicationExpanded)}
                backgroundColor={isCommunicationPageActive ? colors.backgroundSecondary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical={isMobile ? '$3' : '$2'}
                hoverStyle={{
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <XStack alignItems="center" gap="$2" flex={1}>
                  {isCommunicationExpanded ? (
                    <ChevronDown size="$1" color={colors.textSecondary} />
                  ) : (
                    <ChevronRight size="$1" color={colors.textSecondary} />
                  )}
                  <Text
                    color={isCommunicationPageActive ? colors.primary : colors.textPrimary}
                    fontWeight={isCommunicationPageActive ? '600' : '400'}
                    fontSize={isMobile ? '$4' : '$3'}
                  >
                    📧 Communication
                  </Text>
                </XStack>
              </Button>

              {/* Communication Pages - Only show when expanded */}
              {isCommunicationExpanded && (
                <YStack gap="$1" paddingLeft="$4">
                  {communicationPages.map((page) => (
                    <Button
                      key={page.path}
                      onPress={navigateTo(page.path)}
                      backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                      borderRadius="$2"
                      justifyContent="flex-start"
                      paddingHorizontal="$3"
                      paddingVertical={isMobile ? '$3' : '$2'}
                      hoverStyle={{
                        backgroundColor:
                          currentPath === page.path
                            ? colors.primaryHover
                            : colors.backgroundSecondary,
                      }}
                    >
                      <Text
                        color={
                          currentPath === page.path ? colors.primaryForeground : colors.textPrimary
                        }
                        fontWeight={currentPath === page.path ? '600' : '400'}
                        fontSize={isMobile ? '$4' : '$3'}
                        hoverStyle={{
                          color:
                            currentPath === page.path
                              ? colors.primaryForeground
                              : colors.textSecondary,
                        }}
                      >
                        {page.label}
                      </Text>
                    </Button>
                  ))}
                </YStack>
              )}
            </YStack>

            {/* Design Tools Accordion */}
            <YStack gap="$1">
              {/* Design Section Header */}
              <Button
                onPress={() => setIsDesignExpanded(!isDesignExpanded)}
                backgroundColor={isDesignPageActive ? colors.backgroundSecondary : 'transparent'}
                borderRadius="$2"
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical={isMobile ? '$3' : '$2'}
                hoverStyle={{
                  backgroundColor: colors.backgroundSecondary,
                }}
              >
                <XStack alignItems="center" gap="$2" flex={1}>
                  {isDesignExpanded ? (
                    <ChevronDown size="$1" color={colors.textSecondary} />
                  ) : (
                    <ChevronRight size="$1" color={colors.textSecondary} />
                  )}
                  <Text
                    color={isDesignPageActive ? colors.primary : colors.textPrimary}
                    fontWeight={isDesignPageActive ? '600' : '400'}
                    fontSize={isMobile ? '$4' : '$3'}
                  >
                    🎨 Design
                  </Text>
                </XStack>
              </Button>

              {/* Design Pages - Only show when expanded */}
              {isDesignExpanded && (
                <YStack gap="$1" paddingLeft="$4">
                  {designPages.map((page) => (
                    <Button
                      key={page.path}
                      onPress={navigateTo(page.path)}
                      backgroundColor={currentPath === page.path ? colors.primary : 'transparent'}
                      borderRadius="$2"
                      justifyContent="flex-start"
                      paddingHorizontal="$3"
                      paddingVertical={isMobile ? '$3' : '$2'}
                      hoverStyle={{
                        backgroundColor:
                          currentPath === page.path
                            ? colors.primaryHover
                            : colors.backgroundSecondary,
                      }}
                    >
                      <Text
                        color={
                          currentPath === page.path ? colors.primaryForeground : colors.textPrimary
                        }
                        fontWeight={currentPath === page.path ? '600' : '400'}
                        fontSize={isMobile ? '$4' : '$3'}
                        hoverStyle={{
                          color:
                            currentPath === page.path
                              ? colors.primaryForeground
                              : colors.textSecondary,
                        }}
                      >
                        {page.label}
                      </Text>
                    </Button>
                  ))}
                </YStack>
              )}
            </YStack>
          </YStack>
        )}
    </>
  )

  // Return scrollable version for mobile, regular for desktop
  if (isMobile) {
    return (
      <YStack
        flex={1}
        overflow="scroll"
        maxHeight="100%"
        paddingRight="$2" // Space for scrollbar
      >
        {NavigationContent}
      </YStack>
    )
  }

  return <>{NavigationContent}</>
}
