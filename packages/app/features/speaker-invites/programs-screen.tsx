import { useCallback, useEffect, useState } from 'react'
import { YStack, XStack, Text, Card, Heading, Paragraph, Button, Input, TextArea, Checkbox, PageHeader, LoadingState } from '@my/ui'
import { Check, Plus } from '@tamagui/lucide-icons'
import { callApi } from './api'
import { Choice } from './choice'
import { Notice } from './identity-parts'
import { EcclesiaAutocomplete } from './ecclesia-autocomplete'
import { NOT_AN_INVITER } from './format'
import { SCHEDULE_TYPE_CATALOGUE, type ScheduleTypeKey } from '@my/app/config/schedule-fields'
import {
  INVITE_WHERE,
  INVITE_WHERE_LABEL,
  INVITE_WHO,
  INVITE_WHO_LABEL,
  type InviteProgram,
  type LinkOption,
} from '@my/app/provider/dynamodb/invite-program-types'

/**
 * Invitation programs, `/admin/speaker-invites/programs` (spec §3a). An RB or
 * Rep sets up their own ecclesia's programs; only the owner picks another
 * ecclesia. Each program: name, invitation phrase, about line, who + where it
 * draws from, the schedule roster field it fills (from the ecclesia's
 * registered schedules), calendar length, and on/off. The API re-checks it all.
 */
export interface InviteProgramsScreenProps {
  ownEcclesia: string | null
  isOwner: boolean
  /** Open the schedule setup page ("Connect a schedule first"). */
  onConnectSchedules: () => void
  /** Back to the invitations. */
  onDone: () => void
}

type Draft = Omit<InviteProgram, 'lengthMinutes' | 'order'> & { lengthMinutes: string; key: string; isNew?: boolean }

const NO_LINK = '__none__'
const linkValue = (l?: { scheduleId: string; field: string }) => (l ? `${l.scheduleId}::${l.field}` : NO_LINK)

let draftSeq = 0
const toDraft = (p: InviteProgram): Draft => ({ ...p, lengthMinutes: String(p.lengthMinutes), key: p.programId || `new-${++draftSeq}` })

function blankDraft(): Draft {
  return {
    key: `new-${++draftSeq}`,
    isNew: true,
    programId: '',
    name: '',
    phrase: '',
    who: 'brethren',
    where: 'region',
    lengthMinutes: '60',
    active: true,
  }
}

