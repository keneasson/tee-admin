import React, { useState } from 'react'
import { Button, Dialog, Text, useMedia, XStack } from '@my/ui'
import { useParams, useRouter } from 'solito/navigation'
import { Menu, X } from '@tamagui/lucide-icons'
import { styled, YStack } from 'tamagui'

type WithNavigationProps = {
  children: React.ReactNode
}

export const WithNavigation: React.FC<WithNavigationProps> = ({ children }) => {
  const params = useParams()
  const media = useMedia()

  console.log('solito', params)
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
        {media.gtLg ? <MainNavigation /> : <SmallScreenNav />}
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

const SmallScreenNav: React.FC = () => {
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
          <MainNavigation handleOpenChange={handleOpenChange} />
          <Dialog.Close>
            <Button position="absolute" top="$3" right="$3" size="$2" circular icon={X} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

const NavItem = styled(XStack, {
  borderBottomColor: 'grey',
  borderBottomWidth: 1,
  alignContent: 'center',
  margin: 10,
  padding: 5,
})

type MainNavigationProps = {
  handleOpenChange?: () => void
}
const MainNavigation: React.FC<MainNavigationProps> = ({ handleOpenChange }) => {
  const router = useRouter()
  const linkTo = (route: string) => {
    return () => {
      handleOpenChange && handleOpenChange()
      router.push(route)
    }
  }
  return (
    <YStack width={'100%'} paddingTop={24} paddingHorizontal={10} gap={25}>
      <Goto linkTo={linkTo('/')} text={'Home'} />
      <Goto linkTo={linkTo('/newsletter')} text={'Newsletter'} />
      <Goto linkTo={linkTo('/schedule')} text="Schedules" />
    </YStack>
  )
}

type GoToProps = {
  linkTo: () => void
  text: string
}
const Goto: React.FC<GoToProps> = ({ linkTo, text }) => {
  return (
    <NavItem
      onPress={() => {
        linkTo()
      }}
    >
      <Text>{text}</Text>
    </NavItem>
  )
}
