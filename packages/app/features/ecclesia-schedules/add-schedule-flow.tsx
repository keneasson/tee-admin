import { useMemo, useState } from 'react'
import { Button, Card, H4, Input, Paragraph, Separator, Text, XStack, YStack } from '@my/ui'
import { ArrowLeft } from '@tamagui/lucide-icons'
import { SCHEDULE_TYPE_CATALOGUE, type ScheduleTypeKey } from '@my/app/config/schedule-fields'
import { BUILT_IN_ROSTER_ROLES } from '@my/app/provider/schedule-sources/roster-roles'
import type { ColumnMapping } from '@my/app/provider/schedule-sources/types'
import { callApi, scoped } from './api'
import { CopyText, NONE, Notice, PersonToggle, PickOne } from './parts'
import type { ConnectResponse, PreviewResponse, ScheduleEntryView, SyncResponse } from './types'

/**
 * Add (or re-point) a schedule (docs/ECCLESIA_SCHEDULES.md §Screen):
 *   paste link → share with our address → pick tab → map columns → preview → Save & sync
 */
export interface AddScheduleFlowProps {
  ecclesia: string | null
  serviceAccountEmail: string | null
  /** Kinds this ecclesia can still add. When editing, just that entry's kind. */
  kinds: ScheduleTypeKey[]
  /** Editing an existing google-sheets schedule. */
  editing?: ScheduleEntryView
  onCancel: () => void
  onDone: (message: string) => void
}

type Step = 'link' | 'share' | 'tab' | 'map' | 'preview'

