import { useState, useEffect, useCallback } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Spinner } from '@my/ui'
import { Button } from '../Button'
import { Calendar, Plus, Trash, Save, X, RefreshCw } from '@tamagui/lucide-icons'

type ScheduleType = 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'

interface ScheduleEntry {
  date: string
  type: ScheduleType
  data: Record<string, string>
}

/**
 * Field definitions for each schedule type.
 * `key` is the DB field name (consistent).
 * `defaultLabel` is the default display label (customizable per ecclesia in future).
 */
const SCHEDULE_FIELDS: Record<ScheduleType, Array<{ key: string; defaultLabel: string; required?: boolean }>> = {
  memorial: [
    { key: 'Preside', defaultLabel: 'Preside' },
    { key: 'Exhort', defaultLabel: 'Exhort' },
    { key: 'Reading1', defaultLabel: 'First Reading' },
    { key: 'Reading2', defaultLabel: 'Second Reading' },
    { key: 'Organist', defaultLabel: 'Organist' },
    { key: 'Steward', defaultLabel: 'Steward' },
    { key: 'Doorkeeper', defaultLabel: 'Doorkeeper' },
    { key: 'Collection', defaultLabel: 'Collection' },
    { key: 'Hymn-opening', defaultLabel: 'Opening Hymn' },
    { key: 'Hymn-exhortation', defaultLabel: 'Exhortation Hymn' },
    { key: 'Hymn-memorial', defaultLabel: 'Memorial Hymn' },
    { key: 'Hymn-closing', defaultLabel: 'Closing Hymn' },
    { key: 'Lunch', defaultLabel: 'Lunch' },
  ],
  bibleClass: [
    { key: 'Presider', defaultLabel: 'Presider' },
    { key: 'Speaker', defaultLabel: 'Speaker' },
    { key: 'Topic', defaultLabel: 'Topic' },
    { key: 'Host', defaultLabel: 'Host Ecclesia' },
  ],
  sundaySchool: [
    { key: 'Refreshments', defaultLabel: 'Refreshments' },
    { key: 'Holidays and Special Events', defaultLabel: 'Holidays & Special Events' },
  ],
  cyc: [
    { key: 'location', defaultLabel: 'Location' },
    { key: 'speaker', defaultLabel: 'Speaker' },
    { key: 'topic', defaultLabel: 'Topic' },
  ],
}

const TYPE_LABELS: Record<ScheduleType, string> = {
  memorial: 'Memorial Service',
  bibleClass: 'Bible Class',
  sundaySchool: 'Sunday School',
  cyc: 'CYC',
}

interface ScheduleEditorProps {
  ecclesiaName: string
  canEdit: boolean
}

