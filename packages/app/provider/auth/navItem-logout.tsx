'use client'

import React from 'react'
import { signOut } from 'next-auth/react'
import { NavItem, Text } from '@my/ui'

type NavitemLogoutProps = {
  handleOpenChange?: () => void
}

export const NavitemLogout: React.FC<NavitemLogoutProps> = ({ handleOpenChange }) => {
  const handleSignOut = () => {
    handleOpenChange && handleOpenChange()
    signOut({ callbackUrl: '/' })
  }

  return (
    <>
      <NavItem onPress={handleSignOut}>
        <Text fontWeight={'bold'} color={'$red10Light'}>
          Sign Out
        </Text>
      </NavItem>
    </>
  )
}
