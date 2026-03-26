import { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Switch, Select, Adapt, Sheet } from '@my/ui'
import { Button } from '../Button'
import { Settings, Save, X, Clock, MapPin } from '@tamagui/lucide-icons'
import type { ScheduleTypeKey, ServiceTimeDef } from '@my/app/config/schedule-fields'
import { SCHEDULE_TYPE_KEYS, mergeWithCatalogue } from '@my/app/config/schedule-fields'

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

  const updateServiceTime = (typeKey: ScheduleTypeKey, updates: Partial<ServiceTimeDef>) => {
    setConfig(prev => ({
      ...prev,
      [typeKey]: {
        ...prev[typeKey],
        serviceTime: { ...prev[typeKey].serviceTime, ...updates },
      },
    }))
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
                    <XStack gap="$2" flexWrap="wrap">
                      <YStack gap="$1" minWidth={120}>
                        <Text fontSize="$1" theme="alt2">Day</Text>
                        <Select
                          value={String(typeConfig.serviceTime.expectedDayOfWeek)}
                          onValueChange={(val: string) =>
                            updateServiceTime(typeKey, { expectedDayOfWeek: parseInt(val, 10) })
                          }
                        >
                          <Select.Trigger size="$3" width={140}>
                            <Select.Value />
                          </Select.Trigger>
                          <Adapt when="sm" platform="touch">
                            <Sheet modal dismissOnSnapToBottom snapPointsMode="fit">
                              <Sheet.Frame>
                                <Sheet.ScrollView>
                                  <Adapt.Contents />
                                </Sheet.ScrollView>
                              </Sheet.Frame>
                              <Sheet.Overlay />
                            </Sheet>
                          </Adapt>
                          <Select.Content>
                            <Select.Viewport>
                              {DAY_OPTIONS.map((day, i) => (
                                <Select.Item key={day.value} value={day.value} index={i}>
                                  <Select.ItemText>{day.label}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select>
                      </YStack>
                      <YStack gap="$1" minWidth={120}>
                        <Text fontSize="$1" theme="alt2">Display Time</Text>
                        <Input
                          size="$3"
                          value={typeConfig.serviceTime.displayTime}
                          onChangeText={(v: string) => updateServiceTime(typeKey, { displayTime: v })}
                          placeholder="11:00 AM"
                          width={120}
                        />
                      </YStack>
                      <YStack gap="$1" flex={1} minWidth={150}>
                        <Text fontSize="$1" theme="alt2"><MapPin size={10} /> Location</Text>
                        <Input
                          size="$3"
                          value={typeConfig.serviceTime.location}
                          onChangeText={(v: string) => updateServiceTime(typeKey, { location: v })}
                          placeholder="Main Hall"
                        />
                      </YStack>
                    </XStack>

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
