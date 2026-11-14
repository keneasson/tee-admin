import { useEffect, useRef, useState, type ReactNode } from 'react'
import { YStack, XStack, Text, Button, Input, Spinner } from '@my/ui'
import { Choice } from './choice'
import { Plus, User } from '@tamagui/lucide-icons'
import { callApi } from './api'
import { EcclesiaAutocomplete } from './ecclesia-autocomplete'
import { groupInviteCandidates, splitTypedName, type InviteCandidate } from './invitee-search'
import { Notice } from './identity-parts'
import type { InviteWho } from '../../provider/dynamodb/invite-program-types'

/**
 * "Start typing a name" (docs/SPEAKER_INVITATIONS.md §9a / §9b / §3a). One
 * field, directory search filtered by the program's WHO and WHERE, grouped:
 *   Brethren · Not yet confirmed as a baptized brother (with "Confirm") ·
 *   Outside {region} (widened matches for a specific name) ·
 *   "＋ {typed} isn't listed, add them".
 * Sisters / anyone programs list "Sisters" / "People" instead of the brethren groups.
 * A pick shows the person with "Change". "Add them" opens the form: email
 * (looked up), first + last name, home ecclesia, Brother / Sister, Baptized?
 * Built for the composer: the roster picker's "Unlink" semantics don't apply.
 */

export type InviteeChoice =
  | { kind: 'person'; personId: string; displayName: string; ecclesia?: string }
  | {
      kind: 'new'
      firstName: string
      lastName: string
      email: string
      ecclesia?: string
      gender: 'male' | 'female'
      baptized?: boolean
      baptismDate?: string
      sharedEmailConfirmedNotSamePerson?: boolean
    }

export interface InviteePickerProps {
  /** `null` with a `problem` when the choice can't be sent yet (or at all). */
  onChange: (choice: InviteeChoice | null, problem?: string) => void
  /** The invitation program; its filter decides who the search offers (§3a). */
  programId?: string
  /** The program's WHO (default brethren, §9b). */
  who?: InviteWho
  /** The inviting ecclesia (the owner may invite for another; its region is "our region"). */
  ecclesia?: string
}

interface SearchResults {
  candidates: InviteCandidate[]
  outside: InviteCandidate[]
  outsideLabel?: string
}

const DEBOUNCE_MS = 250
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailMatch = { personId: string; displayName: string; ecclesia: string; invitable: boolean }
type Gender = 'male' | 'female' | ''
type Baptized = 'yes' | 'no' | ''