export function ScheduleEditor({ ecclesiaName, canEdit }: ScheduleEditorProps) {
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeType, setActiveType] = useState<ScheduleType>('memorial')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newData, setNewData] = useState<Record<string, string>>({})

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/ecclesia/${encodeURIComponent(ecclesiaName)}/schedule?type=${activeType}&days=60`
      )
      if (res.ok) {
        const data = await res.json()
        setSchedules(data.schedules || [])
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to load schedules')
      }
    } catch {
      setError('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }, [ecclesiaName, activeType])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const handleSave = async () => {
    if (!newDate) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeType,
          date: newDate,
          data: newData,
        }),
      })
      if (res.ok) {
        setShowAddForm(false)
        setNewDate('')
        setNewData({})
        await fetchSchedules()
      } else {
        const data = await res.json()
        setError(data.error || 'Save failed')
      }
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (entry: ScheduleEntry) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}/schedule`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: entry.type, date: entry.date }),
      })
      if (res.ok) {
        await fetchSchedules()
      }
    } catch {
      setError('Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const fields = SCHEDULE_FIELDS[activeType] || []

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Calendar size={16} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Schedule</Text>
          </XStack>
          <Button size="$2" icon={RefreshCw} variant="outlined" onPress={fetchSchedules} disabled={saving}>
            Refresh
          </Button>
        </XStack>

        {/* Type tabs */}
        <XStack gap="$2" flexWrap="wrap">
          {(Object.keys(TYPE_LABELS) as ScheduleType[]).map((type) => (
            <Button
              key={type}
              size="$2"
              variant={activeType === type ? undefined : 'outlined'}
              theme={activeType === type ? 'blue' : undefined}
              onPress={() => {
                setActiveType(type)
                setShowAddForm(false)
              }}
            >
              {TYPE_LABELS[type]}
            </Button>
          ))}
        </XStack>

        {error ? (
          <XStack backgroundColor="$red2" padding="$2" borderRadius="$2" gap="$2" alignItems="center">
            <Text fontSize="$3" color="$red10">{error}</Text>
            <Button size="$2" variant="outlined" onPress={() => setError(null)} marginLeft="auto">
              Dismiss
            </Button>
          </XStack>
        ) : null}

        {/* Add entry button */}
        {canEdit && !showAddForm ? (
          <Button size="$3" icon={Plus} theme="blue" onPress={() => setShowAddForm(true)} disabled={saving}>
            Add {TYPE_LABELS[activeType]} Entry
          </Button>
        ) : null}

        {/* Add form */}
        {showAddForm ? (
          <Card padding="$3" borderWidth={2} borderColor="$blue8" backgroundColor="$blue1">
            <YStack gap="$3">
              <Text fontSize="$4" fontWeight="600">New {TYPE_LABELS[activeType]} Entry</Text>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Date</Text>
                <Input
                  value={newDate}
                  onChangeText={setNewDate}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                />
              </YStack>
              {fields.map((field) => (
                <YStack key={field.key} gap="$1">
                  <Text fontSize="$3" fontWeight="600">{field.defaultLabel}</Text>
                  <Input
                    value={newData[field.key] || ''}
                    onChangeText={(v: string) => setNewData({ ...newData, [field.key]: v })}
                    placeholder={field.defaultLabel}
                  />
                </YStack>
              ))}
              <XStack gap="$2" justifyContent="flex-end">
                <Button icon={X} onPress={() => { setShowAddForm(false); setNewData({}) }} disabled={saving}>
                  Cancel
                </Button>
                <Button icon={saving ? undefined : Save} theme="blue" onPress={handleSave} disabled={saving || !newDate}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </XStack>
            </YStack>
          </Card>
        ) : null}

        {/* Schedule list */}
        {loading ? (
          <XStack justifyContent="center" padding="$4" gap="$2">
            <Spinner size="small" width={20} height={20} />
            <Text fontSize="$3" theme="alt2">Loading schedules...</Text>
          </XStack>
        ) : schedules.length === 0 ? (
          <Text fontSize="$3" theme="alt2" textAlign="center" padding="$3">
            No {TYPE_LABELS[activeType].toLowerCase()} entries found for the next 60 days.
          </Text>
        ) : (
          <YStack gap="$2">
            {schedules.map((entry, i) => {
              const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
              return (
                <Card key={`${entry.date}-${i}`} padding="$3" borderWidth={1} borderColor="$borderColor">
                  <YStack gap="$2">
                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize="$4" fontWeight="700">{dateStr}</Text>
                      {canEdit ? (
                        <Button
                          size="$2"
                          icon={Trash}
                          theme="red"
                          variant="outlined"
                          onPress={() => handleDelete(entry)}
                          disabled={saving}
                        />
                      ) : null}
                    </XStack>
                    <XStack flexWrap="wrap" gap="$2">
                      {fields.map((field) => {
                        const value = entry.data?.[field.key]
                        if (!value) return null
                        return (
                          <YStack key={field.key} minWidth={140} gap="$0.5">
                            <Text fontSize="$2" theme="alt2">{field.defaultLabel}</Text>
                            <Text fontSize="$3">{value}</Text>
                          </YStack>
                        )
                      })}
                    </XStack>
                  </YStack>
                </Card>
              )
            })}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}
