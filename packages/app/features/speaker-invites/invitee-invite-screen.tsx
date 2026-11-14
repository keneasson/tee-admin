import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { YStack, XStack, Text, Heading, Card, Paragraph, Button, TextArea, Anchor, Separator, Spinner } from '@my/ui'
import { CalendarPlus, Download } from '@tamagui/lucide-icons'
import { callApi, withToken } from './api'
import { inviteWording } from '@my/app/provider/dynamodb/invite-program-types'
import { brotherName, formatDate, formatTime, formatWhen, slotLabel } from './format'
import {
  DateChoice,
  InviteIdentityHeader,
  InviteIdentityStates,
  InvitePageColumn,
  InviterContactLine,
  Notice,
  ShortNoticeCallout,
} from './identity-parts'
import { useInviteIdentity, type InviteIdentitySlots } from './use-invite-identity'
import type { InviteActionResponse, InviteApiError, InviteeInviteView, ShortNotice, Slot, SwapView } from './types'

/**
 * The invitee's page, `/invite/{inviteId}?token=…[&date=…]` (spec §6, §9).
 *
 * Before acceptance: the offered dates as large buttons (`?date=` preselects
 * one) and a Confirm button. Nothing changes until Confirm is pressed — the
 * page load is a GET. After acceptance it is the manage view: calendar links,
 * then Change date / Swap with another speaker / Cancel.
 */

export interface StepUpRenderArgs {
  reason: string
  onVerified: () => void
  onCancel: () => void
}

export interface InviteeInviteScreenProps {
  inviteId: string
  token: string | null
  /** `?date=` from the email's date button. Only preselects; never submits. */
  preselectDate: string | null
  slots: InviteIdentitySlots
  /** This page (path + query): where sign-in returns to. */
  selfUrl: string
  /** This page without the token: where "Sign in again" returns to. */
  selfUrlWithoutToken: string
  /** Platform step-up challenge (web: <Verify>), mounted on STEP_UP_REQUIRED. */
  renderStepUp: (args: StepUpRenderArgs) => ReactNode
}

type InviteResponse = { invite: InviteeInviteView }

export function InviteeInviteScreen(props: InviteeInviteScreenProps) {
  const { inviteId, token, slots } = props
  const load = useCallback(
    () => callApi<InviteResponse>(withToken(`/api/invite/${encodeURIComponent(inviteId)}`, token)),
    [inviteId, token]
  )
  const identity = useInviteIdentity<InviteResponse>({ load, token, slots })
  const invite = identity.data?.invite ?? null
  const [shortNotice, setShortNotice] = useState<ShortNotice[] | undefined>(undefined)
  const who = brotherName(invite?.invitee)

  return (
    <InvitePageColumn>
      {identity.phase === 'ready' && invite ? (
        <>
          <InviteIdentityHeader
            title={`Invitation for ${who}`}
            who={who}
            onSignInAgain={() => slots.signInAgain(props.selfUrlWithoutToken)}
            switchedNotice={
              identity.switched
                ? `You were signed in as someone else, so we've switched to ${
                    invite.invitee.firstName || who
                  }'s invitation.`
                : null
            }
          />
          <InviteBody
            invite={invite}
            {...props}
            shortNotice={shortNotice}
            onInvite={(next, notice) => {
              setShortNotice(notice)
              identity.setData({ invite: next })
            }}
            handleRefusal={identity.handleRefusal}
          />
        </>
      ) : (
        <InviteIdentityStates identity={identity} slots={slots} callbackUrl={props.selfUrl} noun="invitation" />
      )}
    </InvitePageColumn>
  )
}

interface BodyProps extends InviteeInviteScreenProps {
  invite: InviteeInviteView
  /** From the last accept / change (within 24h of the appointment). */
  shortNotice?: ShortNotice[]
  onInvite: (invite: InviteeInviteView, shortNotice?: ShortNotice[]) => void
  handleRefusal: (error: InviteApiError) => Promise<boolean>
}

