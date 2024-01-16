import React, { useState } from 'react'
import {
  Button,
  Dialog,
  NavigationButtonItem,
  NavItem,
  Text,
  useMedia,
  XStack,
  YStack,
} from '@my/ui'
import { usePathname, useRouter } from 'solito/navigation'
import { Menu, X } from '@tamagui/lucide-icons'
import { useSession } from 'next-auth/react'
import { Session } from 'next-auth'
import { NavitemLogout } from 'app/provider/auth/navItem-logout'
import { LogInUser } from 'app/provider/auth/log-in-user'

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
]

export const WithNavigation: React.FC<WithNavigationProps> = ({ children }) => {
  const media = useMedia()
  const { data: session } = useSession()
  
  return (
    <XStack f={1}>
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
          minWidth: 120,
          f: 1,
        }}
      >
        {media.gtLg ? <MainNavigation session={session} /> : <SmallScreenNav session={session} />}
      </XStack>
      <XStack
        display={'block'}
        $lg={{
          flex: 1,
        }}
        $gtLg={{
          minWidth: 1000,
          f: 5,
        }}
      >
        {children}
      </XStack>
    </XStack>
  )
}

type SmallScreenNavProps = {
  session: Session | null
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
  session?: Session | null
}
const MainNavigation: React.FC<MainNavigationProps> = ({ handleOpenChange, session }) => {
  const router = useRouter()
  const path = usePathname()
  console.log('path', path)
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
          <NavItem>
            <Text>Welcome {session.user.name}</Text>
          </NavItem>
        )}
        {pages.map((page) => (
          <NavigationButtonItem
            linkTo={linkTo(page.path)}
            text={page.label}
            active={path === page.path}
          />
        ))}
        {session && session.user ? <NavitemLogout /> : <LogInUser />}
      </YStack>
    </>
  )
}
