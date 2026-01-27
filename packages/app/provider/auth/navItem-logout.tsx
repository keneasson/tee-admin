'use client'

import React from 'react'
import { NavItem, Text } from '@my/ui'

type NavitemLogoutProps = {
  handleOpenChange?: () => void
  /** Sign out function passed from platform-specific auth (Next.js or Expo) */
  onSignOut?: () => void
}

export const NavitemLogout: React.FC<NavitemLogoutProps> = ({ handleOpenChange, onSignOut }) => {
  const handleSignOut = () => {
    handleOpenChange && handleOpenChange()
    onSignOut && onSignOut()
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
