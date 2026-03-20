import { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Switch } from '@my/ui'
import { Button } from '../Button'
import { Settings, Save, X } from '@tamagui/lucide-icons'
import type { ScheduleTypeKey } from '@my/app/config/schedule-fields'
import { SCHEDULE_TYPE_KEYS, mergeWithCatalogue } from '@my/app/config/schedule-fields'

interface FieldState {
  key: string
  label: string
  enabled: boolean
}

interface TypeState {
  enabled: boolean
  label: string
  fields: FieldState[]
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

                {/* Field config (expanded) */}
                {isExpanded && typeConfig.enabled ? (
                  <YStack gap="$2" paddingTop="$2">
                    <Separator />
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
