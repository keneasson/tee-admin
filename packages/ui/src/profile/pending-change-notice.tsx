import React from 'react'
import { YStack, XStack, Text } from 'tamagui'
import { Button } from '../Button'
import { AlertTriangle, Check } from '@tamagui/lucide-icons'
import type { ConfirmationProgress } from '@my/app/utils/contact-verification'

/**
 * The marker on a contact value somebody has proposed but nobody has confirmed.
 *
 * TRANSPARENCY, NOT HIDING — the confirmed value keeps its place and its green
 * check, and this sits on the proposal. Someone who hears Brian has moved to a
 * home in Hamilton sees the confirmed Campbellcroft address and the unconfirmed
 * Hamilton one, and decides for themselves where to send the gift.
 *
 * DELIBERATELY TERSE. An earlier version explained itself in two sentences and
 * named the proposer by email address, which told the reader nothing —
 * `kie@whoknows.com` is not a person you recognise — and buried the one thing
 * that matters: this value is not confirmed, and here is how close it is. The
 * green check on the other value carries the rest of the meaning.
 *
 * Two actions, not the same button:
 *   - **Verify** — somebody with authority over the record. One click settles it.
 *   - **I can confirm** — a member vouching. Two of those settle it, so the
 *     member whose record it is never has to click anything.
 */
export interface PendingChangeNoticeProps {
  /** Community confirmation state from the API. Absent = count unavailable. */
  confirmation?: ConfirmationProgress
  /** Viewer has direct authority to verify (owner/admin/RB/Rep). */
  canVerify?: boolean
  onVerify?: () => void
  onConfirm?: () => void
  /** An action is in flight — both buttons disable together. */
  busy?: boolean
  /**
   * Why the last attempt failed, shown right here.
   *
   * Errors used to be stored in state that only rendered inside the "add
   * contact" forms, so a failed Verify showed the spinner, then nothing at all
   * — indistinguishable from success. A failure has to say so where it happened.
   */
  error?: string | null
}

export function PendingChangeNotice({
  confirmation,
  canVerify,
  onVerify,
  onConfirm,
  busy,
  error,
}: PendingChangeNoticeProps) {
  return (
    <YStack gap="$1" testID="pending-change-notice">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <AlertTriangle size={14} color="$yellow11" />
        <Text fontSize="$2" fontWeight="700" color="$yellow11">
          NOT VERIFIED
        </Text>
        {confirmation ? (
          <Text fontSize="$2" color="$color11">
            {confirmation.label}
          </Text>
        ) : null}

        {canVerify && onVerify ? (
          <Button size="$2" theme="green" disabled={busy} onPress={onVerify}>
            {busy ? 'Verifying…' : 'Verify'}
          </Button>
        ) : null}

        {!canVerify && confirmation?.canConfirm && onConfirm ? (
          <Button size="$2" theme="blue" icon={Check} disabled={busy} onPress={onConfirm}>
            {busy ? 'Recording…' : 'I can confirm'}
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
      </XStack>

      {error ? (
        <Text fontSize="$2" color="$red10">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}