function InviteBody(props: BodyProps) {
  const { invite, shortNotice } = props
  // The program's wording as sent (§3a); an older server's view falls back to the type's wording.
  const phrase = invite.phrase || inviteWording({ type: invite.type }).phrase
  const intro = `An invitation to ${phrase} at ${invite.ecclesia}`

  if (invite.status === 'cancelled' || invite.status === 'expired') {
    return (
      <Card padding="$5" gap="$3" bordered testID="invite-closed">
        <Heading size="$6">
          {invite.status === 'cancelled' ? 'This invitation was cancelled' : 'This invitation has expired'}
        </Heading>
        <Paragraph>{`${intro}${invite.acceptedDate ? ` on ${formatDate(invite.acceptedDate)}` : ''} is no longer open.`}</Paragraph>
        <InviterContactLine inviter={invite.inviter} />
      </Card>
    )
  }

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <Text fontSize="$5">{intro}</Text>
        {invite.about ? (
          <Text fontSize="$3" color="$colorSecondary" testID="invite-about">
            {invite.about}
          </Text>
        ) : null}
        {invite.note ? (
          <Card padding="$3" bordered>
            <Text fontStyle="italic">{invite.note}</Text>
            {invite.inviter ? (
              <Text fontSize="$2" color="$colorSecondary" marginTop="$1">{`— ${invite.inviter.name}`}</Text>
            ) : null}
          </Card>
        ) : null}
      </YStack>
      <ShortNoticeCallout notices={shortNotice} />
      {invite.status === 'accepted' ? <ManageView {...props} /> : <AcceptView {...props} />}
      <InviterContactLine inviter={invite.inviter} />
    </YStack>
  )
}

// ---------------------------------------------------------------------------
// Before acceptance
// ---------------------------------------------------------------------------

