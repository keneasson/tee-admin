'use client'

import { XStack, YStack, Text } from 'tamagui'
import { Lock, LogIn } from '@tamagui/lucide-icons'
import type { Withheld, WithheldKind } from '@my/app/utils/viewer-pii'
import { Button } from '../Button'

/**
 * "Never hide silently" (#252, ADR-0005). When the server withholds personal
 * details from a reader it could not identify, the page SAYS so and offers the
 * way back in — it never just renders less.
 *
 *  - {@link WithheldBanner}: one prominent notice near the top of the page
 *    listing what was held back, with a Sign in button.
 *  - {@link WithheldInline}: a placeholder rendered EXACTLY where a withheld
 *    field would have been ("Email: sign in to see the contact email").
 *
 * The pattern every view must follow (rule c):
 *   value ? <Value/> : withheld.includes(kind) ? <WithheldInline/> : null
 * never `value && <Value/>` on its own for a redactable field.
 *
 * Platform-free: navigation is the caller's `onSignIn` (Next.js → /auth/signin
 * with a callbackUrl back to this page; Expo → its own sign-in screen).
 */

const KIND_LABEL: Record<WithheldKind, string> = {
  contact: 'contact email and phone',
  name: 'full names',
  'location-precise': 'street address and directions',
  bio: 'personal details and photos',
  'members-content': 'members-only sections',
}

/** "contact email and phone, full names and street address" — human list. */
export function describeWithheld(withheld: Withheld): string {
  const parts = withheld.map((k) => KIND_LABEL[k])
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

export function hasWithheld(withheld: Withheld | undefined, kind?: WithheldKind): boolean {
  if (!withheld || withheld.length === 0) return false
  return kind ? withheld.includes(kind) : true
}

interface WithheldBannerProps {
  withheld?: Withheld
  onSignIn?: () => void
}

export function WithheldBanner({ withheld, onSignIn }: WithheldBannerProps) {
  if (!hasWithheld(withheld)) return null
  return (
    <YStack
      role="status"
      gap="$3"
      padding="$4"
      borderRadius="$4"
      borderWidth={2}
      borderColor="$yellow8"
      backgroundColor="$yellow2"
    >
      <XStack gap="$2" alignItems="center">
        <Lock size={20} color="$yellow11" />
        <Text fontSize="$5" fontWeight="700" color="$yellow12">
          Some details are hidden until you sign in
        </Text>
      </XStack>
      <Text fontSize="$4" color="$yellow12">
        To protect our members' privacy we don't show the {describeWithheld(withheld ?? [])} to
        readers we can't identify. Sign in to see everything on this page.
      </Text>
      {onSignIn ? (
        <Button variant="action" size="$4" alignSelf="flex-start" icon={LogIn} onPress={onSignIn}>
          Sign in to see all details
        </Button>
      ) : null}
    </YStack>
  )
}

interface WithheldInlineProps {
  /** What is missing, e.g. "the contact email". */
  what: string
  onSignIn?: () => void
}

export function WithheldInline({ what, onSignIn }: WithheldInlineProps) {
  return (
    <XStack gap="$2" alignItems="center" flexWrap="wrap">
      <Lock size={14} color="$gray11" />
      {onSignIn ? (
        <Text
          fontSize="$4"
          color="$blue10"
          fontWeight="600"
          textDecorationLine="underline"
          cursor="pointer"
          onPress={onSignIn}
        >
          Sign in to see {what}
        </Text>
      ) : (
        <Text fontSize="$4" color="$gray11">
          Sign in to see {what}
        </Text>
      )}
    </XStack>
  )
}
