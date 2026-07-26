'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { YStack, XStack, Text, Heading, Card, Button, Separator, Spinner, Input } from '@my/ui'
import type { AttendOption, AttendMode } from '@my/app/types'

type ServiceType = 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'

const newOptionId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `opt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

const MODE_LABELS: Record<AttendMode, string> = {
  in_person: 'In person',
  stream: 'Live stream',
  online: 'Online',
}

const SERVICE_LABELS: Record<string, string> = {
  memorial: 'Memorial',
  bibleClass: 'Bible Class',
  sundaySchool: 'Sunday School',
  cyc: 'CYC',
}

type Occurrence = {
  serviceType: ServiceType
  date: string // YYYY-MM-DD
  formattedDate: string
  summary: string
}

type OverrideRecord = {
  serviceType: ServiceType
  date: string
  status?: 'cancelled' | 'active'
  message?: string
  note?: string
  attendOptions?: AttendOption[]
}

type ApiResponse = {
  ecclesia: string
  occurrences: Occurrence[]
  overrides: OverrideRecord[]
}

type DraftStatus = 'default' | 'cancelled' | 'active'

type Draft = {
  status: DraftStatus
  message: string
  note: string
  attendOptions: AttendOption[]
}

const keyOf = (serviceType: string, date: string) => `${serviceType}#${date}`

const draftFromOverride = (o?: OverrideRecord): Draft => ({
  status: o?.status ?? 'default',
  message: o?.message ?? '',
  note: o?.note ?? '',
  attendOptions: o?.attendOptions ?? [],
})

