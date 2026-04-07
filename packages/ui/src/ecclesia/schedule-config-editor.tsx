import { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Switch, Select, Adapt, Sheet } from '@my/ui'
import { Button } from '../Button'
import { Settings, Save, X, Clock, MapPin } from '@tamagui/lucide-icons'
import type { ScheduleTypeKey, ServiceTimeDef, ServiceTimePeriod } from '@my/app/config/schedule-fields'
import { SCHEDULE_TYPE_KEYS, mergeWithCatalogue } from '@my/app/config/schedule-fields'

const MONTH_OPTIONS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
]

const DAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

interface FieldState {
  key: string
  label: string
  enabled: boolean
}

interface TypeState {
  enabled: boolean
  label: string
  fields: FieldState[]
  serviceTime: ServiceTimeDef
}

type ConfigState = Record<ScheduleTypeKey, TypeState>

interface ScheduleConfigEditorProps {
  /** Raw scheduleConfig from the ecclesia record */
  scheduleConfig?: Record<string, any>
  onSave: (config: ConfigState) => Promise<boolean>
}

/**
 * Admin editor for per-ecclesia schedule configuration.
 * Allows enabling/disabling schedule types (tabs), renaming tab labels,
 * and enabling/disabling + relabeling individual fields.
 */
export function ScheduleConfigEditor({ scheduleConfig, onSave }: ScheduleConfigEditorProps) {
  const [config, setConfig] = useState<ConfigState>(() => mergeWithCatalogue(scheduleConfig))
  const [expandedType, setExpandedType] = useState<ScheduleTypeKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const updateType = (typeKey: ScheduleTypeKey, updates: Partial<TypeState>) => {
    setConfig(prev => ({
      ...prev,
      [typeKey]: { ...prev[typeKey], ...updates },
    }))
    setDirty(true)
  }

  const updateField = (typeKey: ScheduleTypeKey, fieldKey: string, updates: Partial<FieldState>) => {
    setConfig(prev => ({
      ...prev,
      [typeKey]: {
        ...prev[typeKey],
        fields: prev[typeKey].fields.map(f =>
          f.key === fieldKey ? { ...f, ...updates } : f
        ),
      },
    }))
    setDirty(true)
  }

  const updateServiceTimeTop = (typeKey: ScheduleTypeKey, updates: Partial<Pick<ServiceTimeDef, 'timezone' | 'location'>>) => {
    setConfig(prev => ({
      ...prev,
      [typeKey]: {
        ...prev[typeKey],
        serviceTime: { ...prev[typeKey].serviceTime, ...updates },
      },
    }))
    setDirty(true)
  }

  const updateSchedulePeriod = (typeKey: ScheduleTypeKey, periodIndex: number, updates: Partial<ServiceTimePeriod>) => {
    setConfig(prev => {
      const newSchedule = [...prev[typeKey].serviceTime.schedule]
      newSchedule[periodIndex] = { ...newSchedule[periodIndex], ...updates }
      return {
        ...prev,
        [typeKey]: {
          ...prev[typeKey],
          serviceTime: { ...prev[typeKey].serviceTime, schedule: newSchedule },
        },
      }
    })
    setDirty(true)
  }

  const addSeasonalPeriod = (typeKey: ScheduleTypeKey) => {
    setConfig(prev => {
      const defaultPeriod = prev[typeKey].serviceTime.schedule[0]
      const newPeriod: ServiceTimePeriod = {
        label: 'Summer Hours',
        startMonth: 7,
        endMonth: 8,
        defaultTime: defaultPeriod?.defaultTime || '',
        displayTime: defaultPeriod?.displayTime || '',
        expectedDayOfWeek: defaultPeriod?.expectedDayOfWeek ?? 0,
      }
      return {
        ...prev,
        [typeKey]: {
          ...prev[typeKey],
          serviceTime: {
            ...prev[typeKey].serviceTime,
            schedule: [...prev[typeKey].serviceTime.schedule, newPeriod],
          },
        },
      }
    })
    setDirty(true)
  }

  const removeSeasonalPeriod = (typeKey: ScheduleTypeKey, periodIndex: number) => {
    if (periodIndex === 0) return // Can't remove default period
    setConfig(prev => {
      const newSchedule = prev[typeKey].serviceTime.schedule.filter((_: any, i: number) => i !== periodIndex)
      return {
        ...prev,
        [typeKey]: {
          ...prev[typeKey],
          serviceTime: { ...prev[typeKey].serviceTime, schedule: newSchedule },
        },
      }
    })
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const ok = await onSave(config)
      if (ok) setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setConfig(mergeWithCatalogue(scheduleConfig))
    setDirty(false)
  }

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Settings size={16} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Schedule Configuration</Text>
          </XStack>
          {dirty ? (
            <XStack gap="$2">
              <Button size="$2" icon={X} variant="outlined" onPress={handleReset} disabled={saving}>
                Reset
              </Button>
              <Button size="$2" icon={Save} theme="blue" onPress={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </XStack>
          ) : null}
        </XStack>

        <Text fontSize="$3" theme="alt2">
          Choose which schedule types to show and customize field names for your ecclesia.
        </Text>

        {SCHEDULE_TYPE_KEYS.map(typeKey => {
          const typeConfig = config[typeKey]
          const isExpanded = expandedType === typeKey
          const enabledFieldCount = typeConfig.fields.filter(f => f.enabled).length

          return (
            <Card
              key={typeKey}
              padding="$3"
              borderWidth={1}
              borderColor={typeConfig.enabled ? '$blue6' : '$borderColor'}
              backgroundColor={typeConfig.enabled ? '$blue1' : '$gray1'}
            >
              <YStack gap="$2">
                {/* Type toggle + label */}
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack gap="$3" alignItems="center" flex={1}>
                    <Switch
                      size="$2"
                      checked={typeConfig.enabled}
                      onCheckedChange={(checked: boolean) => updateType(typeKey, { enabled: checked })}
                    >
                      <Switch.Thumb animation="quick" />
                    </Switch>
                    <YStack flex={1}>
                      <Input
                        size="$3"
                        value={typeConfig.label}
                        onChangeText={(v: string) => updateType(typeKey, { label: v })}
                        fontWeight="600"
                        borderWidth={0}
                        backgroundColor="transparent"
                        paddingHorizontal="$1"
                        disabled={!typeConfig.enabled}
                      />
                    </YStack>
                  </XStack>
                  {typeConfig.enabled ? (
                    <Button
                      size="$2"
                      variant="outlined"
                      onPress={() => setExpandedType(isExpanded ? null : typeKey)}
                    >
                      {isExpanded ? 'Collapse' : `${enabledFieldCount} fields`}
                    </Button>
                  ) : null}
                </XStack>

                {/* Service time + field config (expanded) */}
                {isExpanded && typeConfig.enabled ? (
                  <YStack gap="$2" paddingTop="$2">
                    <Separator />

                    {/* Service Time Configuration */}
                    <Text fontSize="$2" theme="alt2" fontWeight="600">
                      <Clock size={12} /> Service Time & Location
                    </Text>

                    {/* Location (shared across all periods) */}
                    <XStack gap="$2" flexWrap="wrap">
                      <YStack gap="$1" flex={1} minWidth={150}>
                        <Text fontSize="$1" theme="alt2"><MapPin size={10} /> Location</Text>
                        <Input
                          size="$3"
                          value={typeConfig.serviceTime.location}
                          onChangeText={(v: string) => updateServiceTimeTop(typeKey, { location: v })}
                          placeholder="Main Hall"
                        />
                      </YStack>
                    </XStack>

                    {/* Schedule periods */}
                    {typeConfig.serviceTime.schedule.map((period: ServiceTimePeriod, periodIdx: number) => (
                      <Card key={periodIdx} padding="$2" borderWidth={1} borderColor="$borderColor" borderRadius="$2">
                        <YStack gap="$2">
                          <XStack justifyContent="space-between" alignItems="center">
                            <Text fontSize="$2" fontWeight="600">
                              {periodIdx === 0 ? 'Regular Hours' : (period.label || `Period ${periodIdx + 1}`)}
                            </Text>
                            {periodIdx > 0 ? (
                              <Button size="$2" chromeless icon={<X size={14} />} onPress={() => removeSeasonalPeriod(typeKey, periodIdx)} />
                            ) : null}
                          </XStack>

                          {/* Label + month range for seasonal periods */}
                          {periodIdx > 0 ? (
                            <XStack gap="$2" flexWrap="wrap">
                              <YStack gap="$1" minWidth={120}>
                                <Text fontSize="$1" theme="alt2">Label</Text>
                                <Input size="$3" value={period.label || ''} onChangeText={(v: string) => updateSchedulePeriod(typeKey, periodIdx, { label: v })} placeholder="Summer Hours" width={140} />
                              </YStack>
                              <YStack gap="$1" minWidth={100}>
                                <Text fontSize="$1" theme="alt2">From</Text>
                                <Select value={String(period.startMonth || 1)} onValueChange={(v: string) => updateSchedulePeriod(typeKey, periodIdx, { startMonth: parseInt(v, 10) })}>
                                  <Select.Trigger size="$3" width={120}><Select.Value /></Select.Trigger>
                                  <Adapt when="sm" platform="touch"><Sheet modal dismissOnSnapToBottom snapPointsMode="fit"><Sheet.Frame><Sheet.ScrollView><Adapt.Contents /></Sheet.ScrollView></Sheet.Frame><Sheet.Overlay /></Sheet></Adapt>
                                  <Select.Content><Select.Viewport>{MONTH_OPTIONS.map((m, i) => (<Select.Item key={m.value} value={m.value} index={i}><Select.ItemText>{m.label}</Select.ItemText></Select.Item>))}</Select.Viewport></Select.Content>
                                </Select>
                              </YStack>
                              <YStack gap="$1" minWidth={100}>
                                <Text fontSize="$1" theme="alt2">To</Text>
                                <Select value={String(period.endMonth || 12)} onValueChange={(v: string) => updateSchedulePeriod(typeKey, periodIdx, { endMonth: parseInt(v, 10) })}>
                                  <Select.Trigger size="$3" width={120}><Select.Value /></Select.Trigger>
                                  <Adapt when="sm" platform="touch"><Sheet modal dismissOnSnapToBottom snapPointsMode="fit"><Sheet.Frame><Sheet.ScrollView><Adapt.Contents /></Sheet.ScrollView></Sheet.Frame><Sheet.Overlay /></Sheet></Adapt>
                                  <Select.Content><Select.Viewport>{MONTH_OPTIONS.map((m, i) => (<Select.Item key={m.value} value={m.value} index={i}><Select.ItemText>{m.label}</Select.ItemText></Select.Item>))}</Select.Viewport></Select.Content>
                                </Select>
                              </YStack>
                            </XStack>
                          ) : null}

                          {/* Day + Time */}
                          <XStack gap="$2" flexWrap="wrap">
                            <YStack gap="$1" minWidth={120}>
                              <Text fontSize="$1" theme="alt2">Day</Text>
                              <Select
                                value={String(period.expectedDayOfWeek)}
                                onValueChange={(val: string) => updateSchedulePeriod(typeKey, periodIdx, { expectedDayOfWeek: parseInt(val, 10) })}
                              >
                                <Select.Trigger size="$3" width={140}><Select.Value /></Select.Trigger>
                                <Adapt when="sm" platform="touch"><Sheet modal dismissOnSnapToBottom snapPointsMode="fit"><Sheet.Frame><Sheet.ScrollView><Adapt.Contents /></Sheet.ScrollView></Sheet.Frame><Sheet.Overlay /></Sheet></Adapt>
                                <Select.Content><Select.Viewport>{DAY_OPTIONS.map((day, i) => (<Select.Item key={day.value} value={day.value} index={i}><Select.ItemText>{day.label}</Select.ItemText></Select.Item>))}</Select.Viewport></Select.Content>
                              </Select>
                            </YStack>
                            <YStack gap="$1" minWidth={120}>
                              <Text fontSize="$1" theme="alt2">Display Time</Text>
                              <Input size="$3" value={period.displayTime} onChangeText={(v: string) => updateSchedulePeriod(typeKey, periodIdx, { displayTime: v })} placeholder="11:00 AM" width={120} />
                            </YStack>
                          </XStack>
                        </YStack>
                      </Card>
                    ))}

                    <Button size="$2" variant="outlined" onPress={() => addSeasonalPeriod(typeKey)} alignSelf="flex-start">
                      + Add Seasonal Hours
                    </Button>

                    <Separator marginTop="$2" />

                    {/* Field Configuration */}
                    <Text fontSize="$2" theme="alt2" fontWeight="600">
                      Fields — toggle off fields you don't need, rename as needed
                    </Text>
                    {typeConfig.fields.map(field => (
                      <XStack key={field.key} gap="$2" alignItems="center">
                        <Switch
                          size="$2"
                          checked={field.enabled}
                          onCheckedChange={(checked: boolean) =>
                            updateField(typeKey, field.key, { enabled: checked })
                          }
                        >
                          <Switch.Thumb animation="quick" />
                        </Switch>
                        <Input
                          size="$3"
                          value={field.label}
                          onChangeText={(v: string) =>
                            updateField(typeKey, field.key, { label: v })
                          }
                          flex={1}
                          opacity={field.enabled ? 1 : 0.5}
                          disabled={!field.enabled}
                        />
                        <Text fontSize="$2" theme="alt2" width={100}>
                          {field.key}
                        </Text>
                      </XStack>
                    ))}
                  </YStack>
                ) : null}
              </YStack>
            </Card>
          )
        })}
      </YStack>
    </Card>
  )
}
