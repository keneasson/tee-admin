import { useCallback, useEffect, useState } from 'react'
import { YStack, XStack, Text, Card, Paragraph, Button, Separator, PageHeader, LoadingState } from '@my/ui'
import { ChevronDown, ChevronRight, Plus } from '@tamagui/lucide-icons'
import { callApi } from './api'
import { INVITE_STATUS_LABEL, INVITE_TYPE_LABEL, formatDate, formatWhen } from './format'
import { Notice } from './identity-parts'
import type { InviteHistoryEntry, InviterInviteView } from './types'

/**
 * Invites list, `/admin/speaker-invites` (spec §9): invitee, type, offered or
 * accepted date, status, expandable history, and Cancel (confirmed in-page).
 */
export interface SpeakerInvitesListProps {
  onNew: () => void
  /** Arrived straight from a successful send. */
  justSent?: boolean
}

const HISTORY_LABEL: Record<InviteHistoryEntry['action'], string> = {
  created: 'Invitation sent',
  accepted: 'Accepted',
  changed: 'Changed date',
  cancelled: 'Cancelled by the speaker',
  cancelled_by_inviter: 'Cancelled by the sender',
  swap_requested: 'Asked to swap',
  swap_accepted: 'Swap accepted',
  swap_declined: 'Swap declined',
  swap_expired: 'Swap request expired',
  swapped_in: 'Swapped in',
  email_failed: 'An email could not be sent',
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
      setError(res.error.error || 'Could not load invitations.')
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
  const name = invite.invitee?.name || invite.inviteeEmail
  const dateText = invite.acceptedDate
    ? formatWhen(invite.acceptedDate, invite.acceptedTime, invite.acceptedTz)
    : invite.offeredDates.map((d) => formatDate(d.date, { short: true })).join(' · ')
  const cancellable = invite.status === 'sent' || invite.status === 'accepted'

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
          <Button size="$2" variant="outlined" onPress={() => setConfirming(true)} testID="invite-cancel">
            Cancel
          </Button>
        ) : null}
      </XStack>

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
                HISTORY_LABEL[h.action] ?? h.action
              }${h.from ? ` from ${h.from}` : ''}${h.to ? ` to ${h.to}` : ''}${h.note ? ` · ${h.note}` : ''} (${h.trust})`}
            </Text>
          ))}
        </YStack>
      ) : null}
    </Card>
  )
}