export function InviteProgramsScreen({ ownEcclesia, isOwner, onConnectSchedules, onDone }: InviteProgramsScreenProps) {
  const [ecclesia, setEcclesia] = useState(ownEcclesia ?? '')
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [options, setOptions] = useState<LinkOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string; errors?: string[] } | null>(null)

  const query = isOwner && ecclesia ? `?ecclesia=${encodeURIComponent(ecclesia)}` : ''

  const load = useCallback(async () => {
    if (!ecclesia) return
    setLoadError(null)
    const res = await callApi<{ ecclesia: string; programs: InviteProgram[]; linkOptions: LinkOption[] }>(
      `/api/speaker-invites/programs${query}`
    )
    if (res.ok) {
      setDrafts(res.data.programs.map(toDraft))
      setOptions(res.data.linkOptions)
    } else if (res.status === 403) {
      setForbidden(true)
    } else {
      setLoadError(res.error.error || 'Could not load the invitation programs.')
    }
  }, [ecclesia, query])

  useEffect(() => {
    void load()
  }, [load])

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => (prev ? prev.map((d) => (d.key === key ? { ...d, ...patch, builtIn: undefined } : d)) : prev))

  const save = async () => {
    if (!drafts) return
    setSaving(true)
    setResult(null)
    const res = await callApi<{ programs: InviteProgram[] }>(`/api/speaker-invites/programs`, {
      method: 'PUT',
      body: {
        ...(isOwner && ecclesia ? { ecclesia } : {}),
        programs: drafts.map((d) => ({
          ...(d.isNew ? {} : { programId: d.programId }),
          name: d.name,
          phrase: d.phrase,
          about: d.about ?? '',
          who: d.who,
          where: d.where,
          link: d.link ?? null,
          lengthMinutes: Number(d.lengthMinutes),
          active: d.active,
        })),
      },
    })
    setSaving(false)
    if (res.ok) {
      setDrafts(res.data.programs.map(toDraft))
      setResult({ tone: 'success', text: 'Saved. New invitations use these words; invitations already sent keep theirs.' })
      return
    }
    if (res.status === 403) {
      setForbidden(true)
      return
    }
    const errors = (res.error as { errors?: string[] }).errors
    setResult({ tone: 'error', text: res.error.error || 'Could not save.', ...(errors && errors.length > 1 ? { errors } : {}) })
  }

  if (forbidden) {
    return (
      <YStack gap="$4" maxWidth={820} width="100%">
        <PageHeader title="Invitation programs" />
        <Notice tone="info" testID="not-an-inviter">
          {NOT_AN_INVITER}
        </Notice>
      </YStack>
    )
  }

  return (
    <YStack gap="$4" maxWidth={820} width="100%">
      <PageHeader
        title={ecclesia ? `Invitation programs · ${ecclesia}` : 'Invitation programs'}
        actions={
          <Button variant="outlined" onPress={onDone} testID="programs-done">
            Back to invitations
          </Button>
        }
      />
      <Paragraph color="$colorSecondary">
        Each program is a kind of invitation your ecclesia sends: the words in the email, who it invites, and which
        schedule it fills. Switch a program off to hide it without losing its history.
      </Paragraph>

      {isOwner ? (
        <Card padding="$4" gap="$2" bordered>
          <Heading size="$4">Ecclesia</Heading>
          <EcclesiaAutocomplete value={ecclesia} onChange={setEcclesia} allowUnlisted={false} testID="programs-ecclesia" />
        </Card>
      ) : null}

      {options.length === 0 && drafts ? (
        <Notice tone="info" testID="connect-schedule-hint">
          No schedule is connected yet, so a new program can only take typed dates. Connect a schedule first to let a
          program offer open dates and fill its roster.
        </Notice>
      ) : null}
      {options.length === 0 && drafts ? (
        <XStack>
          <Button size="$3" variant="outlined" onPress={onConnectSchedules} testID="connect-schedule">
            Connect a schedule first
          </Button>
        </XStack>
      ) : null}

      {loadError ? <Notice tone="error">{loadError}</Notice> : null}
      {drafts === null && !loadError ? <LoadingState label="programs" inline /> : null}

      {(drafts ?? []).map((d) => (
        <ProgramCard key={d.key} draft={d} options={options} onChange={(patch) => update(d.key, patch)} />
      ))}

      {drafts ? (
        <XStack>
          <Button
            variant="outlined"
            icon={Plus}
            onPress={() => setDrafts((prev) => [...(prev ?? []), blankDraft()])}
            testID="add-program"
          >
            Add a program
          </Button>
        </XStack>
      ) : null}

      {result ? (
        <Notice tone={result.tone} testID="programs-result">
          {result.errors ? result.errors.join(' ') : result.text}
        </Notice>
      ) : null}

      {drafts ? (
        <XStack gap="$2">
          <Button variant="action" disabled={saving} onPress={save} testID="programs-save">
            {saving ? 'Saving…' : 'Save programs'}
          </Button>
        </XStack>
      ) : null}
    </YStack>
  )
}

/** "Memorial Service · Exhort" for a link to a catalogue schedule, not the raw keys. */
function builtInLinkLabel(link: { scheduleId: string; field: string }): string {
  const def = SCHEDULE_TYPE_CATALOGUE[link.scheduleId as ScheduleTypeKey]
  if (!def) return `${link.scheduleId} · ${link.field}`
  const field = def.fields.find((f) => f.key === link.field)
  return `${def.defaultLabel} · ${field?.defaultLabel ?? link.field}`
}

