import React from 'react'
import { signOut } from 'next-auth/react'
import { lightColors } from '@tamagui/themes'
import { NavItem, Text } from '@my/ui'

export const NavitemLogout: React.FC = () => {
  return (
    <>
      <NavItem onPress={() => signOut()}>
        <Text fontWeight={'bold'} color={lightColors.red10}>
          Sign Out
        </Text>
      </NavItem>
    </>
  )
}
