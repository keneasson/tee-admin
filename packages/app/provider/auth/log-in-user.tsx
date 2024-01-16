import React from 'react'
import { signIn } from 'next-auth/react'

import { NavItem, Text } from '@my/ui'

export const LogInUser: React.FC = () => {
  return (
    <>
      <NavItem onPress={() => signIn()}>
        <Text>Sign In</Text>
      </NavItem>
    </>
  )
}