function AcceptView({ invite, token, preselectDate, onInvite, handleRefusal }: BodyProps) {
  // After SLOT_TAKEN the API returns the dates still open; those replace the choices.
  const [takenOpenDates, setTakenOpenDates] = useState<Slot[] | null>(null)
  const offered = takenOpenDates ?? invite.offeredDates
  const others = takenOpenDates ? null : invite.otherDates
  const selectable = useMemo(
    () => new Set([...offered, ...(others ?? [])].filter((s) => s.state === 'OPEN').map((s) => s.date)),
    [offered, others]
  )
  const [selected, setSelected] = useState<string | null>(
    preselectDate && selectable.has(preselectDate) ? preselectDate : null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useScrollToHash('other-dates', others !== null)

  const confirm = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    const res = await callApi<InviteActionResponse>(`/api/invite/${encodeURIComponent(invite.inviteId)}`, {
      method: 'POST',
      body: { action: 'accept', date: selected, ...(token ? { token } : {}) },
    })
    setBusy(false)
    if (res.ok) return onInvite(res.data.invite, res.data.shortNotice)
    if (await handleRefusal(res.error)) return
    if (res.error.code === 'SLOT_TAKEN') {
      setTakenOpenDates(res.error.openDates ?? [])
      setSelected(null)
      return
    }
    setError(res.error.error || 'We couldn’t save your answer. Please try again.')
  }

  const selectedSlot = [...offered, ...(others ?? [])].find((s) => s.date === selected)

  return (
    <YStack gap="$4">
      {takenOpenDates ? (
        <Notice tone="warning" testID="slot-taken">
          {takenOpenDates.some((s) => s.state === 'OPEN')
            ? 'That date was just taken. These dates are still open:'
            : 'That date was just taken, and no other dates are open right now.'}
        </Notice>
      ) : null}

      <SlotChoiceList
        heading={takenOpenDates ? 'Still open' : 'Choose a date'}
        slots={offered}
        selected={selected}
        onSelect={setSelected}
        testPrefix="offered"
      />

      {others ? (
        <YStack id="other-dates" nativeID="other-dates" gap="$2" testID="other-dates">
          <Separator />
          <SlotChoiceList
            heading="Other open dates"
            slots={others}
            selected={selected}
            onSelect={setSelected}
            testPrefix="other"
            emptyText="No other dates are open in this period."
          />
        </YStack>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <XStack>
        <Button
          variant="action"
          size="$5"
          disabled={!selected || busy}
          opacity={!selected || busy ? 0.6 : 1}
          onPress={confirm}
          icon={busy ? <Spinner size="small" /> : undefined}
          testID="invite-confirm"
        >
          {selectedSlot ? `Confirm ${formatDate(selectedSlot.date, { short: true })}` : 'Choose a date to confirm'}
        </Button>
      </XStack>
    </YStack>
  )
}

function SlotChoiceList({
  heading,
  slots,
  selected,
  onSelect,
  testPrefix,
  emptyText,
}: {
  heading: string
  slots: Slot[]
  selected: string | null
  onSelect: (date: string) => void
  testPrefix: string
  emptyText?: string
}) {
  return (
    <YStack gap="$2">
      <Heading size="$5">{heading}</Heading>
      {slots.length === 0 ? <Text color="$colorSecondary">{emptyText ?? 'No dates to show.'}</Text> : null}
      {slots.map((s) => {
        const can = s.state === 'OPEN'
        const time = formatTime(s.time)
        return (
          <DateChoice
            key={s.date}
            label={formatDate(s.date)}
            detail={can ? time || undefined : `${slotLabel(s)}${time ? ` · ${time}` : ''}`}
            selected={selected === s.date}
            disabled={!can}
            onPress={() => onSelect(s.date)}
            testID={`${testPrefix}-date-${s.date}`}
          />
        )
      })}
    </YStack>
  )
}

/** Scroll to `#id` once the async content that holds it has rendered (web only). */
function useScrollToHash(id: string, present: boolean) {
  useEffect(() => {
    if (!present || typeof document === 'undefined') return
    if (typeof window === 'undefined' || window.location.hash !== `#${id}`) return
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [id, present])
}

// ---------------------------------------------------------------------------
// After acceptance: the manage view
// ---------------------------------------------------------------------------

type Mode = 'none' | 'change' | 'swap' | 'cancel'

function ManageView({ invite, token, onInvite, handleRefusal, renderStepUp }: BodyProps) {
  const [mode, setMode] = useState<Mode>('none')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const date = invite.acceptedDate!
  const when = formatWhen(date, invite.acceptedTime, invite.acceptedTz)
  const where = [invite.place?.hallName, invite.place?.address].filter(Boolean).join(', ')
  const online = invite.place?.onlineMeetings ?? []

  const post = (body: Record<string, unknown>) =>
    callApi<{ invite?: InviteeInviteView; swap?: SwapView; shortNotice?: ShortNotice[] }>(`/api/invite/${encodeURIComponent(invite.inviteId)}`, {
      method: 'POST',
      body: { ...body, ...(token ? { token } : {}) },
    })

  const done = (next: InviteeInviteView, text: string, shortNotice?: ShortNotice[]) => {
    setMode('none')
    setNotice({ tone: 'success', text })
    onInvite(next, shortNotice)
  }

  return (
    <YStack gap="$4">
      <Card padding="$4" gap="$2" bordered testID="booking">
        <Text fontSize="$2" color="$colorSecondary" textTransform="uppercase">
          You’re booked
        </Text>
        <Heading size="$6">{when}</Heading>
        <Text testID="booking-place">{where ? `${invite.ecclesia} · ${where}` : invite.ecclesia}</Text>
        {online.map((m) => (
          <Text key={m.label} fontSize="$3" color="$colorSecondary">
            {`${m.label}${m.url ? `: ${m.url}` : ''}${m.meetingId ? ` · Meeting ID ${m.meetingId}` : ''}${
              m.password ? ` · Passcode ${m.password}` : ''
            }${m.dialInNumber ? ` · Dial in ${m.dialInNumber}` : ''}`}
          </Text>
        ))}
        <XStack gap="$3" flexWrap="wrap" marginTop="$2">
          {invite.googleCalendarUrl ? (
            <Anchor href={invite.googleCalendarUrl} target="_blank" rel="noopener noreferrer" testID="google-calendar-link">
              <XStack gap="$1" alignItems="center">
                <CalendarPlus size={16} color="$primary" />
                <Text color="$primary">Add to Google Calendar</Text>
              </XStack>
            </Anchor>
          ) : null}
          {invite.icsUrl ? (
            <Anchor href={invite.icsUrl} testID="ics-link">
              <XStack gap="$1" alignItems="center">
                <Download size={16} color="$primary" />
                <Text color="$primary">Download .ics (Apple / Outlook)</Text>
              </XStack>
            </Anchor>
          ) : null}
        </XStack>
      </Card>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <YStack gap="$2">
        <Heading size="$5">Need to change your appointment?</Heading>
        <XStack gap="$2" flexWrap="wrap">
          <Button variant={mode === 'change' ? 'action' : 'outlined'} onPress={() => setMode(mode === 'change' ? 'none' : 'change')} testID="mode-change">
            Change date
          </Button>
          {invite.swapAvailable ? (
            <Button variant={mode === 'swap' ? 'action' : 'outlined'} onPress={() => setMode(mode === 'swap' ? 'none' : 'swap')} testID="mode-swap">
              Swap with another speaker
            </Button>
          ) : null}
          <Button variant={mode === 'cancel' ? 'danger' : 'outlined'} onPress={() => setMode(mode === 'cancel' ? 'none' : 'cancel')} testID="mode-cancel">
            Cancel
          </Button>
        </XStack>
      </YStack>

      {mode === 'change' ? (
        <ChangeDatePanel invite={invite} post={post} handleRefusal={handleRefusal} onDone={done} />
      ) : null}
      {mode === 'swap' ? (
        <SwapPanel
          invite={invite}
          post={post}
          handleRefusal={handleRefusal}
          renderStepUp={renderStepUp}
          onRequested={(text) => {
            setMode('none')
            setNotice({ tone: 'success', text })
          }}
        />
      ) : null}
      {mode === 'cancel' ? (
        <CancelPanel
          post={post}
          handleRefusal={handleRefusal}
          onKeep={() => setMode('none')}
          onDone={(next) => done(next, 'Your booking is cancelled. The sender has been told.')}
        />
      ) : null}
    </YStack>
  )
}

type Post = (
  body: Record<string, unknown>
) => ReturnType<typeof callApi<{ invite?: InviteeInviteView; swap?: SwapView; shortNotice?: ShortNotice[] }>>

function ChangeDatePanel({
  invite,
  post,
  handleRefusal,
  onDone,
}: {
  invite: InviteeInviteView
  post: Post
  handleRefusal: (e: InviteApiError) => Promise<boolean>
  onDone: (next: InviteeInviteView, text: string, shortNotice?: ShortNotice[]) => void
}) {
  const [taken, setTaken] = useState<Slot[] | null>(null)
  const pool = (taken ?? [...invite.offeredDates, ...(invite.otherDates ?? [])]).filter(
    (s) => s.date !== invite.acceptedDate
  )
  const choices = dedupe(pool)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    const res = await post({ action: 'change', date: selected })
    setBusy(false)
    if (res.ok && res.data.invite) {
      return onDone(res.data.invite, `Done. You’re now booked for ${formatDate(selected)}.`, res.data.shortNotice)
    }
    if (!res.ok && (await handleRefusal(res.error))) return
    if (!res.ok && res.error.code === 'SLOT_TAKEN') {
      setTaken(res.error.openDates ?? [])
      setSelected(null)
      setError('That date was just taken. Pick another open date.')
      return
    }
    setError((!res.ok && res.error.error) || 'We couldn’t change the date. Please try again.')
  }

  return (
    <Card padding="$4" gap="$3" bordered testID="change-panel">
      {choices.some((s) => s.state === 'OPEN') ? (
        <SlotChoiceList heading="Pick a new date" slots={choices} selected={selected} onSelect={setSelected} testPrefix="change" />
      ) : (
        <Paragraph>
          No other open dates are available to choose here. Contact {invite.inviter?.name ?? 'the sender'} to arrange
          another date.
        </Paragraph>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <XStack>
        <Button variant="action" disabled={!selected || busy} opacity={!selected || busy ? 0.6 : 1} onPress={submit} testID="change-confirm">
          {selected ? `Move to ${formatDate(selected, { short: true })}` : 'Choose a date'}
        </Button>
      </XStack>
    </Card>
  )
}

function SwapPanel({
  invite,
  post,
  handleRefusal,
  renderStepUp,
  onRequested,
}: {
  invite: InviteeInviteView
  post: Post
  handleRefusal: (e: InviteApiError) => Promise<boolean>
  renderStepUp: (args: StepUpRenderArgs) => ReactNode
  onRequested: (text: string) => void
}) {
  const choices = dedupe([...invite.offeredDates, ...(invite.otherDates ?? [])]).filter(
    (s) => s.date !== invite.acceptedDate && s.state === 'FILLED'
  )
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unreachable, setUnreachable] = useState<Set<string>>(new Set())
  const [stepUp, setStepUp] = useState(false)
  const inviterName = invite.inviter?.name ?? 'the sender'

  const submit = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    const res = await post({ action: 'swap-request', date: selected, ...(note.trim() ? { note: note.trim() } : {}) })
    setBusy(false)
    if (res.ok && res.data.swap) {
      const target = res.data.swap.target
      return onRequested(
        `We’ve asked ${target.name ?? 'the other speaker'} to trade ${formatDate(target.date)} for your ${formatDate(
          res.data.swap.requester.date
        )}. You’ll get an email when they answer.`
      )
    }
    if (res.ok) return
    if (res.error.code === 'STEP_UP_REQUIRED' || res.error.stepUpRequired) {
      setStepUp(true)
      return
    }
    if (await handleRefusal(res.error)) return
    if (res.error.code === 'TARGET_UNREACHABLE') {
      setUnreachable((prev) => new Set(prev).add(selected))
      setSelected(null)
      return
    }
    setError(res.error.error || 'We couldn’t send the swap request. Please try again.')
  }

  if (stepUp) {
    return (
      <Card padding="$4" gap="$3" bordered testID="swap-step-up">
        <Paragraph>
          A swap moves another speaker’s booking too, so please confirm it’s you first.
        </Paragraph>
        {renderStepUp({
          reason: 'to request a swap with another speaker',
          onVerified: () => {
            setStepUp(false)
            void submit()
          },
          onCancel: () => setStepUp(false),
        })}
      </Card>
    )
  }

  return (
    <Card padding="$4" gap="$3" bordered testID="swap-panel">
      {choices.length === 0 ? (
        <Paragraph>
          There are no other speakers’ dates to trade with here. Contact {inviterName} to arrange a swap.
        </Paragraph>
      ) : (
        <YStack gap="$2">
          <Heading size="$5">Trade dates with</Heading>
          {choices.map((s) =>
            s.reachable === false || unreachable.has(s.date) ? (
              <DateChoice
                key={s.date}
                label={formatDate(s.date)}
                detail={`Filled. Contact ${inviterName} to arrange`}
                selected={false}
                disabled
                testID={`swap-date-${s.date}`}
              />
            ) : (
              <DateChoice
                key={s.date}
                label={formatDate(s.date)}
                detail={s.speakerName ? `${s.speakerName}${s.time ? ` · ${formatTime(s.time)}` : ''}` : 'Filled'}
                selected={selected === s.date}
                onPress={() => setSelected(s.date)}
                testID={`swap-date-${s.date}`}
              />
            )
          )}
          <TextArea
            value={note}
            onChangeText={setNote}
            placeholder="Optional note to the other speaker"
            numberOfLines={3}
          />
        </YStack>
      )}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {choices.length > 0 ? (
        <XStack>
          <Button variant="action" disabled={!selected || busy} opacity={!selected || busy ? 0.6 : 1} onPress={submit} testID="swap-send">
            Send swap request
          </Button>
        </XStack>
      ) : null}
    </Card>
  )
}

function CancelPanel({
  post,
  handleRefusal,
  onKeep,
  onDone,
}: {
  post: Post
  handleRefusal: (e: InviteApiError) => Promise<boolean>
  onKeep: () => void
  onDone: (next: InviteeInviteView) => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    const res = await post({ action: 'cancel', ...(reason.trim() ? { note: reason.trim() } : {}) })
    setBusy(false)
    if (res.ok && res.data.invite) return onDone(res.data.invite)
    if (!res.ok && (await handleRefusal(res.error))) return
    setError((!res.ok && res.error.error) || 'We couldn’t cancel. Please try again.')
  }

  return (
    <Card padding="$4" gap="$3" bordered testID="cancel-panel">
      <Paragraph fontWeight="600">Cancel your booking?</Paragraph>
      <Paragraph color="$colorSecondary">The date will open up for someone else, and the sender will be told.</Paragraph>
      <TextArea value={reason} onChangeText={setReason} placeholder="Optional reason" numberOfLines={2} />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <XStack gap="$2" flexWrap="wrap">
        <Button variant="danger" disabled={busy} onPress={submit} testID="cancel-confirm">
          Yes, cancel my booking
        </Button>
        <Button variant="outlined" onPress={onKeep}>
          Keep it
        </Button>
      </XStack>
    </Card>
  )
}

function dedupe(slots: Slot[]): Slot[] {
  const seen = new Set<string>()
  return slots
    .filter((s) => (seen.has(s.date) ? false : (seen.add(s.date), true)))
    .sort((a, b) => a.date.localeCompare(b.date))
}
