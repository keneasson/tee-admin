'use client'

import React from 'react'
import { XStack, Text } from '@my/ui'

/**
 * Shown on every page when the session came from test sign-in (#349), so a
 * test session can never be mistaken for a real one.
 */
export function TestSigninBanner({ testSignin, name }: { testSignin: boolean; name?: string | null }) {
  if (!testSignin) return null
  return (
    <XStack
      backgroundColor="$orange9"
      paddingVertical="$2"
      paddingHorizontal="$3"
      justifyContent="center"
      role="status"
    >
      <Text color="white" fontWeight="700">
        {`Test sign-in: ${name || 'test person'} (preview)`}
      </Text>
    </XStack>
  )
}
