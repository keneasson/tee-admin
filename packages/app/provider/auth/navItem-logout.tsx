import React from 'react'
import { signOut } from 'next-auth/react'
import { NavItem, Text } from '@my/ui'

export const NavitemLogout: React.FC = () => {
  return (
    <>
      <NavItem onPress={() => signOut()}>
        <Text fontWeight={'bold'} color={'$red10Light'}>
          Sign Out
        </Text>
      </NavItem>
    </>
  )
}
