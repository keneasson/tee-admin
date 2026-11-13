import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  YStack,
  XStack,
  Text,
  Heading,
  Card,
  Paragraph,
  Button,
  Input,
  TextArea,
  Checkbox,
  Separator,
  Spinner,
  PageHeader,
} from '@my/ui'
import { Check, Plus, Trash2 } from '@tamagui/lucide-icons'
import { callApi } from './api'
import { INVITE_TYPE_LABEL } from '@my/app/provider/dynamodb/speaker-invite-types'
import { NOT_AN_INVITER, addDaysISO, formatDate, isISODate, slotLabel, slotWhen, todayISO, usualMeeting, type UsualMeeting } from './format'
import { Notice } from './identity-parts'
import { EcclesiaAutocomplete } from './ecclesia-autocomplete'
import { InviteePicker, type InviteeChoice } from './invitee-picker'
import type { Slot, InviterInviteView, SpeakerInviteType } from './types'

/**
 * Composer, `/admin/speaker-invites/new` (spec §9). The ecclesia is the
 * inviter's own (shown as text); only the owner gets a selector. The API
 * re-checks all of it (`canSendSpeakerInvite`).
 */
export interface SpeakerInviteComposerProps {
  /** The signed-in inviter's own ecclesia. */
  ownEcclesia: string | null
  isOwner: boolean
  /** Go to the invites list after a real send. */
  onSent: () => void
}

const MAX_DATES = 3
/**
 * Programs are planned 6–12 months ahead, so the list covers a year: it looks a
 * year out for the first open date, then shows a full year from one meeting
 * before it. Filled weeks stay visible so visiting speakers can be interleaved
 * with the ecclesia's own members.
 */
const SEARCH_AHEAD_DAYS = 365
const VISIBLE_RANGE_DAYS = 365
const TYPES: SpeakerInviteType[] = ['memorial', 'bible_class', 'lecture']

type LectureRow = { date: string; time: string }

