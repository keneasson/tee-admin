import React from 'react'
import { YStack, XStack, Text } from 'tamagui'
import { Button } from '../Button'
import { AlertTriangle, Check, Users } from '@tamagui/lucide-icons'
import type { ConfirmationProgress } from '@my/app/utils/contact-verification'

/**
 * The banner shown beside a contact value that somebody has proposed changing.
 *
 * TRANSPARENCY, NOT HIDING. The last confirmed value keeps its place and stays
 * the primary; this sits alongside the proposal and says plainly that it has
 * not been confirmed, who proposed it, and how close it is to being confirmed.
 * Somebody who hears that Brian has moved to a home in Hamilton can then see
 * both the Peterborough address on file and the unconfirmed Hamilton one, and
 * decide for themselves where to send the gift. Hiding the pending change is
 * what would cost this system its credibility.
 *
 * Two different acts appear here, and they are deliberately not the same button:
 *
 *   - **Verify** — for somebody who already has authority over the record
 *     (owner, admin, Recording Brother, Rep). One click settles it.
 *   - **I can confirm this is correct** — an ordinary member vouching. Two of
 *     those settle it, so the member whose record it is never has to click
 *     anything. That matters when they are ninety-two.
 *
 * Presentational and cross-platform: every action and every permission arrives
 * as a prop.
 */
export interface PendingChangeNoticeProps {
  /** What is being proposed — used in the sentence members read. */
  contactType: 'address' | 'phone' | 'email'
  proposedBy?: string
  /** True when a previous value is still on file above this one. */
  supersedes?: boolean
  /** Community confirmation state from the API. Absent = count unavailable. */
  confirmation?: ConfirmationProgress
  /** Viewer has direct authority to verify (owner/admin/RB/Rep). */
  canVerify?: boolean
  onVerify?: () => void
  onConfirm?: () => void
  /** An action is in flight — both buttons disable together. */
  busy?: boolean
}

const NOUN: Record<PendingChangeNoticeProps['contactType'], string> = {
  address: 'address',
  phone: 'phone number',
  email: 'email address',
}

export function PendingChangeNotice({
  contactType,
  proposedBy,
  supersedes,
  confirmation,
  canVerify,
  onVerify,
  onConfirm,
  busy,
}: PendingChangeNoticeProps) {
  const noun = NOUN[contactType]

  return (
    <YStack gap="$2" testID="pending-change-notice">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <AlertTriangle size={14} color="$yellow11" />
        <Text fontSize="$2" fontWeight="700" color="$yellow11">
          NOT YET CONFIRMED
        </Text>
        {confirmation ? (
          <XStack gap="$1" alignItems="center">
            <Users size={12} color="$color11" />
            <Text fontSize="$2" color="$color11">
              {confirmation.label}
            </Text>
          </XStack>
        ) : null}
      </XStack>

      <Text fontSize="$2" color="$color11">
        {`A new ${noun} has been provided, but not verified`}
        {proposedBy ? ` — proposed by ${proposedBy}` : ''}
        {supersedes
          ? '. The value above is the last confirmed one.'
          : '.'}
      </Text>

      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        {canVerify && onVerify ? (
          <Button size="$2" theme="green" disabled={busy} onPress={onVerify}>
            {busy ? 'Confirming…' : 'Verify'}
          </Button>
        ) : null}

        {/* An ordinary member's vouch. Hidden once they have used it, so the
            page reflects what they already did rather than inviting it twice. */}
        {!canVerify && confirmation?.canConfirm && onConfirm ? (
          <Button size="$2" theme="blue" icon={Check} disabled={busy} onPress={onConfirm}>
            {busy ? 'Recording…' : 'I can confirm this is correct'}
          </Button>
        ) : null}

        {confirmation?.hasVoted ? (
          <XStack gap="$1" alignItems="center">
            <Check size={12} color="$green10" />
            <Text fontSize="$2" color="$green10">
              You confirmed this
            </Text>
          </XStack>
        ) : null}

        {/* Why they cannot vouch, in their own terms — "this is your own record"
            reads very differently from a silently missing button. */}
        {!canVerify && confirmation && !confirmation.canConfirm && !confirmation.hasVoted ? (
          <Text fontSize="$2" theme="alt2">
            {confirmation.blockedReason}
          </Text>
        ) : null}
      </XStack>
    </YStack>
  )
}
