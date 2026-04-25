import { useState } from 'react'
import { YStack, XStack, Text, Card, Button, Input, Separator, Select, Adapt, Sheet } from '@my/ui'
import { Globe, Shield, ShieldOff, Save, X, Pencil, MapPin, Ban } from '@tamagui/lucide-icons'
import { SHARING_RADIUS_OPTIONS, DEFAULT_SHARING_RADIUS_KM } from '@my/app/utils/geo'

interface SharingSettingsCardProps {
  sharingPreference?: 'open' | 'subscribers-only' | 'private'
  sharingRadiusKm?: number
  excludedEcclesias?: string[]
  canEdit: boolean
  onSave?: (updates: {
    sharingPreference?: 'open' | 'subscribers-only' | 'private'
    sharingRadiusKm?: number
    excludedEcclesias?: string[]
  }) => Promise<boolean>
}

const PREFERENCE_OPTIONS = [
  { value: 'open', label: 'Open — share events with nearby ecclesias' },
  { value: 'subscribers-only', label: 'Subscribers Only — only ecclesias that subscribe' },
  { value: 'private', label: 'Private — don\'t share events outside own ecclesia' },
] as const

const RADIUS_DISPLAY: Record<number, string> = {
  100: '100 km',
  200: '200 km',
  300: '300 km (default)',
  400: '400 km',
  500: '500 km',
  600: '600 km',
  700: '700 km',
  800: '800 km',
  900: '900 km',
  1000: '1000 km (max)',
}

export function SharingSettingsCard({
  sharingPreference = 'open',
  sharingRadiusKm,
  excludedEcclesias = [],
  canEdit,
  onSave,
}: SharingSettingsCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [editPreference, setEditPreference] = useState(sharingPreference)
  const [editRadius, setEditRadius] = useState(sharingRadiusKm || DEFAULT_SHARING_RADIUS_KM)
  const [editExcluded, setEditExcluded] = useState<string[]>(excludedEcclesias)
  const [newExclusion, setNewExclusion] = useState('')

  const startEditing = () => {
    setEditPreference(sharingPreference)
    setEditRadius(sharingRadiusKm || DEFAULT_SHARING_RADIUS_KM)
    setEditExcluded([...excludedEcclesias])
    setNewExclusion('')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      const success = await onSave({
        sharingPreference: editPreference,
        sharingRadiusKm: editRadius,
        excludedEcclesias: editExcluded,
      })
      if (success) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const addExclusion = () => {
    const name = newExclusion.trim()
    if (name && !editExcluded.includes(name)) {
      setEditExcluded([...editExcluded, name])
      setNewExclusion('')
    }
  }

  const removeExclusion = (name: string) => {
    setEditExcluded(editExcluded.filter((e) => e !== name))
  }

  const currentRadius = sharingRadiusKm || DEFAULT_SHARING_RADIUS_KM
  const preferenceLabel = PREFERENCE_OPTIONS.find((p) => p.value === sharingPreference)?.label || sharingPreference

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Globe size={20} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Event Sharing Settings</Text>
          </XStack>
          {canEdit && !editing ? (
            <Button size="$3" icon={Pencil} variant="outlined" onPress={startEditing}>
              Edit
            </Button>
          ) : null}
        </XStack>

        {editing ? (
          <YStack gap="$4">
            {/* Sharing Preference */}
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Sharing Preference</Text>
              <Select
                value={editPreference}
                onValueChange={(val) => setEditPreference(val as 'open' | 'subscribers-only' | 'private')}
              >
                <Select.Trigger>
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
                    {PREFERENCE_OPTIONS.map((opt, i) => (
                      <Select.Item key={opt.value} index={i} value={opt.value}>
                        <Select.ItemText>{opt.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select>
            </YStack>

            {/* Sharing Radius */}
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Sharing Radius</Text>
              <Text fontSize="$2" theme="alt2">
                Events from ecclesias within this distance will appear in your feed
              </Text>
              <Select
                value={String(editRadius)}
                onValueChange={(val) => setEditRadius(Number(val))}
              >
                <Select.Trigger>
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
                    {SHARING_RADIUS_OPTIONS.map((km, i) => (
                      <Select.Item key={km} index={i} value={String(km)}>
                        <Select.ItemText>{RADIUS_DISPLAY[km] || `${km} km`}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select>
            </YStack>

            {/* Excluded Ecclesias */}
            <YStack gap="$2">
              <Text fontSize="$3" fontWeight="600">Excluded Ecclesias</Text>
              <Text fontSize="$2" theme="alt2">
                Block specific ecclesias from sharing events with you
              </Text>
              <XStack gap="$2">
                <Input
                  flex={1}
                  value={newExclusion}
                  onChangeText={setNewExclusion}
                  placeholder="Ecclesia name to exclude"
                  onSubmitEditing={addExclusion}
                />
                <Button size="$3" onPress={addExclusion} disabled={!newExclusion.trim()}>
                  Add
                </Button>
              </XStack>
              {editExcluded.length > 0 ? (
                <YStack gap="$1">
                  {editExcluded.map((name) => (
                    <XStack key={name} gap="$2" alignItems="center" padding="$2" backgroundColor="$gray2" borderRadius="$2">
                      <Ban size={14} color="$red10" />
                      <Text flex={1} fontSize="$3">{name}</Text>
                      <Button size="$2" theme="red" variant="outlined" onPress={() => removeExclusion(name)}>
                        Remove
                      </Button>
                    </XStack>
                  ))}
                </YStack>
              ) : null}
            </YStack>

            <XStack gap="$2" justifyContent="flex-end">
              <Button icon={X} onPress={cancelEditing} disabled={saving}>
                Cancel
              </Button>
              <Button icon={saving ? undefined : Save} theme="blue" onPress={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center">
              {sharingPreference === 'private' ? (
                <ShieldOff size={16} color="$red10" />
              ) : sharingPreference === 'subscribers-only' ? (
                <Shield size={16} color="$orange10" />
              ) : (
                <Globe size={16} color="$green10" />
              )}
              <Text fontSize="$3">{preferenceLabel}</Text>
            </XStack>

            <XStack gap="$2" alignItems="center">
              <MapPin size={16} color="$blue10" />
              <Text fontSize="$3">Sharing radius: {currentRadius} km</Text>
            </XStack>

            {excludedEcclesias.length > 0 ? (
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600" theme="alt2">
                  Excluded ({excludedEcclesias.length}):
                </Text>
                {excludedEcclesias.map((name) => (
                  <XStack key={name} gap="$2" alignItems="center" paddingLeft="$4">
                    <Ban size={12} color="$red10" />
                    <Text fontSize="$3" theme="alt2">{name}</Text>
                  </XStack>
                ))}
              </YStack>
            ) : null}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}
