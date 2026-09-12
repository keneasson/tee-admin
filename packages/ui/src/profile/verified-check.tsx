import React from 'react'
import { XStack, Text } from 'tamagui'
import { CheckCircle2 } from '@tamagui/lucide-icons'

/**
 * The green check that marks a value as confirmed.
 *
 * ONE mark, used on every kind of verified data — phone, address, email — so
 * "confirmed" reads the same everywhere and needs no sentence to explain it. It
 * replaces prose like "the address above is the last confirmed one": if one
 * value has the check and another has the pending badge, the reader already
 * knows which is which.
 *
 * `verified === undefined` counts as confirmed. Those rows predate verification
 * and are the values the ecclesia has always worked from; only an explicit
 * `false` is a proposal waiting on confirmation.
 */
export interface VerifiedCheckProps {
  verified?: boolean
  /** Optional word next to the check. Omit it in dense lists. */
  label?: string
  size?: number
}

export function VerifiedCheck({ verified, label, size = 14 }: VerifiedCheckProps) {
  if (verified === false) return null
  return (
    <XStack gap="$1" alignItems="center" testID="verified-check">
      <CheckCircle2 size={size} color="$green10" />
      {label ? (
        <Text fontSize="$2" color="$green10">
          {label}
        </Text>
      ) : null}
    </XStack>
  )
}
