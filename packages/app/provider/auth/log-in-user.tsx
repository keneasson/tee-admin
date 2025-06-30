'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

import { NavItem, Text } from '@my/ui'

type LogInUserProps = {
  handleOpenChange?: () => void
}

export const LogInUser: React.FC<LogInUserProps> = ({ handleOpenChange }) => {
  const router = useRouter()

  const handleSignInPress = () => {
    handleOpenChange && handleOpenChange()
    router.push('/auth/signin')
  }

  return (
    <>
      <NavItem onPress={handleSignInPress}>
        <Text>Sign In</Text>
      </NavItem>
    </>
  )
}
