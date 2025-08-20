'use client'

import { ROLES } from '@my/app/provider/auth/auth-roles'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { NavitemLogout } from '@my/app/provider/auth/navItem-logout'
import {
  Button,
  Dialog,
  NavHeading,
  NavigationButtonItem,
  Text,
  useMedia,
  XStack,
  YStack,
} from '@my/ui'
import { Menu } from '@tamagui/lucide-icons/icons/Menu'
import { X } from '@tamagui/lucide-icons/icons/X'
import { useSession } from 'next-auth/react'
import React, { useState } from 'react'
import { usePathname, useRouter } from 'solito/navigation'

type WithNavigationProps = {
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

export const WithNavigation: React.FC<WithNavigationProps> = ({ children }) => {
  const media = useMedia()
  const { data: session } = useSession()

  return (
    <XStack flex={1}>
      <XStack
        $lg={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 999,
        }}
        $gtLg={{
          position: 'relative',
          backgroundColor: 'wheat',
          minWidth: 200,
          flex: 1,
        }}
      >
        {!media.lg ? <MainNavigation session={session} /> : <SmallScreenNav session={session} />}
      </XStack>
      <XStack
        display={'block'}
        $lg={{
          flex: 1,
        }}
        $gtLg={{
          minWidth: 800,
          flex: 4,
        }}
      >
        {children}
      </XStack>
    </XStack>
  )
}

type SmallScreenNavProps = {
  session: any | null
}
const SmallScreenNav: React.FC<SmallScreenNavProps> = ({ session }) => {
  const [open, setOpen] = useState(false)

  const handleOpenChange = () => {
    setOpen(false)
  }
  return (
    <Dialog
      open={open}
      modal
      onOpenChange={(open) => {
        setOpen(open)
      }}
    >
      <Dialog.Trigger asChild>
        <Button>
          <Menu size={'$1'} />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay key="overlay" opacity={10} />
        <Dialog.Content width={'100%'} height={'100%'} borderWidth={1} borderColor={'red'}>
          <MainNavigation handleOpenChange={handleOpenChange} session={session} />
          <Dialog.Close>
            <Button position="absolute" top="$3" right="$3" size="$2" circular icon={X} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

type MainNavigationProps = {
  handleOpenChange?: () => void
  session?: any | null
}
const MainNavigation: React.FC<MainNavigationProps> = ({ handleOpenChange, session }) => {
  const router = useRouter()
  const path = usePathname()
  const linkTo = (route: string) => {
    return () => {
      handleOpenChange && handleOpenChange()
      router.push(route)
    }
  }

  return (
    <>
      <YStack width={'100%'} paddingTop={24} paddingLeft={10} paddingRight={0} gap={25}>
        {session && session.user && (
          <>
            <NavHeading>
              <Text>Welcome {session.user.name}</Text>
            </NavHeading>
            {(session.user.role === ROLES.ADMIN || session.user.role === ROLES.OWNER) && (
              <AdminOwnerMenu linkTo={linkTo} path={path} />
            )}
            {(session.user.role === ROLES.MEMBER ||
              session.user.role === ROLES.ADMIN ||
              session.user.role === ROLES.OWNER) && <MemberMenu linkTo={linkTo} path={path} />}
          </>
        )}
        {pages.map((page, i) => (
          <NavigationButtonItem
            key={i}
            linkTo={linkTo(page.path)}
            text={page.label}
            active={path === page.path}
          />
        ))}
        {session && session.user ? (
          <NavitemLogout handleOpenChange={handleOpenChange} />
        ) : (
          <LogInUser handleOpenChange={handleOpenChange} />
        )}
      </YStack>
    </>
  )
}

type SubMenuType = {
  linkTo: (route: string) => () => void
  path?: string
}
const AdminOwnerMenu: React.FC<SubMenuType> = ({ linkTo, path }) => {
  return (
    <>
      <NavigationButtonItem
        key="emailTester"
        linkTo={linkTo('/email-tester')}
        text="Email Tester"
        active={path === '/email-tester'}
      />
      <NavigationButtonItem
        key="brandColours"
        linkTo={linkTo('/brand/colours')}
        text="Brand Colors"
        active={path === '/brand/colours'}
      />
      <NavigationButtonItem
        key="brandTypography"
        linkTo={linkTo('/brand/typography')}
        text="Brand Typography"
        active={path === '/brand/typography'}
      />
      <NavigationButtonItem
        key="brandComponents"
        linkTo={linkTo('/brand/components')}
        text="Component Showcase"
        active={path === '/brand/components'}
      />
      <NavigationButtonItem
        key="brandNavigation"
        linkTo={linkTo('/brand/navigation')}
        text="Navigation Testing"
        active={path === '/brand/navigation'}
      />
      <NavigationButtonItem
        key="brandPlayground"
        linkTo={linkTo('/brand/playground')}
        text="Feature Playground"
        active={path === '/brand/playground'}
      />
    </>
  )
}

const MemberMenu: React.FC<SubMenuType> = ({ linkTo, path }) => {
  return (
    <NavigationButtonItem
      key="profile"
      linkTo={linkTo('/profile')}
      text="Profile"
      active={path === '/profile'}
    />
  )
}