export const ScheduleOverridesManager: React.FC = () => {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/schedule-overrides', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: ApiResponse = await res.json()
      setData(json)
      // Seed drafts from existing overrides
      const seeded: Record<string, Draft> = {}
      for (const o of json.overrides) {
        seeded[keyOf(o.serviceType, o.date)] = draftFromOverride(o)
      }
      setDrafts(seeded)
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to load upcoming services.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const overridesByKey = useMemo(() => {
    const map: Record<string, OverrideRecord> = {}
    for (const o of data?.overrides ?? []) map[keyOf(o.serviceType, o.date)] = o
    return map
  }, [data])

  const getDraft = (k: string): Draft =>
    drafts[k] ?? { status: 'default', message: '', note: '', attendOptions: [] }

  const setDraft = (k: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [k]: { ...getDraft(k), ...patch } }))
  }

  const addOption = (k: string) => {
    const d = getDraft(k)
    setDraft(k, {
      attendOptions: [...d.attendOptions, { id: newOptionId(), label: '', mode: 'online' }],
    })
  }

  const updateOption = (k: string, idx: number, patch: Partial<AttendOption>) => {
    const d = getDraft(k)
    setDraft(k, {
      attendOptions: d.attendOptions.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    })
  }

  const removeOption = (k: string, idx: number) => {
    const d = getDraft(k)
    setDraft(k, { attendOptions: d.attendOptions.filter((_, i) => i !== idx) })
  }

  const save = async (occ: Occurrence) => {
    const k = keyOf(occ.serviceType, occ.date)
    const draft = getDraft(k)
    setSavingKey(k)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/schedule-overrides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: occ.serviceType,
          date: occ.date,
          status: draft.status === 'default' ? undefined : draft.status,
          message: draft.message || undefined,
          note: draft.note || undefined,
          attendOptions: draft.attendOptions.length
            ? draft.attendOptions.filter((o) => o.label.trim())
            : undefined,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setStatus({ type: 'success', text: `Saved override for ${SERVICE_LABELS[occ.serviceType]} on ${occ.formattedDate}.` })
      await load()
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to save override.' })
    } finally {
      setSavingKey(null)
    }
  }

  const clear = async (occ: Occurrence) => {
    const k = keyOf(occ.serviceType, occ.date)
    setSavingKey(k)
    setStatus(null)
    try {
      const res = await fetch(
        `/api/admin/schedule-overrides?serviceType=${encodeURIComponent(occ.serviceType)}&date=${encodeURIComponent(occ.date)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('delete failed')
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[k]
        return next
      })
      setStatus({ type: 'success', text: `Cleared override for ${SERVICE_LABELS[occ.serviceType]} on ${occ.formattedDate}.` })
      await load()
    } catch (err) {
      setStatus({ type: 'error', text: 'Failed to clear override.' })
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return (
      <YStack justifyContent="center" alignItems="center" padding="$6">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$3">Loading upcoming services...</Text>
      </YStack>
    )
  }

  const occurrences = data?.occurrences ?? []

  return (
    <YStack space="$4">
      {status ? (
        <Card
          padding="$3"
          backgroundColor={status.type === 'success' ? '$green2' : '$red2'}
          borderWidth={1}
          borderColor={status.type === 'success' ? '$green6' : '$red6'}
        >
          <Text color={status.type === 'success' ? '$green11' : '$red11'}>{status.text}</Text>
        </Card>
      ) : null}

      <XStack>
        <Button size="$3" variant="outlined" onPress={load}>
          Refresh
        </Button>
      </XStack>

      {occurrences.length === 0 ? (
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <Text color="$colorSecondary">No upcoming services found in the next 10 weeks.</Text>
        </Card>
      ) : (
        <YStack space="$3">
          {occurrences.map((occ) => {
            const k = keyOf(occ.serviceType, occ.date)
            const draft = getDraft(k)
            const hasOverride = !!overridesByKey[k]
            const isSaving = savingKey === k

            return (
              <Card key={k} padding="$4" borderWidth={1} borderColor={hasOverride ? '$blue6' : '$borderColor'}>
                <YStack space="$3">
                  <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$2">
                    <YStack flex={1} minWidth={220} space="$1">
                      <Text fontSize="$5" fontWeight="600">
                        {SERVICE_LABELS[occ.serviceType]} — {occ.formattedDate}
                      </Text>
                      <Text fontSize="$2" color="$colorSecondary">
                        {occ.summary}
                      </Text>
                    </YStack>
                    {hasOverride ? (
                      <Text fontSize="$2" color="$blue11" fontWeight="600">
                        Override active
                      </Text>
                    ) : null}
                  </XStack>

                  <Separator />

                  <YStack space="$2">
                    <Text fontSize="$2" fontWeight="600" color="$colorSecondary">
                      Status
                    </Text>
                    <XStack space="$2" flexWrap="wrap">
                      {(['default', 'cancelled', 'active'] as DraftStatus[]).map((s) => (
                        <Button
                          key={s}
                          size="$2"
                          theme={draft.status === s ? 'blue' : undefined}
                          variant={draft.status === s ? undefined : 'outlined'}
                          onPress={() => setDraft(k, { status: s })}
                        >
                          {s === 'default' ? 'Use schedule default' : s === 'cancelled' ? 'Cancel service' : 'Force show'}
                        </Button>
                      ))}
                    </XStack>
                  </YStack>

                  <YStack space="$2">
                    <Text fontSize="$2" fontWeight="600" color="$colorSecondary">
                      Custom message {draft.status === 'cancelled' ? '(replaces the "no service" text)' : '(shown when cancelled)'}
                    </Text>
                    <Input
                      value={draft.message}
                      onChangeText={(t) => setDraft(k, { message: t })}
                      placeholder='e.g. "No service at Toronto East — joint meeting at Toronto West"'
                    />
                  </YStack>

                  <YStack space="$2">
                    <Text fontSize="$2" fontWeight="600" color="$colorSecondary">
                      Note (announcement shown with the service)
                    </Text>
                    <Input
                      value={draft.note}
                      onChangeText={(t) => setDraft(k, { note: t })}
                      placeholder='e.g. "Carpool leaves the hall at 10am"'
                    />
                  </YStack>

                  <YStack space="$2">
                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize="$2" fontWeight="600" color="$colorSecondary">
                        Ways to attend (overrides the default Zoom block)
                      </Text>
                      <Button size="$2" variant="outlined" onPress={() => addOption(k)}>
                        + Add
                      </Button>
                    </XStack>

                    {draft.attendOptions.map((opt, idx) => (
                      <YStack key={opt.id} space="$2" padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$3">
                        <XStack space="$2" flexWrap="wrap">
                          {(['in_person', 'stream', 'online'] as AttendMode[]).map((m) => (
                            <Button
                              key={m}
                              size="$2"
                              theme={opt.mode === m ? 'blue' : undefined}
                              variant={opt.mode === m ? undefined : 'outlined'}
                              onPress={() => updateOption(k, idx, { mode: m })}
                            >
                              {MODE_LABELS[m]}
                            </Button>
                          ))}
                        </XStack>
                        <Input
                          value={opt.label}
                          onChangeText={(t) => updateOption(k, idx, { label: t })}
                          placeholder='Label, e.g. "Toronto West Stream" or "Toronto East Zoom"'
                        />
                        {opt.mode === 'in_person' ? (
                          <>
                            <Input
                              value={opt.address ?? ''}
                              onChangeText={(t) => updateOption(k, idx, { address: t })}
                              placeholder="Address"
                            />
                            <Input
                              value={opt.mapsUrl ?? ''}
                              onChangeText={(t) => updateOption(k, idx, { mapsUrl: t })}
                              placeholder="Google Maps URL (optional)"
                            />
                          </>
                        ) : (
                          <>
                            <Input
                              value={opt.url ?? ''}
                              onChangeText={(t) => updateOption(k, idx, { url: t })}
                              placeholder={opt.mode === 'stream' ? 'Stream URL' : 'Join URL'}
                            />
                            {opt.mode === 'online' ? (
                              <>
                                <Input
                                  value={opt.meetingId ?? ''}
                                  onChangeText={(t) => updateOption(k, idx, { meetingId: t })}
                                  placeholder="Meeting ID (optional)"
                                />
                                <Input
                                  value={opt.password ?? ''}
                                  onChangeText={(t) => updateOption(k, idx, { password: t })}
                                  placeholder="Passcode (optional)"
                                />
                              </>
                            ) : null}
                          </>
                        )}
                        <XStack>
                          <Button size="$2" variant="outlined" theme="red" onPress={() => removeOption(k, idx)}>
                            Remove
                          </Button>
                        </XStack>
                      </YStack>
                    ))}
                  </YStack>

                  <XStack space="$2" flexWrap="wrap">
                    <Button
                      size="$3"
                      theme="blue"
                      onPress={() => save(occ)}
                      disabled={isSaving}
                      icon={isSaving ? <Spinner size="small" width={16} height={16} /> : undefined}
                    >
                      {isSaving ? 'Saving...' : 'Save override'}
                    </Button>
                    {hasOverride ? (
                      <Button size="$3" variant="outlined" onPress={() => clear(occ)} disabled={isSaving}>
                        Clear override
                      </Button>
                    ) : null}
                  </XStack>
                </YStack>
              </Card>
            )
          })}
        </YStack>
      )}
    </YStack>
  )
}