export function SpeakerInviteComposer({ ownEcclesia, isOwner, onSent }: SpeakerInviteComposerProps) {
  const [ecclesia, setEcclesia] = useState(ownEcclesia ?? '')
  const [type, setType] = useState<SpeakerInviteType>('memorial')

  // §9a: one "Start typing a name" field (InviteePicker) decides the invitee.
  const [choice, setChoice] = useState<InviteeChoice | null>(null)
  const [choiceProblem, setChoiceProblem] = useState<string | null>(null)
  const onInviteeChange = useCallback((next: InviteeChoice | null, problem?: string) => {
    setChoice(next)
    setChoiceProblem(next ? null : problem ?? null)
  }, [])

  // The first load looks a year ahead, then the list starts one meeting before
  // the first open date (see loadSlots), so nobody pages past filled weeks.
  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(addDaysISO(todayISO(), SEARCH_AHEAD_DAYS))
  const autoRangedFor = useRef<SpeakerInviteType | null>(null)
  const [slots, setSlots] = useState<Slot[] | null>(null)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [lectureRows, setLectureRows] = useState<LectureRow[]>([{ date: '', time: '' }])

  const [offerOthers, setOfferOthers] = useState(false)
  const [windowFrom, setWindowFrom] = useState(todayISO())
  const [windowTo, setWindowTo] = useState(addDaysISO(todayISO(), 90))
  const [note, setNote] = useState('')

  const [notOpen, setNotOpen] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<'test' | 'live' | null>(null)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const [forbidden, setForbidden] = useState(false)
  const isLecture = type === 'lecture'

  const loadSlots = useCallback(async () => {
    if (isLecture || !ecclesia || !isISODate(from) || !isISODate(to) || from > to) return
    setLoadingSlots(true)
    setSlotsError(null)
    const params = new URLSearchParams({ type, from, to, ...(isOwner ? { ecclesia } : {}) })
    const res = await callApi<{ slots: Slot[] }>(`/api/speaker-invites/slots?${params.toString()}`)
    setLoadingSlots(false)
    if (res.ok) {
      if (autoRangedFor.current !== type) {
        autoRangedFor.current = type
        const firstOpen = res.data.slots.findIndex((s) => s.state === 'OPEN')
        if (firstOpen >= 0) {
          const start = res.data.slots[Math.max(firstOpen - 1, 0)].date
          const end = addDaysISO(start, VISIBLE_RANGE_DAYS)
          if (start !== from || end !== to) {
            // Narrowing the range refetches; this result is superseded.
            setFrom(start)
            setTo(end)
            return
          }
        }
      }
      setSlots(res.data.slots)
      // Keep only selections that are still open.
      const open = new Set(res.data.slots.filter((s) => s.state === 'OPEN').map((s) => s.date))
      setSelected((prev) => prev.filter((d) => open.has(d)))
    } else {
      setSlots(null)
      if (res.status === 403) setForbidden(true)
      setSlotsError(res.error.error || 'Could not load the schedule for these dates.')
    }
  }, [isLecture, ecclesia, from, to, type, isOwner])

  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  useEffect(() => {
    setSelected([])
    setNotOpen({})
  }, [type, ecclesia])

  const toggleDate = (date: string) => {
    setNotOpen((prev) => {
      const { [date]: _gone, ...rest } = prev
      return rest
    })
    setSelected((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : prev.length >= MAX_DATES ? prev : [...prev, date].sort()
    )
  }

  const invitee = useMemo(() => {
    if (!choice) return null
    if (choice.kind === 'person') return { personId: choice.personId }
    const { kind: _kind, ...fields } = choice
    return fields
  }, [choice])

  const dates: Array<{ date: string; time?: string }> = isLecture
    ? lectureRows.filter((r) => r.date || r.time).map((r) => ({ date: r.date.trim(), time: r.time.trim() }))
    : selected.map((date) => ({ date }))

  const problems: string[] = []
  if (!ecclesia) problems.push('Choose an ecclesia.')
  if (!invitee) problems.push(choiceProblem ?? 'Pick who to invite.')
  if (dates.length === 0) problems.push('Offer at least one date.')
  if (isLecture && dates.some((d) => !isISODate(d.date) || !/^\d{2}:\d{2}$/.test(d.time ?? ''))) {
    problems.push('Each lecture date needs a date (YYYY-MM-DD) and a time (HH:mm).')
  }
  if (!isLecture && offerOthers && (!isISODate(windowFrom) || !isISODate(windowTo) || windowFrom > windowTo)) {
    problems.push('The other-dates window needs a valid start and end.')
  }

  const send = async (mode: 'test' | 'live') => {
    if (problems.length > 0 || !invitee) return
    setSending(mode)
    setResult(null)
    setNotOpen({})
    const res = await callApi<{ invite?: InviterInviteView; test?: boolean; sentTo?: string }>('/api/speaker-invites', {
      method: 'POST',
      body: {
        ...(isOwner ? { ecclesia } : {}),
        type,
        invitee,
        dates,
        ...(!isLecture && offerOthers ? { otherDatesWindow: { from: windowFrom, to: windowTo } } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        send: mode === 'test' ? 'test' : true,
      },
    })
    setSending(null)
    if (res.ok) {
      if (mode === 'test') {
        setResult({
          tone: 'success',
          text: res.data.sentTo ? `Test sent to ${res.data.sentTo}. Nobody else was emailed.` : 'Test sent to your own inbox. Nobody else was emailed.',
        })
        return
      }
      onSent()
      return
    }
    if (res.error.code === 'DATES_NOT_OPEN' && res.error.dates) {
      setNotOpen(Object.fromEntries(res.error.dates.map((d) => [d.date, d.state])))
      setResult({ tone: 'error', text: 'Some dates are no longer open. They are marked below; untick them or pick others.' })
      void loadSlots()
      return
    }
    if (res.status === 403) {
      setForbidden(true)
      return
    }
    setResult({
      tone: 'error',
      text: res.error.code === 'SEND_FAILED' ? 'The test email could not be sent.' : res.error.error || 'The invitation could not be sent.',
    })
  }

  if (forbidden) {
    return (
      <YStack gap="$4" maxWidth={760} width="100%">
        <PageHeader title="New speaker invitation" />
        <Notice tone="info" testID="not-an-inviter">
          {NOT_AN_INVITER}
        </Notice>
      </YStack>
    )
  }

  return (
    <YStack gap="$4" maxWidth={760} width="100%">
      <PageHeader title="New speaker invitation" />

      <Section title="Ecclesia">
        {isOwner ? (
          <YStack gap="$1">
            <EcclesiaAutocomplete value={ecclesia} onChange={setEcclesia} allowUnlisted={false} testID="composer-ecclesia-select" />
            <Text fontSize="$2" color="$colorSecondary">
              {ecclesia ? `Inviting for ${ecclesia}.` : 'No ecclesia chosen.'}
            </Text>
          </YStack>
        ) : (
          <Text testID="composer-ecclesia">{ecclesia || 'Your account has no ecclesia on file.'}</Text>
        )}
      </Section>

      <Section title="Invitation for">
        <XStack gap="$2" flexWrap="wrap">
          {TYPES.map((t) => (
            <Button
              key={t}
              variant={type === t ? 'action' : 'outlined'}
              onPress={() => {
                if (t === type) return
                setType(t)
                // A new type has its own schedule: search a year ahead again.
                setFrom(todayISO())
                setTo(addDaysISO(todayISO(), SEARCH_AHEAD_DAYS))
                setSlots(null)
              }}
              testID={`type-${t}`}
            >
              {INVITE_TYPE_LABEL[t]}
            </Button>
          ))}
        </XStack>
      </Section>

      <Section title="Who">
        <InviteePicker onChange={onInviteeChange} />
      </Section>

      <Section title={`Dates to offer (up to ${MAX_DATES})`}>
        {isLecture ? (
          <LectureRows rows={lectureRows} onChange={setLectureRows} notOpen={notOpen} />
        ) : (
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              <Text>From</Text>
              <Input width={140} value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" testID="range-from" />
              <Text>to</Text>
              <Input width={140} value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" testID="range-to" />
              {loadingSlots ? <Spinner size="small" width={20} height={20} /> : null}
            </XStack>
            {slotsError ? <Notice tone="error">{slotsError}</Notice> : null}
            {slots ? (
              <SlotPicker slots={slots} selected={selected} notOpen={notOpen} onToggle={toggleDate} />
            ) : null}
          </YStack>
        )}
      </Section>

      {isLecture ? null : (
        <Section title="Other open dates">
          <XStack gap="$3" alignItems="center">
            <Checkbox checked={offerOthers} onCheckedChange={(c) => setOfferOthers(!!c)} aria-label="Let them pick other open dates" size="$4">
              <Checkbox.Indicator>
                <Check />
              </Checkbox.Indicator>
            </Checkbox>
            <Text flex={1}>Let them pick other open dates</Text>
          </XStack>
          {offerOthers ? (
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              <Text>Between</Text>
              <Input width={140} value={windowFrom} onChangeText={setWindowFrom} placeholder="YYYY-MM-DD" />
              <Text>and</Text>
              <Input width={140} value={windowTo} onChangeText={setWindowTo} placeholder="YYYY-MM-DD" />
            </XStack>
          ) : null}
        </Section>
      )}

      <Section title="Note (optional)">
        <TextArea value={note} onChangeText={setNote} placeholder="A personal note, shown in the email" numberOfLines={4} />
      </Section>

      {result ? <Notice tone={result.tone}>{result.text}</Notice> : null}
      {problems.length > 0 ? (
        <Text fontSize="$2" color="$colorSecondary">
          {problems.join(' ')}
        </Text>
      ) : null}

      <XStack gap="$2" flexWrap="wrap">
        <Button variant="outlined" disabled={problems.length > 0 || sending !== null} onPress={() => send('test')} testID="send-test">
          {sending === 'test' ? 'Sending test…' : 'Send test to me'}
        </Button>
        <Button
          variant="action"
          disabled={problems.length > 0 || sending !== null}
          opacity={problems.length > 0 ? 0.6 : 1}
          onPress={() => send('live')}
          testID="send-live"
        >
          {sending === 'live' ? 'Sending…' : 'Send invitation'}
        </Button>
      </XStack>
    </YStack>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card padding="$4" gap="$3" bordered>
      <Heading size="$5">{title}</Heading>
      {children}
    </Card>
  )
}

function SlotPicker({
  slots,
  selected,
  notOpen,
  onToggle,
}: {
  slots: Slot[]
  selected: string[]
  notOpen: Record<string, string>
  onToggle: (date: string) => void
}) {
  if (slots.length === 0) {
    return <Paragraph color="$colorSecondary">No meeting days in this range.</Paragraph>
  }
  const full = selected.length >= MAX_DATES
  const usual = usualMeeting(slots)
  return (
    <YStack gap="$2">
      {usual.label ? (
        <Text fontSize="$3" color="$colorSecondary" testID="slot-usual">
          {usual.label}
        </Text>
      ) : null}
      <Text fontSize="$2" color="$colorSecondary">
        Tip: offer one date soon, one a couple of months out, and one further out.
      </Text>
      {/*
        Two columns read top-to-bottom: the left is the first half of the range,
        the right the second half, so consecutive weeks are never side by side.
        On narrow screens the columns stack, which keeps date order.
      */}
      <XStack flexDirection="column" $gtXs={{ flexDirection: 'row' }} gap="$2" testID="slot-list">
        {splitInHalf(slots).map((column, c) => (
          <YStack key={c} flex={1} gap="$2" testID={`slot-column-${c}`}>
            {column.map((s) => (
              <SlotRow
                key={s.date}
                slot={s}
                usual={usual}
                isSelected={selected.includes(s.date)}
                full={full}
                error={notOpen[s.date]}
                onToggle={onToggle}
              />
            ))}
          </YStack>
        ))}
      </XStack>
    </YStack>
  )
}

/** First half (rounded up) and second half, each still in date order. */
function splitInHalf<T>(items: T[]): [T[], T[]] {
  const mid = Math.ceil(items.length / 2)
  return [items.slice(0, mid), items.slice(mid)]
}

function SlotRow({
  slot: s,
  usual,
  isSelected,
  full,
  error,
  onToggle,
}: {
  slot: Slot
  usual: UsualMeeting
  isSelected: boolean
  full: boolean
  error: string | undefined
  onToggle: (date: string) => void
}) {
  const open = s.state === 'OPEN'
  const disabled = !open || (full && !isSelected)
  return (
    <YStack gap="$1">
      <XStack
        padding="$2"
        borderRadius="$3"
        borderWidth={1}
        borderColor={isSelected ? '$primary' : error ? '$red8' : '$borderColor'}
        backgroundColor={isSelected ? '$blue2' : 'transparent'}
        opacity={open ? 1 : 0.55}
        alignItems="center"
        gap="$3"
        cursor={disabled ? 'default' : 'pointer'}
        hoverStyle={disabled ? undefined : { borderColor: '$primary' }}
        onPress={disabled ? undefined : () => onToggle(s.date)}
        testID={`slot-${s.date}`}
        aria-disabled={disabled}
      >
        <Checkbox checked={isSelected} disabled={disabled} pointerEvents="none" size="$3" aria-label={formatDate(s.date)}>
          <Checkbox.Indicator>
            <Check />
          </Checkbox.Indicator>
        </Checkbox>
        <Text flexShrink={0} fontWeight={isSelected ? '600' : '400'}>
          {slotWhen(s, usual)}
        </Text>
        <Text flex={1} textAlign="right" numberOfLines={1} fontSize="$2" color={open ? '$green10' : '$colorSecondary'}>
          {slotLabel(s)}
        </Text>
      </XStack>
      {error ? (
        <Text fontSize="$2" color="$red10" paddingLeft="$2" testID={`slot-error-${s.date}`}>
          {`No longer open (${error.toLowerCase().replace('_', ' ')}).`}
        </Text>
      ) : null}
    </YStack>
  )
}

function LectureRows({
  rows,
  onChange,
  notOpen,
}: {
  rows: LectureRow[]
  onChange: (rows: LectureRow[]) => void
  notOpen: Record<string, string>
}) {
  const set = (i: number, patch: Partial<LectureRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <YStack gap="$2">
      <Text fontSize="$2" color="$colorSecondary">
        Lectures aren’t on a schedule yet, so type each date and start time.
      </Text>
      {rows.map((r, i) => (
        <YStack key={i} gap="$1">
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Input width={150} placeholder="YYYY-MM-DD" value={r.date} onChangeText={(v) => set(i, { date: v })} testID={`lecture-date-${i}`} />
            <Input width={100} placeholder="HH:mm" value={r.time} onChangeText={(v) => set(i, { time: v })} testID={`lecture-time-${i}`} />
            {rows.length > 1 ? (
              <Button size="$3" variant="outlined" icon={Trash2} onPress={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove date" />
            ) : null}
          </XStack>
          {notOpen[r.date] ? (
            <Text fontSize="$2" color="$red10">
              This date can’t be offered.
            </Text>
          ) : null}
        </YStack>
      ))}
      {rows.length < MAX_DATES ? (
        <XStack>
          <Button size="$3" variant="outlined" icon={Plus} onPress={() => onChange([...rows, { date: '', time: '' }])}>
            Add a date
          </Button>
        </XStack>
      ) : null}
    </YStack>
  )
}
