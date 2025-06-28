import React from 'react'
import { useRouter } from 'next/router'

import { NavItem, Text } from '@my/ui'

export const LogInUser: React.FC = () => {
  const router = useRouter()

  return (
    <>
      <NavItem onPress={() => router.push('/auth/signin')}>
        <Text>Sign In</Text>
      </NavItem>
    </>
  )
}
