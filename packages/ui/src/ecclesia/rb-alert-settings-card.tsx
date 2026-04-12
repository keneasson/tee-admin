import { useState } from 'react'
import { YStack, XStack, Text, Card, Button, Separator, Spinner } from '@my/ui'
import { Bell, BellRing, BellOff, Save, X, Pencil } from '@tamagui/lucide-icons'

export type RbAlertPreference = 'all' | 'major' | 'none'

interface RbAlertSettingsCardProps {
  rbAlertPreference?: RbAlertPreference
  canEdit: boolean
  onSave: (pref: RbAlertPreference) => Promise<void>
}

interface OptionDef {
  value: RbAlertPreference
  label: string
  description: string
  Icon: typeof Bell
  iconColor: string
}

const OPTIONS: OptionDef[] = [
  {
    value: 'all',
    label: 'All shared events',
    description:
      'Receive notifications for every event shared with this ecclesia.',
    Icon: Bell,
    iconColor: '$green10',
  },
  {
    value: 'major',
    label: 'Major events only',
    description:
      'Only notify for baptisms, funerals, weddings, engagements, and study weekends.',
    Icon: BellRing,
    iconColor: '$orange10',
  },
  {
    value: 'none',
    label: 'No alerts',
    description:
      'Do not send any notifications for shared events from other ecclesias.',
    Icon: BellOff,
    iconColor: '$red10',
  },
]

function getOption(pref: RbAlertPreference | undefined): OptionDef | null {
  if (!pref) return null
  return OPTIONS.find((o) => o.value === pref) || null
}

export function RbAlertSettingsCard({
  rbAlertPreference,
  canEdit,
  onSave,
}: RbAlertSettingsCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<RbAlertPreference>(
    rbAlertPreference || 'all'
  )

  const startEditing = () => {
    setSelected(rbAlertPreference || 'all')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(selected)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const currentOption = getOption(rbAlertPreference)
  const CurrentIcon = currentOption ? currentOption.Icon : Bell

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Bell size={20} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">
              Recording Brother Alert Preferences
            </Text>
          </XStack>
          {canEdit && !editing ? (
            <Button size="$3" icon={Pencil} variant="outlined" onPress={startEditing}>
              Edit
            </Button>
          ) : null}
        </XStack>

        <Text fontSize="$2" theme="alt2">
          Controls how many shared-event notifications the Recording Brother receives
          from other ecclesias.
        </Text>

        {editing ? (
          <YStack gap="$3">
            <Separator />
            <YStack gap="$2">
              {OPTIONS.map((opt) => {
                const isSelected = selected === opt.value
                const Icon = opt.Icon
                return (
                  <XStack
                    key={opt.value}
                    gap="$3"
                    alignItems="flex-start"
                    padding="$3"
                    borderWidth={2}
                    borderRadius="$3"
                    borderColor={isSelected ? '$primary' : '$borderColor'}
                    backgroundColor={isSelected ? '$backgroundHover' : '$background'}
                    cursor={saving ? 'not-allowed' : 'pointer'}
                    opacity={saving ? 0.6 : 1}
                    hoverStyle={{
                      backgroundColor: '$backgroundHover',
                      borderColor: isSelected ? '$primary' : '$borderColorHover',
                    }}
                    onPress={() => {
                      if (!saving) setSelected(opt.value)
                    }}
                  >
                    <Icon size={20} color={opt.iconColor} />
                    <YStack flex={1} gap="$1">
                      <Text fontSize="$4" fontWeight="600">
                        {opt.label}
                      </Text>
                      <Text fontSize="$2" theme="alt2">
                        {opt.description}
                      </Text>
                    </YStack>
                  </XStack>
                )
              })}
            </YStack>

            <XStack gap="$2" justifyContent="flex-end">
              <Button icon={X} onPress={cancelEditing} disabled={saving}>
                Cancel
              </Button>
              <Button
                icon={
                  saving ? <Spinner size="small" width={20} height={20} /> : Save
                }
                theme="blue"
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <YStack gap="$2">
            {currentOption ? (
              <XStack gap="$2" alignItems="flex-start">
                <CurrentIcon size={18} color={currentOption.iconColor} />
                <YStack flex={1} gap="$1">
                  <Text fontSize="$4" fontWeight="600">
                    {currentOption.label}
                  </Text>
                  <Text fontSize="$2" theme="alt2">
                    {currentOption.description}
                  </Text>
                </YStack>
              </XStack>
            ) : (
              <XStack gap="$2" alignItems="flex-start">
                <Bell size={18} color="$gray10" />
                <YStack flex={1} gap="$1">
                  <Text fontSize="$4" fontWeight="600">
                    Not configured
                  </Text>
                  <Text fontSize="$2" theme="alt2">
                    Defaulting to all shared events. Edit to choose a preference.
                  </Text>
                </YStack>
              </XStack>
            )}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}
