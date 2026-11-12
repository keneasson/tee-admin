import type { ReactNode } from 'react'
import { YStack, XStack, Text, Heading, Card, Paragraph, Button, LoadingState } from '@my/ui'
import { AlertTriangle, Info } from '@tamagui/lucide-icons'
import type { InviteContact, ShortNotice } from './types'
import { formatDate } from './format'
import type { InviteIdentityState, InviteIdentitySlots } from './use-invite-identity'

/** Narrow centred column shared by the invite pages (they have no admin chrome). */
export function InvitePageColumn({ children }: { children: ReactNode }) {
  return (
    <YStack width="100%" maxWidth={640} alignSelf="center" padding="$4" gap="$4">
      {children}
    </YStack>
  )
}

/**
 * "Invitation for Brother {Surname}. (Not Brother {Surname}? Sign in again)" —
 * the page always names who it is acting as (spec §6).
 */
export function InviteIdentityHeader({
  title,
  who,
  onSignInAgain,
  switchedNotice,
}: {
  title: string
  who: string
  onSignInAgain: () => void
  switchedNotice?: string | null
}) {
  return (
    <YStack gap="$2">
      <Heading size="$8" testID="invite-heading">
        {title}
      </Heading>
      <Text
        fontSize="$2"
        color="$colorSecondary"
        textDecorationLine="underline"
        cursor="pointer"
        role="link"
        testID="invite-sign-in-again"
        onPress={onSignInAgain}
        hoverStyle={{ color: '$color' }}
      >
        (Not {who}? Sign in again)
      </Text>
      {switchedNotice ? (
        <Notice tone="info" testID="invite-switched-notice">
          {switchedNotice}
        </Notice>
      ) : null}
    </YStack>
  )
}

export function Notice({
  tone,
  children,
  testID,
}: {
  tone: 'info' | 'warning' | 'error' | 'success'
  children: ReactNode
  testID?: string
}) {
  const palette = {
    info: { bg: '$blue2', border: '$blue6', fg: '$blue11' },
    warning: { bg: '$yellow2', border: '$yellow7', fg: '$yellow11' },
    error: { bg: '$red2', border: '$red6', fg: '$red11' },
    success: { bg: '$green2', border: '$green6', fg: '$green11' },
  }[tone]
  return (
    <Card padding="$3" backgroundColor={palette.bg} borderWidth={1} borderColor={palette.border} testID={testID}>
      <XStack gap="$2" alignItems="flex-start">
        {tone === 'info' || tone === 'success' ? (
          <Info size={16} color={palette.fg} />
        ) : (
          <AlertTriangle size={16} color={palette.fg} />
        )}
        <Text flex={1} color={palette.fg}>
          {children}
        </Text>
      </XStack>
    </Card>
  )
}

/** "Please inform the Presiding brother of this change" (spec §7.6). */
export function ShortNoticeCallout({ notices }: { notices: ShortNotice[] | undefined }) {
  if (!notices || notices.length === 0) return null
  return (
    <YStack gap="$2" testID="short-notice">
      {notices.map((n) => (
        <Notice key={`${n.date}-${n.counterpartRole}`} tone="warning">
          {`This change is at short notice. Please inform the ${n.counterpartRole} brother${
            n.counterpartName ? ` (${n.counterpartName})` : ''
          } of this change for ${formatDate(n.date)}.`}
        </Notice>
      ))}
    </YStack>
  )
}

export function InviterContactLine({ inviter }: { inviter: InviteContact | null | undefined }) {
  if (!inviter) {
    return <Paragraph color="$colorSecondary">Reply to the email that brought you here and the sender will help.</Paragraph>
  }
  return (
    <Paragraph color="$colorSecondary" testID="inviter-contact">
      {`Questions? Contact ${inviter.name}${inviter.email ? ` at ${inviter.email}` : ''}.`}
    </Paragraph>
  )
}

/**
 * Everything the identity hook can end in, other than "ready". Each is a
 * clear message with a way forward, never a blank page (ADR-0005).
 */
export function InviteIdentityStates<T>({
  identity,
  slots,
  callbackUrl,
  noun,
}: {
  identity: InviteIdentityState<T>
  slots: InviteIdentitySlots
  /** Where sign-in returns to (this page). */
  callbackUrl: string
  /** "invitation" | "swap request" */
  noun: string
}) {
  if (identity.phase === 'loading') return <LoadingState label={noun} />

  if (identity.phase === 'sign-in') {
    return (
      <Card padding="$5" gap="$3" bordered testID="invite-sign-in">
        <Heading size="$6">Sign in to see this {noun}</Heading>
        <Paragraph>
          This link didn’t include a valid sign-in, or it has expired. Sign in with the email address the {noun} was
          sent to and you’ll come straight back here.
        </Paragraph>
        <XStack>
          <Button variant="action" onPress={() => slots.startSignIn(callbackUrl)}>
            Sign in
          </Button>
        </XStack>
      </Card>
    )
  }

  if (identity.phase === 'not-invitee') {
    return (
      <Card padding="$5" gap="$3" bordered testID="invite-not-invitee">
        <Heading size="$6">This {noun} is for someone else</Heading>
        <Paragraph>
          You’re signed in as a different person. If this {noun} is yours, sign in with the email address it was sent
          to, or open the link in that email again.
        </Paragraph>
        <XStack>
          <Button variant="action" onPress={() => slots.signInAgain(callbackUrl)}>
            Sign in as someone else
          </Button>
        </XStack>
      </Card>
    )
  }

  if (identity.phase === 'not-found') {
    return (
      <Card padding="$5" gap="$3" bordered testID="invite-not-found">
        <Heading size="$6">We couldn’t find this {noun}</Heading>
        <Paragraph>
          The link may be incomplete or the {noun} may have been removed. Check the link in your email, or reply to
          that email and the sender will help.
        </Paragraph>
      </Card>
    )
  }

  if (identity.phase === 'error') {
    return (
      <Card padding="$5" gap="$3" bordered testID="invite-error">
        <Heading size="$6">Something went wrong loading this {noun}</Heading>
        <Paragraph>{identity.error?.error || 'Please try again in a moment.'}</Paragraph>
        <XStack>
          <Button variant="outlined" onPress={() => void identity.reload()}>
            Try again
          </Button>
        </XStack>
      </Card>
    )
  }

  return null
}

/** A row-sized choice button: a date, its time, and why it can't be chosen. */
export function DateChoice({
  label,
  detail,
  selected,
  disabled,
  onPress,
  testID,
}: {
  label: string
  detail?: string
  selected: boolean
  disabled?: boolean
  onPress?: () => void
  testID?: string
}) {
  return (
    <Button
      size="$6"
      height="auto"
      paddingVertical="$3"
      justifyContent="flex-start"
      variant={selected ? 'action' : 'outlined'}
      disabled={disabled}
      opacity={disabled ? 0.55 : 1}
      onPress={disabled ? undefined : onPress}
      aria-pressed={selected}
      testID={testID}
    >
      <YStack alignItems="flex-start" gap="$1">
        <Text fontSize="$5" fontWeight="600" color={selected ? '$primaryForeground' : '$color'}>
          {label}
        </Text>
        {detail ? (
          <Text fontSize="$3" color={selected ? '$primaryForeground' : '$colorSecondary'}>
            {detail}
          </Text>
        ) : null}
      </YStack>
    </Button>
  )
}
