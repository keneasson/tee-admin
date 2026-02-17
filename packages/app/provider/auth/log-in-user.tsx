'use client'

import React from 'react'

import { NavItem, Text } from '@my/ui'

type LogInUserProps = {
  handleOpenChange?: () => void
  /**
   * Navigation callback - receives the path to navigate to
   * Platform-specific (Next.js or Expo) navigation should be handled by the caller
   */
  onNavigate?: (path: string) => void
}

export const LogInUser: React.FC<LogInUserProps> = ({ handleOpenChange, onNavigate }) => {
  const handleSignInPress = () => {
    handleOpenChange && handleOpenChange()
    onNavigate?.('/auth/signin')
  }

  return (
    <>
      <NavItem onPress={handleSignInPress}>
        <Text>Sign In</Text>
      </NavItem>
    </>
  )
}