function ProgramCard({
  draft: d,
  options,
  onChange,
}: {
  draft: Draft
  options: LinkOption[]
  onChange: (patch: Partial<Draft>) => void
}) {
  const testKey = d.programId || d.key
  // The current link stays choosable even when it isn't a registered roster field (a core program's built-in link).
  const linkChoices = [
    { value: NO_LINK, label: 'No schedule: type the dates' },
    ...options.map((o) => ({ value: linkValue(o), label: `${o.scheduleName} · ${o.fieldLabel}` })),
  ]
  if (d.link && !options.some((o) => linkValue(o) === linkValue(d.link))) {
    linkChoices.push({ value: linkValue(d.link), label: builtInLinkLabel(d.link) })
  }
  return (
    <Card padding="$4" gap="$3" bordered opacity={d.active ? 1 : 0.7} testID={`program-${testKey}`}>
      <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
        <Heading size="$5">{d.name || 'New program'}</Heading>
        <XStack gap="$2" alignItems="center">
          {d.builtIn ? (
            <Text fontSize="$1" color="$colorSecondary">
              Standard wording
            </Text>
          ) : null}
          <Checkbox
            checked={d.active}
            onCheckedChange={(c) => onChange({ active: !!c })}
            aria-label="Program is on"
            size="$4"
            testID={`program-active-${testKey}`}
          >
            <Checkbox.Indicator>
              <Check />
            </Checkbox.Indicator>
          </Checkbox>
          <Text>{d.active ? 'On' : 'Off'}</Text>
        </XStack>
      </XStack>

      <YStack gap="$1">
        <Text fontSize="$2">Name</Text>
        <Input value={d.name} onChangeText={(v) => onChange({ name: v })} placeholder="Bible Class" testID={`program-name-${testKey}`} />
      </YStack>
      <YStack gap="$1">
        <Text fontSize="$2">Invitation phrase</Text>
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Text color="$colorSecondary">An invitation to</Text>
          <Input
            flex={1}
            minWidth={220}
            value={d.phrase}
            onChangeText={(v) => onChange({ phrase: v })}
            placeholder="speak at our Bible Class"
            testID={`program-phrase-${testKey}`}
          />
        </XStack>
      </YStack>
      <YStack gap="$1">
        <Text fontSize="$2">About line (optional, shown after the opening line)</Text>
        <TextArea
          value={d.about ?? ''}
          onChangeText={(v) => onChange({ about: v })}
          placeholder="Optional. For example: when and where it meets, or how long it runs."
          numberOfLines={2}
          testID={`program-about-${testKey}`}
        />
      </YStack>

      <Choice
        label="Who it invites"
        value={d.who}
        options={INVITE_WHO.map((w) => ({ value: w, label: INVITE_WHO_LABEL[w] }))}
        onChange={(v) => onChange({ who: v as Draft['who'] })}
        testID={`program-who-${testKey}`}
      />
      <Choice
        label="From where (a specific name also finds people further away)"
        value={d.where}
        options={INVITE_WHERE.map((w) => ({ value: w, label: INVITE_WHERE_LABEL[w] }))}
        onChange={(v) => onChange({ where: v as Draft['where'] })}
        testID={`program-where-${testKey}`}
      />
      <Choice
        label="Schedule it fills"
        value={linkValue(d.link)}
        options={linkChoices}
        onChange={(v) => {
          if (v === NO_LINK) {
            onChange({ link: undefined })
            return
          }
          const [scheduleId, field] = v.split('::')
          onChange({ link: { scheduleId, field } })
        }}
        testID={`program-link-${testKey}`}
      />
      <YStack gap="$1">
        <Text fontSize="$2">Length in calendars (minutes)</Text>
        <Input
          width={120}
          value={d.lengthMinutes}
          onChangeText={(v) => onChange({ lengthMinutes: v.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          testID={`program-length-${testKey}`}
        />
      </YStack>
    </Card>
  )
}
