import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Input, LoadingState, PageHeader, Paragraph, Text, XStack, YStack } from '@my/ui'
import { Plus, RefreshCw } from '@tamagui/lucide-icons'
import { SCHEDULE_TYPE_CATALOGUE, SCHEDULE_TYPE_KEYS, type ScheduleTypeKey } from '@my/app/config/schedule-fields'
import { callApi, NOT_A_MANAGER, scoped } from './api'
import { AddScheduleFlow } from './add-schedule-flow'
import { Notice, PersonToggle } from './parts'
import type { RegistryResponse, ScheduleEntryView, SyncResponse } from './types'

/**
 * `/admin/ecclesia-schedules` (docs/ECCLESIA_SCHEDULES.md §Screen): the
 * ecclesia's schedules, where each comes from, and which columns name a person.
 * Toronto East's schedules come from the site configuration; only their
 * "names a person" toggles change here.
 */
export function EcclesiaSchedulesScreen() {
  const [data, setData] = useState<RegistryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [ecclesia, setEcclesia] = useState<string | null>(null)
  const [pick, setPick] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ScheduleEntryView | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await callApi<RegistryResponse>(scoped('/api/ecclesia-schedules', ecclesia))
    if (res.ok) {
      setData(res.data)
      setPick((p) => p || res.data.ecclesia)
    } else {
      setData(null)
      setError(res.status === 403 ? NOT_A_MANAGER : res.error.error || 'Could not load schedules.')
    }
  }, [ecclesia])

  useEffect(() => {
    void load()
  }, [load])

  const freeKinds: ScheduleTypeKey[] = data
    ? SCHEDULE_TYPE_KEYS.filter((k) => !data.entries.some((e) => e.kind === k))
    : []

  const finish = (msg: string) => {
    setAdding(false)
    setEditing(null)
    setMessage(msg)
    void load()
  }

  return (
    <YStack gap="$4" width="100%" maxWidth={900}>
      <PageHeader
        title={data ? `Schedules · ${data.ecclesia}` : 'Schedules'}
        actions={
          data && !data.siteManaged && freeKinds.length > 0 && !adding && !editing ? (
            <Button variant="action" icon={Plus} onPress={() => setAdding(true)} testID="add-schedule">
              Add a schedule
            </Button>
          ) : null
        }
      />
      <Paragraph color="$colorSecondary">
        {data?.siteManaged
          ? 'These schedules come from the site configuration. Choose which fields name a person so speaker invitations can fill them.'
          : "Connect your ecclesia's schedule sheet once and we copy it in every night. Speaker invitations use it to find open dates."}
      </Paragraph>

      {data?.canPickEcclesia ? (
        <XStack gap="$2" alignItems="flex-end" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={220}>
            <Text fontSize="$2">Ecclesia</Text>
            <Input value={pick} onChangeText={setPick} placeholder="Ecclesia name" testID="pick-ecclesia" />
          </YStack>
          <Button
            variant="outlined"
            onPress={() => {
              setData(null)
              setEcclesia(pick.trim() || null)
            }}
            testID="pick-ecclesia-show"
          >
            Show
          </Button>
        </XStack>
      ) : null}

      {message ? <Notice tone="success" testID="registry-message">{message}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      {adding && data ? (
        <AddScheduleFlow
          ecclesia={ecclesia}
          serviceAccountEmail={data.serviceAccountEmail}
          kinds={freeKinds}
          onCancel={() => setAdding(false)}
          onDone={finish}
        />
      ) : null}
      {editing && data ? (
        <AddScheduleFlow
          ecclesia={ecclesia}
          serviceAccountEmail={data.serviceAccountEmail}
          kinds={[editing.kind]}
          editing={editing}
          onCancel={() => setEditing(null)}
          onDone={finish}
        />
      ) : null}

      {data === null && !error ? (
        <LoadingState label="schedules" inline />
      ) : data && data.entries.length === 0 ? (
        <Card padding="$4" bordered>
          <Paragraph color="$colorSecondary">
            {data.siteManaged
              ? 'No schedules are set up in the site configuration.'
              : 'No schedules yet. Use “Add a schedule” to connect your Google Sheet.'}
          </Paragraph>
        </Card>
      ) : data ? (
        <YStack gap="$3">
          {data.entries.map((entry) => (
            <ScheduleCard
              key={`${entry.scheduleId}-${entry.updatedAt ?? ""}`}
              entry={entry}
              ecclesia={ecclesia}
              onEdit={() => {
                setAdding(false)
                setEditing(entry)
              }}
              onChanged={(msg) => {
                setMessage(msg)
                void load()
              }}
            />
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}

function formatSync(entry: ScheduleEntryView): string {
  if (entry.siteConfigured) return 'Kept up to date from the sheet automatically.'
  const s = entry.lastSync
  if (!s) return 'Not synced yet.'
  const when = new Date(s.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return s.status === 'ok' ? `Last synced ${when} · ${s.rows} rows` : `Last sync ${when} did not finish: ${s.error ?? 'unknown error'}`
}

function ScheduleCard({
  entry,
  ecclesia,
  onEdit,
  onChanged,
}: {
  entry: ScheduleEntryView
  ecclesia: string | null
  onEdit: () => void
  onChanged: (message: string) => void
}) {
  const [roles, setRoles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(entry.mapping.fields.map((f) => [f.key, f.rosterRole]))
  )
  const [busy, setBusy] = useState<'save' | 'sync' | 'pause' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dirty = entry.mapping.fields.some((f) => roles[f.key] !== f.rosterRole)
  const isSheet = entry.source.kind === 'google-sheets'
  const sourceText = entry.siteConfigured
    ? 'Site configuration'
    : isSheet
      ? `Google Sheet · tab “${'tab' in entry.source ? entry.source.tab ?? '' : ''}”`
      : 'Entered in TEE Admin'

  const put = (body: Record<string, unknown>) =>
    callApi<{ entry: ScheduleEntryView }>(scoped(`/api/ecclesia-schedules/${entry.scheduleId}`, ecclesia), {
      method: 'PUT',
      body,
    })

  const sheetBody = (overrides: Record<string, unknown> = {}) => ({
    name: entry.name,
    active: entry.active,
    source: entry.source,
    mapping: { ...entry.mapping, fields: entry.mapping.fields.map((f) => ({ ...f, rosterRole: !!roles[f.key] })) },
    ...overrides,
  })

  const saveRoles = async () => {
    setBusy('save')
    setError(null)
    const res = await put(
      entry.siteConfigured ? { rosterRoles: Object.keys(roles).filter((k) => roles[k]) } : sheetBody()
    )
    setBusy(null)
    if (res.ok) onChanged(`${entry.name}: saved.`)
    else setError(res.error.error || 'Could not save.')
  }

  const togglePause = async () => {
    setBusy('pause')
    setError(null)
    const res = await put(sheetBody({ active: !entry.active }))
    setBusy(null)
    if (res.ok) onChanged(entry.active ? `${entry.name}: nightly sync paused.` : `${entry.name}: nightly sync resumed.`)
    else setError(res.error.error || 'Could not save.')
  }

  const syncNow = async () => {
    setBusy('sync')
    setError(null)
    const res = await callApi<SyncResponse>(scoped(`/api/ecclesia-schedules/${entry.scheduleId}/sync`, ecclesia), {
      method: 'POST',
      body: {},
    })
    setBusy(null)
    if (res.ok) onChanged(`${entry.name}: ${res.data.rows ?? 0} rows copied in.`)
    else setError(res.error.error || 'The sync did not finish.')
  }

  return (
    <Card padding="$4" bordered gap="$3" testID={`schedule-${entry.scheduleId}`}>
      <YStack gap="$3">
        <YStack gap="$1">
          <Text fontWeight="700" fontSize="$5">
            {entry.name}
          </Text>
          <Text fontSize="$2" color="$colorSecondary" testID={`schedule-${entry.scheduleId}-source`}>
            {`${SCHEDULE_TYPE_CATALOGUE[entry.kind].defaultLabel} · ${sourceText}${entry.active ? '' : ' · paused'}`}
          </Text>
          <Text fontSize="$2" color="$colorSecondary">
            {formatSync(entry)}
          </Text>
        </YStack>
        {isSheet ? (
          <XStack gap="$2" flexWrap="wrap">
            <Button size="$3" variant="outlined" icon={RefreshCw} disabled={busy !== null} onPress={syncNow} testID={`schedule-${entry.scheduleId}-sync`}>
              {busy === 'sync' ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button size="$3" variant="outlined" disabled={busy !== null} onPress={onEdit} testID={`schedule-${entry.scheduleId}-edit`}>
              Change sheet or columns
            </Button>
            <Button size="$3" variant="outlined" disabled={busy !== null} onPress={togglePause}>
              {entry.active ? 'Pause' : 'Resume'}
            </Button>
          </XStack>
        ) : null}
      </YStack>

      <YStack gap="$2">
        <Text fontSize="$2" color="$colorSecondary">
          Fields — turn on “Names a person” for columns speaker invitations can fill.
        </Text>
        {entry.mapping.fields.map((f) => (
          <XStack key={f.key} gap="$3" alignItems="center" flexWrap="wrap">
            <Text width={180}>{f.label}</Text>
            {entry.siteConfigured ? null : (
              <Text fontSize="$2" color="$colorSecondary" width={160} numberOfLines={1}>
                {`from “${f.column}”`}
              </Text>
            )}
            <PersonToggle
              on={!!roles[f.key]}
              disabled={busy !== null}
              onChange={(on) => setRoles((prev) => ({ ...prev, [f.key]: on }))}
              testID={`schedule-${entry.scheduleId}-person-${f.key}`}
            />
          </XStack>
        ))}
      </YStack>

      {dirty ? (
        <XStack gap="$2">
          <Button variant="action" disabled={busy !== null} onPress={saveRoles} testID={`schedule-${entry.scheduleId}-save`}>
            {busy === 'save' ? 'Saving…' : 'Save changes'}
          </Button>
          <Button
            variant="outlined"
            disabled={busy !== null}
            onPress={() => setRoles(Object.fromEntries(entry.mapping.fields.map((f) => [f.key, f.rosterRole])))}
          >
            Undo
          </Button>
        </XStack>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
    </Card>
  )
}