export function InviteePicker({ onChange, programId, who = 'brethren', ecclesia }: InviteePickerProps) {
  const [mode, setMode] = useState<'search' | 'picked' | 'add'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<{ personId: string; displayName: string; ecclesia?: string } | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (mode !== 'search') return
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }
    const mine = ++seq.current
    setLoading(true)
    const params = new URLSearchParams({ q, ...(programId ? { type: programId } : {}), ...(ecclesia ? { ecclesia } : {}) })
    const t = setTimeout(() => {
      void callApi<SearchResults>(`/api/speaker-invites/candidates?${params.toString()}`).then((res) => {
        if (mine !== seq.current) return
        setLoading(false)
        setResults(
          res.ok
            ? { candidates: res.data.candidates ?? [], outside: res.data.outside ?? [], outsideLabel: res.data.outsideLabel }
            : { candidates: [], outside: [] }
        )
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, mode, programId, ecclesia])

  // A different program draws from different people: a pick made for the last one no longer holds.
  const lastProgram = useRef(programId)
  useEffect(() => {
    if (lastProgram.current === programId) return
    lastProgram.current = programId
    setPicked(null)
    setMode('search')
    onChange(null)
  }, [programId])

  const pick = (p: { personId: string; displayName: string; ecclesia?: string }) => {
    setPicked(p)
    setMode('picked')
    onChange({ kind: 'person', ...p })
  }

  const change = () => {
    setPicked(null)
    setMode('search')
    onChange(null)
  }

  if (mode === 'picked' && picked) {
    return (
      <XStack gap="$3" alignItems="center" flexWrap="wrap" testID="invitee-picked">
        <User size={16} color="$colorSecondary" />
        <YStack flex={1} minWidth={160}>
          <Text fontWeight="600">{picked.displayName}</Text>
          {picked.ecclesia ? (
            <Text fontSize="$2" color="$colorSecondary">
              {picked.ecclesia}
            </Text>
          ) : null}
        </YStack>
        <Button size="$3" variant="outlined" onPress={change} testID="invitee-change">
          Change
        </Button>
      </XStack>
    )
  }

  if (mode === 'add') {
    return (
      <AddInviteeForm
        typed={query}
        who={who}
        onPickExisting={pick}
        onBack={() => {
          setMode('search')
          onChange(null)
        }}
        onChange={onChange}
      />
    )
  }

  const typed = query.trim()
  // Brethren programs keep the §9b groups; other programs list everyone the filter allows.
  const groups = results && who === 'brethren' ? groupInviteCandidates(results.candidates) : null
  const plainTitle = who === 'sisters' ? 'Sisters' : 'People'
  return (
    <YStack gap="$2">
      <Input value={query} onChangeText={setQuery} placeholder="Start typing a name" testID="invitee-search" />
      {typed.length > 0 ? (
        <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$3" overflow="hidden" testID="invitee-results">
          {loading ? (
            <XStack padding="$3" gap="$2" alignItems="center">
              <Spinner size="small" width={14} height={14} />
              <Text fontSize="$2" color="$colorSecondary">
                Searching the directory…
              </Text>
            </XStack>
          ) : null}
          {groups && groups.brethren.length > 0 ? (
            <ResultGroup title="Brethren">
              {groups.brethren.map((c) => (
                <ResultRow key={c.personId} candidate={c} onPick={() => pick(c)} />
              ))}
            </ResultGroup>
          ) : null}
          {groups && groups.unconfirmed.length > 0 ? (
            <ResultGroup title="Not yet confirmed as a baptized brother">
              {groups.unconfirmed.map((c) => (
                <UnconfirmedRow key={c.personId} candidate={c} onConfirmed={pick} />
              ))}
            </ResultGroup>
          ) : null}
          {results && who !== 'brethren' && results.candidates.length > 0 ? (
            <ResultGroup title={plainTitle}>
              {results.candidates.map((c) => (
                <ResultRow key={c.personId} candidate={c} onPick={() => pick(c)} />
              ))}
            </ResultGroup>
          ) : null}
          {results && results.outside.length > 0 ? (
            <ResultGroup title={results.outsideLabel ?? 'Further away'} testID="invitee-outside">
              {results.outside.map((c) =>
                who === 'brethren' && groupInviteCandidates([c]).unconfirmed.length > 0 ? (
                  <UnconfirmedRow key={c.personId} candidate={c} onConfirmed={pick} />
                ) : (
                  <ResultRow key={c.personId} candidate={c} onPick={() => pick(c)} />
                )
              )}
            </ResultGroup>
          ) : null}
          <XStack
            padding="$3"
            gap="$2"
            alignItems="center"
            cursor="pointer"
            backgroundColor="$background"
            hoverStyle={{ backgroundColor: '$blue3' }}
            pressStyle={{ backgroundColor: '$blue4' }}
            onPress={() => {
              setMode('add')
              onChange(null, 'Finish adding the new person.')
            }}
            testID="invitee-add"
          >
            <Plus size={14} color="$blue10" />
            <Text fontSize="$3" color="$blue11">{`${typed} isn’t listed, add them`}</Text>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}

function ResultGroup({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return (
    <YStack testID={testID}>
      <Text fontSize="$1" fontWeight="600" color="$colorSecondary" paddingHorizontal="$3" paddingTop="$2" textTransform="uppercase">
        {title}
      </Text>
      {children}
    </YStack>
  )
}

function ResultRow({ candidate: c, onPick }: { candidate: InviteCandidate; onPick: () => void }) {
  return (
    <XStack
      padding="$3"
      gap="$2"
      alignItems="center"
      cursor="pointer"
      backgroundColor="$background"
      hoverStyle={{ backgroundColor: '$blue3' }}
      pressStyle={{ backgroundColor: '$blue4' }}
      onPress={onPick}
      testID={`invitee-result-${c.personId}`}
    >
      <User size={14} color="$colorSecondary" />
      <Text fontSize="$3" flex={1}>
        {c.displayName}
      </Text>
      {c.ecclesia ? (
        <Text fontSize="$1" color="$colorSecondary">
          {c.ecclesia}
        </Text>
      ) : null}
    </XStack>
  )
}

/** A person whose gender and/or baptism isn't recorded: confirm in-page, then pick. */
function UnconfirmedRow({
  candidate: c,
  onConfirmed,
}: {
  candidate: InviteCandidate
  onConfirmed: (p: { personId: string; displayName: string; ecclesia?: string }) => void
}) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirm = async () => {
    setBusy(true)
    setError(null)
    const res = await callApi<{ person: { personId: string; displayName: string; ecclesia: string } }>(
      '/api/speaker-invites/confirm-brother',
      { method: 'POST', body: { personId: c.personId } }
    )
    setBusy(false)
    if (res.ok) {
      onConfirmed(res.data.person)
      return
    }
    setError(res.error.error || 'Could not record that. Nothing was changed.')
  }
  return (
    <YStack padding="$3" gap="$2" testID={`invitee-unconfirmed-${c.personId}`}>
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <User size={14} color="$colorSecondary" />
        <Text fontSize="$3" flex={1} minWidth={120}>
          {c.displayName}
        </Text>
        {c.ecclesia ? (
          <Text fontSize="$1" color="$colorSecondary">
            {c.ecclesia}
          </Text>
        ) : null}
        {asking ? null : (
          <Button size="$2" variant="outlined" onPress={() => setAsking(true)} testID={`confirm-brother-${c.personId}`}>
            Confirm: baptized brother
          </Button>
        )}
      </XStack>
      {asking ? (
        <YStack gap="$2">
          <Text fontSize="$2">{`Confirm ${c.displayName} as a baptized brother? This is shown wherever titles are used.`}</Text>
          <XStack gap="$2">
            <Button size="$2" variant="action" disabled={busy} onPress={confirm} testID={`confirm-brother-yes-${c.personId}`}>
              {busy ? 'Saving…' : 'Yes, confirm'}
            </Button>
            <Button size="$2" variant="outlined" onPress={() => setAsking(false)}>
              Cancel
            </Button>
          </XStack>
        </YStack>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </YStack>
  )
}

function AddInviteeForm({
  typed,
  who,
  onPickExisting,
  onBack,
  onChange,
}: {
  typed: string
  who: InviteWho
  onPickExisting: (p: { personId: string; displayName: string; ecclesia?: string }) => void
  onBack: () => void
  onChange: InviteePickerProps['onChange']
}) {
  const initial = splitTypedName(typed)
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState(initial.firstName)
  const [lastName, setLastName] = useState(initial.lastName)
  const [ecclesia, setEcclesia] = useState('')
  const [gender, setGender] = useState<Gender>('')
  const [baptized, setBaptized] = useState<Baptized>('')
  const [baptismDate, setBaptismDate] = useState('')
  const [match, setMatch] = useState<EmailMatch | null>(null)
  const [checkedEmail, setCheckedEmail] = useState('')
  const [sharedWith, setSharedWith] = useState<EmailMatch | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const lookupSeq = useRef(0)

  const lookup = async (raw: string) => {
    const e = raw.trim().toLowerCase()
    if (!EMAIL_RE.test(e) || e === checkedEmail) return
    const mine = ++lookupSeq.current
    const res = await callApi<{ match: EmailMatch | null }>(
      `/api/speaker-invites/lookup-email?email=${encodeURIComponent(e)}&who=${who}`
    )
    if (mine !== lookupSeq.current) return
    setCheckedEmail(e)
    if (res.ok) {
      setLookupError(null)
      setMatch(res.data.match)
    } else {
      setMatch(null)
      setLookupError(res.error.error || 'Could not check that email.')
    }
  }

  // Debounced check while typing (blur checks at once).
  useEffect(() => {
    const t = setTimeout(() => void lookup(email), 600)
    return () => clearTimeout(t)
  }, [email])

  const emailKey = email.trim().toLowerCase()
  const checked = !!emailKey && emailKey === checkedEmail
  const pendingMatch = checked && match && !(sharedWith && sharedWith.personId === match.personId) ? match : null
  // Names filled in but no usable email yet: point at the email field.
  const emailMissing = !!firstName.trim() && !!lastName.trim() && !EMAIL_RE.test(emailKey)

  // Report the current state up.
  useEffect(() => {
    const problem = (() => {
      if (!EMAIL_RE.test(emailKey)) return 'Enter their email address.'
      if (!checked) return 'Checking the email…'
      if (pendingMatch) return 'Answer whether this email belongs to them.'
      if (!firstName.trim() || !lastName.trim()) return 'Enter their first and last name.'
      if (!ecclesia) return 'Choose their home ecclesia.'
      if (!gender) return 'Choose Brother or Sister.'
      const refusal = genderRefusal(who, gender, baptized)
      if (refusal) return refusal
      if (baptismDate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(baptismDate.trim())) return 'The baptism date must be YYYY-MM-DD.'
      return null
    })()
    if (problem) {
      onChange(null, problem)
      return
    }
    onChange({
      kind: 'new',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: emailKey,
      ecclesia,
      gender: gender === 'female' ? 'female' : 'male',
      ...(baptized === 'yes' ? { baptized: true, ...(baptismDate.trim() ? { baptismDate: baptismDate.trim() } : {}) } : {}),
      ...(sharedWith ? { sharedEmailConfirmedNotSamePerson: true } : {}),
    })
  }, [emailKey, checked, pendingMatch, firstName, lastName, ecclesia, gender, baptized, baptismDate, sharedWith, who])

  const firstOf = (name: string) => name.trim().split(/\s+/)[0] || name

  return (
    <YStack gap="$3" testID="invitee-add-form">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontWeight="600">Add someone to the directory</Text>
        <Button size="$2" variant="outlined" onPress={onBack}>
          Back to search
        </Button>
      </XStack>

      <YStack gap="$1">
        <Text fontSize="$2">Email</Text>
        <Input
          value={email}
          onChangeText={(v) => {
            setEmail(v)
            setSharedWith(null)
          }}
          onBlur={() => void lookup(email)}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          borderColor={emailMissing ? '$red8' : undefined}
          testID="invitee-email"
        />
        {emailMissing ? (
          <Text fontSize="$2" color="$red10" testID="invitee-email-missing">
            {emailKey ? 'That doesn’t look like an email address.' : 'Enter their email address.'}
          </Text>
        ) : null}
        {lookupError ? <Notice tone="error">{lookupError}</Notice> : null}
        {pendingMatch ? (
          <YStack gap="$2" testID="invitee-email-match">
            <Text fontSize="$3">
              {pendingMatch.invitable
                ? `This email belongs to ${pendingMatch.displayName} (${pendingMatch.ecclesia || 'no ecclesia'}). Is that who you mean?`
                : `This email belongs to ${pendingMatch.displayName} (${pendingMatch.ecclesia || 'no ecclesia'}), who ${NOT_ELIGIBLE_PHRASE[who]}.`}
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              {pendingMatch.invitable ? (
                <Button size="$3" variant="action" onPress={() => onPickExisting(pendingMatch)} testID="invitee-email-yes">
                  {`Yes, invite ${firstOf(pendingMatch.displayName)}`}
                </Button>
              ) : null}
              <Button size="$3" variant="outlined" onPress={() => setSharedWith(pendingMatch)} testID="invitee-email-no">
                No, someone else uses this address
              </Button>
            </XStack>
          </YStack>
        ) : null}
        {sharedWith && checked ? (
          <Text fontSize="$2" color="$colorSecondary" testID="invitee-shared-note">
            {`They’ll share this address with ${sharedWith.displayName}. When they sign in, they’ll be asked which of them they are.`}
          </Text>
        ) : null}
      </YStack>

      <XStack gap="$2" flexWrap="wrap">
        <YStack flex={1} minWidth={160} gap="$1">
          <Text fontSize="$2">First name</Text>
          <Input value={firstName} onChangeText={setFirstName} placeholder="First name" testID="invitee-first" />
        </YStack>
        <YStack flex={1} minWidth={160} gap="$1">
          <Text fontSize="$2">Last name</Text>
          <Input value={lastName} onChangeText={setLastName} placeholder="Last name" testID="invitee-last" />
        </YStack>
      </XStack>

      <YStack gap="$1">
        <Text fontSize="$2">Home ecclesia</Text>
        <EcclesiaAutocomplete value={ecclesia} onChange={setEcclesia} placeholder="Start typing their ecclesia" testID="invitee-ecclesia" />
      </YStack>

      <Choice
        label="Brother or Sister"
        value={gender}
        options={[
          { value: 'male', label: 'Brother' },
          { value: 'female', label: 'Sister' },
        ]}
        onChange={(v) => setGender(v as Gender)}
        testID="invitee-gender"
      />
      {who === 'brethren' && gender === 'female' ? (
        <Notice tone="info">This list is for inviting brethren to speak, so the invitation won’t be sent.</Notice>
      ) : null}
      {who === 'sisters' && gender === 'male' ? (
        <Notice tone="info">This program invites sisters, so the invitation won’t be sent.</Notice>
      ) : null}

      {gender !== '' && !genderRefusal(who, gender, '') ? (
        <YStack gap="$2">
          <Choice
            label="Baptized? (optional)"
            value={baptized}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            // Optional: tapping the chosen answer again clears it (left unrecorded).
            onChange={(v) => setBaptized(v === baptized ? '' : (v as Baptized))}
            testID="invitee-baptized"
          />
          {baptized === 'no' && who !== 'anyone' ? (
            <Notice tone="info">
              {who === 'sisters'
                ? 'Only baptized sisters can be invited to this program, so the invitation won’t be sent.'
                : 'Only baptized brethren can be invited to speak, so the invitation won’t be sent.'}
            </Notice>
          ) : null}
          {baptized === '' ? (
            <Text fontSize="$2" color="$colorSecondary">
              Left blank, baptism stays unrecorded until someone confirms it. You can still send it.
            </Text>
          ) : null}
          {baptized === 'yes' ? (
            <YStack gap="$1">
              <Text fontSize="$2">Baptism date (optional)</Text>
              <Input width={160} value={baptismDate} onChangeText={setBaptismDate} placeholder="YYYY-MM-DD" testID="invitee-baptism-date" />
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}

/** Why the "add them" answers can't be sent for this program's WHO (§3a, §9b), or null. */
function genderRefusal(who: InviteWho, gender: Gender, baptized: Baptized): string | null {
  if (who === 'brethren') {
    if (gender === 'female') return 'Invitations to speak are for brethren, so this can’t be sent.'
    if (baptized === 'no') return 'Only baptized brethren can be invited to speak, so this can’t be sent.'
  }
  if (who === 'sisters') {
    if (gender === 'male') return 'This program invites sisters, so this can’t be sent.'
    if (baptized === 'no') return 'Only baptized sisters can be invited to this program, so this can’t be sent.'
  }
  return null
}

const NOT_ELIGIBLE_PHRASE: Record<InviteWho, string> = {
  brethren: 'isn’t recorded as a baptized brother',
  sisters: 'isn’t recorded as a sister',
  anyone: 'can’t be invited',
}

/** A required single choice: no default, every option a button. */