interface ColumnChoice {
  key: string // catalogue key or NONE
  rosterRole: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** First guess at which catalogue field a header is. */
function guessField(kind: ScheduleTypeKey, header: string): string {
  const h = norm(header)
  const f = SCHEDULE_TYPE_CATALOGUE[kind].fields.find((c) => norm(c.key) === h || norm(c.defaultLabel) === h)
  return f ? f.key : NONE
}

export function AddScheduleFlow({ ecclesia, serviceAccountEmail, kinds, editing, onCancel, onDone }: AddScheduleFlowProps) {
  const [step, setStep] = useState<Step>('link')
  const [kind, setKind] = useState<ScheduleTypeKey | ''>(editing?.kind ?? (kinds.length === 1 ? kinds[0] : ''))
  const [sheetUrl, setSheetUrl] = useState(
    editing?.source.kind === 'google-sheets' && editing.source.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${editing.source.spreadsheetId}/edit`
      : ''
  )
  const [sheet, setSheet] = useState<ConnectResponse | null>(null)
  const [tab, setTab] = useState<string>('')
  const [dateColumn, setDateColumn] = useState<string>(NONE)
  const [timeColumn, setTimeColumn] = useState<string>(NONE)
  const [columns, setColumns] = useState<Record<string, ColumnChoice>>({})
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headers = useMemo(() => sheet?.tabs.find((t) => t.name === tab)?.headers ?? [], [sheet, tab])
  const def = kind ? SCHEDULE_TYPE_CATALOGUE[kind] : null

  const chooseTab = (name: string) => {
    if (!kind) return
    setTab(name)
    const hs = sheet?.tabs.find((t) => t.name === name)?.headers ?? []
    const prior = editing?.source.kind === 'google-sheets' && editing.source.tab === name ? editing.mapping : null
    const roster = BUILT_IN_ROSTER_ROLES[kind] ?? []
    const next: Record<string, ColumnChoice> = {}
    for (const h of hs) {
      const was = prior?.fields.find((f) => f.column === h)
      const key = was ? was.key : guessField(kind, h)
      next[h] = { key, rosterRole: was ? was.rosterRole : roster.includes(key) }
    }
    setColumns(next)
    setDateColumn(prior?.dateColumn ?? hs.find((h) => /date|when/i.test(h)) ?? NONE)
    setTimeColumn(prior?.timeColumn ?? hs.find((h) => /time|start/i.test(h)) ?? NONE)
    setError(null)
    setStep('map')
  }

  const draft = (): { name: string; source: { spreadsheetId: string; tab: string }; mapping: ColumnMapping } | null => {
    if (!sheet || !def) return null
    return {
      name: editing?.name ?? def.defaultLabel,
      source: { spreadsheetId: sheet.spreadsheetId, tab },
      mapping: {
        dateColumn,
        ...(timeColumn !== NONE ? { timeColumn } : {}),
        fields: Object.entries(columns)
          .filter(([column, c]) => c.key !== NONE && column !== dateColumn && column !== timeColumn)
          .map(([column, c]) => ({
            column,
            key: c.key,
            label: def.fields.find((f) => f.key === c.key)?.defaultLabel ?? c.key,
            rosterRole: c.rosterRole,
          })),
      },
    }
  }

  const mappingProblem = (): string | null => {
    if (dateColumn === NONE) return 'Choose the column that holds the date.'
    const d = draft()
    if (!d || d.mapping.fields.length === 0) return 'Choose a field for at least one column.'
    const keys = d.mapping.fields.map((f) => f.key)
    const dup = keys.find((k, i) => keys.indexOf(k) !== i)
    if (dup) return `${def?.fields.find((f) => f.key === dup)?.defaultLabel ?? dup} is chosen for two columns. Pick one.`
    return null
  }

  const checkAccess = async () => {
    if (!kind) return
    setBusy(true)
    setError(null)
    const res = await callApi<ConnectResponse>(scoped('/api/ecclesia-schedules/connect', ecclesia), {
      method: 'POST',
      body: { sheetUrl, scheduleId: kind },
    })
    setBusy(false)
    if (!res.ok) {
      setError(
        res.error.code === 'NOT_SHARED'
          ? "We still can't open that sheet. Check that it's shared with the address above, then try again."
          : res.error.error || 'Something went wrong. Please try again.'
      )
      return
    }
    setSheet(res.data)
    setStep('tab')
  }

  const runPreview = async () => {
    const problem = mappingProblem()
    if (problem) return setError(problem)
    const d = draft()
    if (!d || !kind) return
    setBusy(true)
    setError(null)
    const res = await callApi<PreviewResponse>(scoped(`/api/ecclesia-schedules/${kind}/sync`, ecclesia, { dryRun: '1' }), {
      method: 'POST',
      body: d,
    })
    setBusy(false)
    if (!res.ok) return setError(res.error.error || 'We could not read the rows. Please try again.')
    setPreview(res.data)
    setStep('preview')
  }

  const saveAndSync = async () => {
    const d = draft()
    if (!d || !kind) return
    setBusy(true)
    setError(null)
    const saved = await callApi<{ entry: ScheduleEntryView }>(scoped(`/api/ecclesia-schedules/${kind}`, ecclesia), {
      method: 'PUT',
      body: { ...d, active: editing?.active ?? true },
    })
    if (!saved.ok) {
      setBusy(false)
      return setError(saved.error.error || 'We could not save this schedule.')
    }
    const synced = await callApi<SyncResponse>(scoped(`/api/ecclesia-schedules/${kind}/sync`, ecclesia), { method: 'POST', body: {} })
    setBusy(false)
    onDone(
      synced.ok
        ? `${d.name} is connected. ${synced.data.rows ?? 0} rows copied in; it will refresh every night.`
        : `${d.name} is saved, but the first copy did not finish: ${synced.error.error ?? 'please press Sync now.'}`
    )
  }

  const back = (to: Step) => {
    setError(null)
    setStep(to)
  }

  return (
    <Card padding="$4" bordered gap="$3" testID="add-schedule-flow">
      <XStack alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="$2">
        <H4>{editing ? `Change ${editing.name}` : 'Add a schedule'}</H4>
        <Button size="$2" variant="outlined" onPress={onCancel} testID="flow-cancel">
          Cancel
        </Button>
      </XStack>
      <Separator />

      {step === 'link' ? (
        <YStack gap="$3">
          {editing ? null : (
            <PickOne
              label="Which schedule is this?"
              value={kind || NONE}
              options={[
                { value: NONE, label: 'Choose…' },
                ...kinds.map((k) => ({ value: k, label: SCHEDULE_TYPE_CATALOGUE[k].defaultLabel })),
              ]}
              onChange={(v) => setKind(v === NONE ? '' : (v as ScheduleTypeKey))}
              testID="flow-kind"
            />
          )}
          <YStack gap="$1">
            <Text fontSize="$2">Link to your Google Sheet</Text>
            <Input
              value={sheetUrl}
              onChangeText={setSheetUrl}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              testID="flow-sheet-url"
            />
            <Text fontSize="$2" color="$colorSecondary">
              Open the sheet and copy the address from your browser.
            </Text>
          </YStack>
          <XStack>
            <Button
              variant="action"
              disabled={!kind || !sheetUrl.trim()}
              onPress={() => back('share')}
              testID="flow-next-share"
            >
              Next
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {step === 'share' ? (
        <YStack gap="$3">
          <Paragraph>Share the sheet with us so we can read it. We only ever read it; we never change it.</Paragraph>
          <YStack gap="$1">
            <Text>1. In the sheet, press Share.</Text>
            <Text>2. Paste this address and choose Viewer:</Text>
          </YStack>
          {serviceAccountEmail ? (
            <CopyText value={serviceAccountEmail} testID="service-account-email" />
          ) : (
            <Notice tone="warning">Sharing is not set up on this site yet. Please ask the site owner.</Notice>
          )}
          <Text>3. Press Send (or Share), then come back here.</Text>
          <XStack gap="$2" flexWrap="wrap">
            <Button variant="outlined" icon={ArrowLeft} onPress={() => back('link')}>
              Back
            </Button>
            <Button variant="action" disabled={busy || !serviceAccountEmail} onPress={checkAccess} testID="flow-check-access">
              {busy ? 'Checking…' : "I've shared it — check access"}
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {step === 'tab' && sheet ? (
        <YStack gap="$3">
          <Paragraph>
            {sheet.title ? `We can read “${sheet.title}”. ` : 'We can read your sheet. '}
            Which tab holds the {def?.defaultLabel ?? 'schedule'}?
          </Paragraph>
          {sheet.tabs.length === 0 ? <Notice tone="warning">This sheet has no tabs we can read.</Notice> : null}
          <XStack gap="$2" flexWrap="wrap" role="radiogroup" aria-label="Tab">
            {sheet.tabs.map((t) => (
              <Button
                key={t.name}
                variant={tab === t.name ? 'action' : 'outlined'}
                role="radio"
                aria-checked={tab === t.name}
                onPress={() => chooseTab(t.name)}
                testID={`flow-tab-${t.name}`}
              >
                {t.name}
              </Button>
            ))}
          </XStack>
          <XStack>
            <Button variant="outlined" icon={ArrowLeft} onPress={() => back('share')}>
              Back
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {step === 'map' && def ? (
        <YStack gap="$3">
          <Paragraph>Tell us what each column means. Columns you don't need can stay as “Not used”.</Paragraph>
          {headers.length === 0 ? (
            <Notice tone="warning">The first row of this tab is empty. Put the column names in the first row.</Notice>
          ) : null}
          <XStack gap="$3" flexWrap="wrap">
            <PickOne
              label="Date column"
              value={dateColumn}
              options={[{ value: NONE, label: 'Choose…' }, ...headers.map((h) => ({ value: h, label: h }))]}
              onChange={setDateColumn}
              testID="flow-date-column"
            />
            <PickOne
              label="Time column (optional)"
              value={timeColumn}
              options={[{ value: NONE, label: 'No time column' }, ...headers.map((h) => ({ value: h, label: h }))]}
              onChange={setTimeColumn}
              testID="flow-time-column"
            />
          </XStack>
          <YStack gap="$2">
            {headers
              .filter((h) => h !== dateColumn && h !== timeColumn)
              .map((h) => {
                const choice = columns[h] ?? { key: NONE, rosterRole: false }
                return (
                  <XStack key={h} gap="$3" alignItems="center" flexWrap="wrap" testID={`flow-column-${h}`}>
                    <Text width={160} fontWeight="600" numberOfLines={1}>
                      {h}
                    </Text>
                    <PickOne
                      value={choice.key}
                      options={[
                        { value: NONE, label: 'Not used' },
                        ...def.fields.map((f) => ({ value: f.key, label: f.defaultLabel })),
                      ]}
                      onChange={(key) =>
                        setColumns((prev) => ({
                          ...prev,
                          [h]: { key, rosterRole: key === NONE ? false : prev[h]?.rosterRole ?? false },
                        }))
                      }
                      testID={`flow-field-${h}`}
                    />
                    <PersonToggle
                      on={choice.rosterRole}
                      disabled={choice.key === NONE}
                      onChange={(on) => setColumns((prev) => ({ ...prev, [h]: { ...choice, rosterRole: on } }))}
                      testID={`flow-person-${h}`}
                    />
                  </XStack>
                )
              })}
          </YStack>
          <Text fontSize="$2" color="$colorSecondary">
            “Names a person” marks a column like Speaker or Exhort, so speaker invitations can fill it.
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            <Button variant="outlined" icon={ArrowLeft} onPress={() => back('tab')}>
              Back
            </Button>
            <Button variant="action" disabled={busy} onPress={runPreview} testID="flow-preview">
              {busy ? 'Reading…' : 'Preview'}
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {step === 'preview' && preview && def ? (
        <YStack gap="$3">
          <Paragraph>
            {preview.total === 0
              ? 'We did not find any rows with a date we could read. Check the date column.'
              : `We found ${preview.total} dated ${preview.total === 1 ? 'row' : 'rows'}. Here are the first ${preview.rows.length}:`}
          </Paragraph>
          <YStack gap="$2" testID="flow-preview-rows">
            {preview.rows.map((r, i) => (
              <Card key={`${r.date}-${i}`} padding="$2" bordered>
                <Text fontWeight="600">{`${r.date}${r.time ? ` · ${r.time}` : ''}`}</Text>
                <Text fontSize="$2" color="$colorSecondary">
                  {def.fields
                    .filter((f) => r.scheduleData[f.key])
                    .map((f) => `${f.defaultLabel}: ${r.scheduleData[f.key]}`)
                    .join(' · ') || 'No mapped values in this row'}
                </Text>
              </Card>
            ))}
          </YStack>
          <XStack gap="$2" flexWrap="wrap">
            <Button variant="outlined" icon={ArrowLeft} onPress={() => back('map')}>
              Back
            </Button>
            <Button variant="action" disabled={busy || preview.total === 0} onPress={saveAndSync} testID="flow-save">
              {busy ? 'Saving…' : 'Save & sync'}
            </Button>
          </XStack>
        </YStack>
      ) : null}

      {error ? <Notice tone="error" testID="flow-error">{error}</Notice> : null}
    </Card>
  )
}
