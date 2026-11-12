import { useCallback, useState } from 'react'
import { YStack, XStack, Text, Card, Heading, Paragraph, Button, Spinner } from '@my/ui'
import { callApi, withToken } from './api'
import { INVITE_TYPE_LABEL, formatWhen, formatDate } from './format'
import {
  InviteIdentityHeader,
  InviteIdentityStates,
  InvitePageColumn,
  Notice,
  ShortNoticeCallout,
} from './identity-parts'
import { useInviteIdentity, type InviteIdentitySlots } from './use-invite-identity'
import type { SwapView } from './types'

/**
 * The other speaker's page, `/invite/swap/{swapId}?token=…` (spec §7.3–7.6):
 * "{Name} asks to trade {their date} for your {date}", Accept / Decline (POST).
 * The same identity handling as the invitation page (`useInviteIdentity`).
 */
export interface SwapResponseScreenProps {
  swapId: string
  token: string | null
  /** `?action=` from the email's buttons. Only highlights a choice; a button press still posts. */
  preselectAction?: 'accept' | 'decline' | null
  slots: InviteIdentitySlots
  selfUrl: string
  selfUrlWithoutToken: string
}

type SwapResponse = { swap: SwapView }

function surnameOf(name: string | undefined): string {
  const parts = name?.trim().split(/\s+/) ?? []
  return parts.length > 1 ? `Brother ${parts[parts.length - 1]}` : parts[0] || 'the invited speaker'
}

const ERROR_TEXT: Record<string, string> = {
  SWAP_STALE: 'One of the two bookings changed since this request was sent, so the swap can’t go ahead. Nothing was changed.',
  SWAP_EXPIRED: 'This swap request has expired. Nothing was changed.',
  SWAP_CLOSED: 'This swap request has already been answered.',
}

export function SwapResponseScreen(props: SwapResponseScreenProps) {
  const { swapId, token, slots } = props
  const load = useCallback(
    () => callApi<SwapResponse>(withToken(`/api/invite/swap/${encodeURIComponent(swapId)}`, token)),
    [swapId, token]
  )
  const identity = useInviteIdentity<SwapResponse>({ load, token, slots })
  const swap = identity.data?.swap ?? null
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const respond = async (action: 'accept' | 'decline') => {
    setBusy(action)
    setError(null)
    const res = await callApi<SwapResponse>(`/api/invite/swap/${encodeURIComponent(swapId)}`, {
      method: 'POST',
      body: { action, ...(token ? { token } : {}) },
    })
    setBusy(null)
    if (res.ok) return identity.setData(res.data)
    if (await identity.handleRefusal(res.error)) return
    setError(ERROR_TEXT[res.error.code ?? ''] ?? res.error.error ?? 'We couldn’t record your answer. Please try again.')
    if (res.error.code && res.error.code in ERROR_TEXT) void identity.reload()
  }

  if (identity.phase !== 'ready' || !swap) {
    return (
      <InvitePageColumn>
        <InviteIdentityStates identity={identity} slots={slots} callbackUrl={props.selfUrl} noun="swap request" />
      </InvitePageColumn>
    )
  }

  // The viewer is the target: their own name comes back unredacted.
  const who = surnameOf(swap.target.name)
  const requester = swap.requester.name ?? 'Another speaker'
  const theirs = formatWhen(swap.requester.date, swap.requester.time, swap.requester.tz)
  const yours = formatWhen(swap.target.date, swap.target.time, swap.target.tz)

  return (
    <InvitePageColumn>
      <InviteIdentityHeader
        title={`Swap request for ${who}`}
        who={who}
        onSignInAgain={() => slots.signInAgain(props.selfUrlWithoutToken)}
        switchedNotice={
          identity.switched
            ? `You were signed in as someone else, so we've switched to ${swap.target.name?.split(/\s+/)[0] || who}'s swap request.`
            : null
        }
      />

      <Card padding="$4" gap="$3" bordered testID="swap-summary">
        <Text fontSize="$2" color="$colorSecondary" textTransform="uppercase">
          {`${INVITE_TYPE_LABEL[swap.type]} at ${swap.ecclesia}`}
        </Text>
        <Heading size="$6">{`${requester} asks to trade ${theirs} for your ${yours}`}</Heading>
        {swap.note ? <Text fontStyle="italic">{`“${swap.note}”`}</Text> : null}
      </Card>

      <ShortNoticeCallout notices={swap.shortNotice} />
      {error ? <Notice tone="error">{error}</Notice> : null}

      {swap.status === 'open' ? (
        <YStack gap="$2">
          {props.preselectAction ? (
            <Notice tone="info" testID="swap-preselected">
              {props.preselectAction === 'accept'
                ? 'You chose Accept in the email. Press “Accept the swap” to confirm.'
                : 'You chose Decline in the email. Press “Decline” to confirm.'}
            </Notice>
          ) : null}
          <Paragraph>
            If you accept, you’ll speak on {formatDate(swap.requester.date)} instead, and {requester} takes your date.
            You’ll both get new confirmations.
          </Paragraph>
          <XStack gap="$2" flexWrap="wrap">
            <Button
              variant={props.preselectAction === 'decline' ? 'outlined' : 'action'}
              size="$5"
              disabled={busy !== null}
              icon={busy === 'accept' ? <Spinner size="small" /> : undefined}
              onPress={() => respond('accept')}
              testID="swap-accept"
            >
              Accept the swap
            </Button>
            <Button
              variant={props.preselectAction === 'decline' ? 'danger' : 'outlined'}
              size="$5"
              disabled={busy !== null}
              onPress={() => respond('decline')}
              testID="swap-decline"
            >
              Decline
            </Button>
          </XStack>
        </YStack>
      ) : (
        <Notice tone={swap.status === 'accepted' ? 'success' : 'info'} testID="swap-outcome">
          {swap.status === 'accepted'
            ? `Swap done. You’re now booked for ${theirs}. A new confirmation is on its way.`
            : swap.status === 'declined'
              ? `You declined. Your booking for ${yours} stays as it was, and ${requester} has been told.`
              : swap.status === 'expired'
                ? 'This swap request has expired. Nothing was changed.'
                : 'This swap couldn’t go ahead because one of the bookings changed. Nothing was changed.'}
        </Notice>
      )}
    </InvitePageColumn>
  )
}
