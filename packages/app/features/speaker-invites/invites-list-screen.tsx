import { useCallback, useEffect, useState } from 'react'
import { YStack, XStack, Text, Card, Paragraph, Button, Separator, PageHeader, LoadingState } from '@my/ui'
import { ChevronDown, ChevronRight, Plus } from '@tamagui/lucide-icons'
import { callApi } from './api'
import { INVITE_HISTORY_ACTION_LABEL, INVITE_STATUS_LABEL, INVITE_TYPE_LABEL } from '@my/app/provider/dynamodb/speaker-invite-types'
import { formatDate, formatWhen } from './format'
import { Notice } from './identity-parts'
import { NOT_AN_INVITER } from './format'
import type { InviterInviteView } from './types'

/**
 * Invites list, `/admin/speaker-invites` (spec §9): invitee, type, offered or
 * accepted date, status, expandable history, and Cancel (confirmed in-page).
 */
export interface SpeakerInvitesListProps {
  onNew: () => void
  /** Arrived straight from a successful send. */
  justSent?: boolean
}

export function SpeakerInvitesList({ onNew, justSent }: SpeakerInvitesListProps) {
  const [invites, setInvites] = useState<InviterInviteView[] | null>(null)
  const [ecclesia, setEcclesia] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await callApi<{ ecclesia: string; invites: InviterInviteView[] }>('/api/speaker-invites')
    if (res.ok) {
      setEcclesia(res.data.ecclesia)
      setInvites([...res.data.invites].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    } else {
      setInvites([])
      setError(res.status === 403 ? NOT_AN_INVITER : res.error.error || 'Could not load invitations.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <YStack gap="$4" width="100%" maxWidth={900}>
      <PageHeader
        title={ecclesia ? `Speaker invitations · ${ecclesia}` : 'Speaker invitations'}
        actions={
          <Button variant="action" icon={Plus} onPress={onNew} testID="new-invite">
            New invitation
          </Button>
        }
      />
      {justSent ? <Notice tone="success">Invitation sent.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {invites === null ? (
        <LoadingState label="invitations" inline />
      ) : invites.length === 0 && !error ? (
        <Card padding="$4" bordered>
          <Paragraph color="$colorSecondary">No invitations yet. Use “New invitation” to send one.</Paragraph>
        </Card>
      ) : (
        <YStack gap="$2">
          {invites.map((invite) => (
            <InviteRow
              key={invite.inviteId}
              invite={invite}
              onChanged={(next) => setInvites((prev) => prev?.map((i) => (i.inviteId === next.inviteId ? next : i)) ?? prev)}
            />
          ))}
        </YStack>
      )}
    </YStack>
  )
}

function InviteRow({ invite, onChanged }: { invite: InviterInviteView; onChanged: (next: InviterInviteView) => void }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reminder, setReminder] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState<string | null>(null)
  const name = invite.invitee?.name || invite.inviteeEmail
  const dateText = invite.acceptedDate
    ? formatWhen(invite.acceptedDate, invite.acceptedTime, invite.acceptedTz)
    : invite.offeredDates.map((d) => formatDate(d.date, { short: true })).join(' · ')
  const cancellable = invite.status === 'sent' || invite.status === 'accepted'
  const [resolving, setResolving] = useState(false)
  const needsFollowUp = !!invite.followUp && !invite.followUp.resolvedAt

  const resolveFollowUp = async () => {
    setResolving(true)
    setError(null)
    const res = await callApi<{ invite: InviterInviteView }>(
      `/api/speaker-invites/${encodeURIComponent(invite.inviteId)}/follow-up/resolve`,
      { method: 'POST', body: {} }
    )
    setResolving(false)
    if (res.ok) onChanged(res.data.invite)
    else setError(res.error.error || 'Could not mark this resolved.')
  }

  const cancel = async () => {
    setBusy(true)
    setError(null)
    const res = await callApi<{ invite: InviterInviteView; sheetReminder?: { name: string; date: string } }>(
      `/api/speaker-invites/${encodeURIComponent(invite.inviteId)}/cancel`,
      { method: 'POST', body: {} }
    )
    setBusy(false)
    if (res.ok) {
      setConfirming(false)
      const r = res.data.sheetReminder
      setReminder(r ? `If your schedule sheet lists ${r.name} for ${formatDate(r.date)}, please remove it.` : null)
      onChanged(res.data.invite)
    } else {
      setError(res.error.error || 'Could not cancel this invitation.')
    }
  }

  const resend = async () => {
    setResending(true)
    setError(null)
    setResent(null)
    const res = await callApi<{ invite: InviterInviteView; sent: 'invitation' | 'confirmation' }>(
      `/api/speaker-invites/${encodeURIComponent(invite.inviteId)}/resend`,
      { method: 'POST', body: {} }
    )
    setResending(false)
    if (res.ok) {
      setResent(res.data.sent === 'confirmation' ? 'Confirmation sent again.' : 'Invitation sent again.')
      onChanged(res.data.invite)
      return
    }
    setError(
      res.error.code === 'SEND_FAILED'
        ? 'The email could not be sent. Please try again later.'
        : res.status === 403
          ? NOT_AN_INVITER
          : res.error.error || 'Could not send the email again.'
    )
  }

  return (
    <Card padding="$3" bordered testID={`invite-row-${invite.inviteId}`}>
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Button
          size="$2"
          variant="chromeless"
          icon={open ? ChevronDown : ChevronRight}
          onPress={() => setOpen(!open)}
          aria-label={open ? 'Hide history' : 'Show history'}
        />
        <YStack flex={1} minWidth={200} gap="$1">
          <Text fontWeight="600">{name}</Text>
          <Text fontSize="$2" color="$colorSecondary">
            {`${INVITE_TYPE_LABEL[invite.type]} · ${invite.acceptedDate ? 'Booked' : 'Offered'}: ${dateText}`}
          </Text>
        </YStack>
        <Text fontSize="$2" fontWeight="600" color={invite.status === 'accepted' ? '$green10' : invite.status === 'sent' ? '$blue10' : '$colorSecondary'}>
          {INVITE_STATUS_LABEL[invite.status]}
        </Text>
        {cancellable && !confirming ? (
          <XStack gap="$2">
            <Button size="$2" variant="outlined" disabled={resending} onPress={resend} testID="invite-resend">
              {resending ? 'Sending…' : 'Resend'}
            </Button>
            <Button size="$2" variant="outlined" onPress={() => setConfirming(true)} testID="invite-cancel">
              Cancel
            </Button>
          </XStack>
        ) : null}
      </XStack>

      {needsFollowUp ? (
        <XStack gap="$2" marginTop="$2" alignItems="center" flexWrap="wrap" testID="invite-follow-up">
          <Text
            fontSize="$2"
            fontWeight="600"
            color="$orange11"
            backgroundColor="$orange3"
            paddingHorizontal="$2"
            paddingVertical="$1"
            borderRadius="$2"
          >
            {`Needs follow-up: shares an email with ${invite.followUp?.withName ?? 'another person'}`}
          </Text>
          <Button size="$2" variant="outlined" disabled={resolving} onPress={resolveFollowUp} testID="invite-follow-up-resolve">
            {resolving ? 'Saving…' : 'Mark resolved'}
          </Button>
        </XStack>
      ) : null}

      {confirming ? (
        <YStack gap="$2" marginTop="$3" testID="invite-cancel-confirm">
          <Text>
            {invite.status === 'accepted'
              ? `Cancel this invitation? ${name}'s booking will be released and the date opens up again.`
              : 'Cancel this invitation? The link in the email will stop working.'}
          </Text>
          <XStack gap="$2">
            <Button size="$3" variant="danger" disabled={busy} onPress={cancel}>
              {busy ? 'Cancelling…' : 'Yes, cancel it'}
            </Button>
            <Button size="$3" variant="outlined" onPress={() => setConfirming(false)}>
              Keep it
            </Button>
          </XStack>
        </YStack>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {resent ? (
        <Notice tone="success" testID="invite-resent">
          {resent}
        </Notice>
      ) : null}
      {reminder ? (
        <Notice tone="warning" testID="sheet-reminder">
          {reminder}
        </Notice>
      ) : null}

      {open ? (
        <YStack gap="$1" marginTop="$3">
          <Separator />
          {invite.note ? <Text fontSize="$2" fontStyle="italic">{`Note: ${invite.note}`}</Text> : null}
          {invite.history.map((h, i) => (
            <Text key={`${h.at}-${i}`} fontSize="$2" color="$colorSecondary">
              {`${new Date(h.at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })} · ${
                INVITE_HISTORY_ACTION_LABEL[h.action] ?? h.action
              }${h.from ? ` from ${h.from}` : ''}${h.to ? ` to ${h.to}` : ''}${h.note ? ` · ${h.note}` : ''} (${h.trust})`}
            </Text>
          ))}
        </YStack>
      ) : null}
    </Card>
  )
}
