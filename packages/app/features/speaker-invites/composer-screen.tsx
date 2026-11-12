import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  RoleMemberPicker,
} from '@my/ui'
import type { RosterCandidate } from '@my/ui'
import { Check, Plus, Trash2 } from '@tamagui/lucide-icons'
import { callApi } from './api'
import { INVITE_TYPE_LABEL } from '@my/app/provider/dynamodb/speaker-invite-types'
import { NOT_AN_INVITER, addDaysISO, formatDate, formatTime, isISODate, slotLabel, todayISO } from './format'
import { Notice } from './identity-parts'
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
const TYPES: SpeakerInviteType[] = ['memorial', 'bible_class', 'lecture']

type InviteeMode = 'directory' | 'other'
type LectureRow = { date: string; time: string }

export function SpeakerInviteComposer({ ownEcclesia, isOwner, onSent }: SpeakerInviteComposerProps) {
  const [ecclesia, setEcclesia] = useState(ownEcclesia ?? '')
  const [type, setType] = useState<SpeakerInviteType>('memorial')

  const [inviteeMode, setInviteeMode] = useState<InviteeMode>('directory')
  const [pickerText, setPickerText] = useState('')
  const [picked, setPicked] = useState<RosterCandidate | null>(null)
  const [other, setOther] = useState({ firstName: '', lastName: '', email: '', ecclesia: '' })

  const [from, setFrom] = useState(todayISO())
  const [to, setTo] = useState(addDaysISO(todayISO(), 90))
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
    if (inviteeMode === 'directory') return picked ? { personId: picked.personId } : null
    const { firstName, lastName, email } = other
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return null
    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      ...(other.ecclesia.trim() ? { ecclesia: other.ecclesia.trim() } : {}),
    }
  }, [inviteeMode, picked, other])

  const dates: Array<{ date: string; time?: string }> = isLecture
    ? lectureRows.filter((r) => r.date || r.time).map((r) => ({ date: r.date.trim(), time: r.time.trim() }))
    : selected.map((date) => ({ date }))

  const problems: string[] = []
  if (!ecclesia) problems.push('Choose an ecclesia.')
  if (!invitee) problems.push(inviteeMode === 'directory' ? 'Pick who to invite.' : 'Enter their first name, last name and email.')
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
          <EcclesiaSelector value={ecclesia} onChange={setEcclesia} />
        ) : (
          <Text testID="composer-ecclesia">{ecclesia || 'Your account has no ecclesia on file.'}</Text>
        )}
      </Section>

      <Section title="Invitation for">
        <XStack gap="$2" flexWrap="wrap">
          {TYPES.map((t) => (
            <Button key={t} variant={type === t ? 'action' : 'outlined'} onPress={() => setType(t)} testID={`type-${t}`}>
              {INVITE_TYPE_LABEL[t]}
            </Button>
          ))}
        </XStack>
      </Section>

      <Section title="Who">
        <XStack gap="$2" flexWrap="wrap">
          <Button variant={inviteeMode === 'directory' ? 'action' : 'outlined'} size="$3" onPress={() => setInviteeMode('directory')}>
            From the directory
          </Button>
          <Button variant={inviteeMode === 'other' ? 'action' : 'outlined'} size="$3" onPress={() => setInviteeMode('other')}>
            Someone not in the directory
          </Button>
        </XStack>
        {inviteeMode === 'directory' ? (
          <YStack gap="$1">
            <RoleMemberPicker
              value={pickerText}
              ecclesia={ecclesia}
              selectedPersonId={picked?.personId}
              placeholder="Start typing a name"
              onChangeText={(text) => {
                setPickerText(text)
                setPicked(null)
              }}
              onSelectMember={(m) => {
                setPicked(m)
                setPickerText(m.displayName)
              }}
              onClearMember={() => setPicked(null)}
            />
            {pickerText && !picked ? (
              <Text fontSize="$2" color="$colorSecondary">
                Pick a name from the list. If they aren’t listed, choose “Someone not in the directory”.
              </Text>
            ) : null}
          </YStack>
        ) : (
          <YStack gap="$2">
            <XStack gap="$2" flexWrap="wrap">
              <Input flex={1} minWidth={180} placeholder="First name" value={other.firstName} onChangeText={(v) => setOther({ ...other, firstName: v })} />
              <Input flex={1} minWidth={180} placeholder="Last name" value={other.lastName} onChangeText={(v) => setOther({ ...other, lastName: v })} />
            </XStack>
            <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={other.email} onChangeText={(v) => setOther({ ...other, email: v })} />
            <Input placeholder="Home ecclesia" value={other.ecclesia} onChangeText={(v) => setOther({ ...other, ecclesia: v })} />
          </YStack>
        )}
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
  return (
    <YStack gap="$1" testID="slot-list">
      {slots.map((s) => {
        const isSelected = selected.includes(s.date)
        const open = s.state === 'OPEN'
        const error = notOpen[s.date]
        const disabled = !open || (full && !isSelected)
        return (
          <YStack key={s.date} gap="$1">
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
              <Text flex={1} fontWeight={isSelected ? '600' : '400'}>
                {formatDate(s.date, { short: true })}
                {s.time ? ` · ${formatTime(s.time)}` : ''}
              </Text>
              <Text fontSize="$2" color={open ? '$green10' : '$colorSecondary'}>
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
      })}
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

/** Owner only: pick any ecclesia (the API re-checks). */
function EcclesiaSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [names, setNames] = useState<string[]>([])
  const [query, setQuery] = useState(value)
  useEffect(() => {
    let cancelled = false
    callApi<{ data?: Array<{ name?: string }> }>('/api/ecclesia').then((res) => {
      if (cancelled || !res.ok) return
      setNames((res.data.data ?? []).map((e) => e.name ?? '').filter(Boolean).sort())
    })
    return () => {
      cancelled = true
    }
  }, [])
  const q = query.trim().toLowerCase()
  const matches = q && q !== value.toLowerCase() ? names.filter((n) => n.toLowerCase().includes(q)).slice(0, 8) : []
  return (
    <YStack gap="$2">
      <Input value={query} onChangeText={setQuery} placeholder="Ecclesia name" testID="composer-ecclesia-select" />
      {matches.length > 0 ? (
        <XStack gap="$2" flexWrap="wrap">
          {matches.map((n) => (
            <Button
              key={n}
              size="$2"
              variant="outlined"
              onPress={() => {
                onChange(n)
                setQuery(n)
              }}
            >
              {n}
            </Button>
          ))}
        </XStack>
      ) : null}
      <Text fontSize="$2" color="$colorSecondary">{value ? `Inviting for ${value}.` : 'No ecclesia chosen.'}</Text>
    </YStack>
  )
}
