import React, { useState } from 'react'
import { YStack, XStack, Text, Button, Card, Select, Spinner, Separator } from 'tamagui'
import { Shield, Eye, EyeOff, Phone, Mail, MapPin, Users, Save } from '@tamagui/lucide-icons'
import type { VisibilityLevel } from '@my/app/provider/dynamodb/types'

// Custom Toggle with text labels for WCAG compliance and clear state indication
interface LabeledToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

const LabeledToggle: React.FC<LabeledToggleProps> = ({ checked, onCheckedChange }) => {
  return (
    <XStack
      alignItems="center"
      justifyContent="center"
      backgroundColor={checked ? '$primary' : '$backgroundTertiary'}
      borderRadius={20}
      borderWidth={2}
      borderColor={checked ? '$primary' : '$borderColor'}
      width={72}
      height={36}
      pressStyle={{ opacity: 0.8 }}
      cursor="pointer"
      onPress={() => onCheckedChange(!checked)}
      aria-checked={checked}
      role="switch"
    >
      {/* OFF label - visible when unchecked */}
      <Text
        fontSize={11}
        fontWeight="600"
        color={checked ? 'transparent' : '$color'}
        position="absolute"
        right={10}
        opacity={checked ? 0 : 0.7}
      >
        OFF
      </Text>

      {/* ON label - visible when checked */}
      <Text
        fontSize={11}
        fontWeight="600"
        color={checked ? 'white' : 'transparent'}
        position="absolute"
        left={10}
        opacity={checked ? 1 : 0}
      >
        ON
      </Text>

      {/* Thumb */}
      <XStack
        position="absolute"
        left={checked ? 40 : 4}
        width={28}
        height={28}
        borderRadius={14}
        backgroundColor="white"
        shadowColor="#000"
        shadowOffset={{ width: 0, height: 2 }}
        shadowOpacity={0.25}
        shadowRadius={3}
        animation="quick"
        alignItems="center"
        justifyContent="center"
      />
    </XStack>
  )
}

interface PrivacySettingsData {
  showName: VisibilityLevel
  showPhone: VisibilityLevel
  showAddress: VisibilityLevel
  showEmail: VisibilityLevel
  showFamily: VisibilityLevel
  allowContactRequests: boolean
  preferredContactMethod: 'email' | 'phone' | 'either'
}

interface PrivacySettingsProps {
  settings: PrivacySettingsData
  editable?: boolean
  onSave?: (settings: Partial<PrivacySettingsData>) => Promise<void>
}

const visibilityLabels: Record<VisibilityLevel, string> = {
  authenticated: 'Anyone logged in',
  ecclesia_and_connections: 'My ecclesia + connections',
  connections_only: 'Only my connections',
  private: 'Private (hidden)',
}

const visibilityDescriptions: Record<VisibilityLevel, string> = {
  authenticated: 'Visible to all authenticated members',
  ecclesia_and_connections: 'Visible to members of your ecclesia and people you connect with',
  connections_only: 'Only visible to people you explicitly connect with',
  private: 'Hidden from everyone - they can only request contact',
}

const contactMethodLabels: Record<'email' | 'phone' | 'either', string> = {
  email: 'Email',
  phone: 'Phone',
  either: 'Either',
}

type FieldKey = 'showName' | 'showPhone' | 'showAddress' | 'showEmail' | 'showFamily'

const fieldLabels: Record<FieldKey, { label: string; icon: React.ReactNode }> = {
  showName: { label: 'Name & Ecclesia', icon: <Eye size={16} /> },
  showPhone: { label: 'Phone Numbers', icon: <Phone size={16} /> },
  showAddress: { label: 'Addresses', icon: <MapPin size={16} /> },
  showEmail: { label: 'Email Address', icon: <Mail size={16} /> },
  showFamily: { label: 'Family Members', icon: <Users size={16} /> },
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  settings,
  editable = false,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = useState(settings)
  const [hasChanges, setHasChanges] = useState(false)
  const [loading, setLoading] = useState(false)

  const updateSetting = <K extends keyof PrivacySettingsData>(
    key: K,
    value: PrivacySettingsData[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!onSave) return
    setLoading(true)
    try {
      await onSave(localSettings)
      setHasChanges(false)
    } finally {
      setLoading(false)
    }
  }

  const renderVisibilitySelect = (field: FieldKey) => (
    <Card padding="$3" backgroundColor="$backgroundHover">
      <YStack gap="$2">
        <XStack gap="$2" alignItems="center">
          {fieldLabels[field].icon}
          <Text fontSize="$4" fontWeight="500">{fieldLabels[field].label}</Text>
        </XStack>
        {editable ? (
          <Select
            value={localSettings[field]}
            onValueChange={(val) => updateSetting(field, val as VisibilityLevel)}
          >
            <Select.Trigger>
              <Select.Value placeholder="Select visibility" />
            </Select.Trigger>
            <Select.Content>
              <Select.ScrollUpButton />
              <Select.Viewport>
                {Object.entries(visibilityLabels).map(([value, label]) => (
                  <Select.Item key={value} value={value} index={Object.keys(visibilityLabels).indexOf(value)}>
                    <Select.ItemText>{label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
        ) : (
          <XStack gap="$2" alignItems="center">
            {localSettings[field] === 'private' ? <EyeOff size={14} /> : <Eye size={14} />}
            <Text fontSize="$3" theme="alt2">{visibilityLabels[localSettings[field]]}</Text>
          </XStack>
        )}
        <Text fontSize="$2" theme="alt2">
          {visibilityDescriptions[localSettings[field]]}
        </Text>
      </YStack>
    </Card>
  )

  return (
    <YStack gap="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Shield size={20} />
          <Text fontSize="$5" fontWeight="600">Privacy Settings</Text>
        </XStack>
        {editable && hasChanges ? (
          <Button
            size="$2"
            theme="blue"
            onPress={handleSave}
            disabled={loading}
            icon={loading ? <Spinner /> : Save}
          >
            Save Changes
          </Button>
        ) : null}
      </XStack>

      <Text fontSize="$3" theme="alt2">
        Control who can see your contact information. You can set different visibility levels for each type of information.
      </Text>

      {/* Visibility Settings */}
      <YStack gap="$2">
        {(Object.keys(fieldLabels) as FieldKey[]).map((field) => (
          <React.Fragment key={field}>
            {renderVisibilitySelect(field)}
          </React.Fragment>
        ))}
      </YStack>

      <Separator />

      {/* Contact Request Settings */}
      <YStack gap="$3">
        <Text fontSize="$4" fontWeight="600">Contact Requests</Text>

        <Card padding="$3" backgroundColor="$backgroundHover">
          <XStack justifyContent="space-between" alignItems="center">
            <YStack flex={1}>
              <Text fontSize="$4" fontWeight="500">Allow Contact Requests</Text>
              <Text fontSize="$2" theme="alt2">
                Let others request you to call or email them back
              </Text>
            </YStack>
            {editable ? (
              <LabeledToggle
                checked={localSettings.allowContactRequests}
                onCheckedChange={(val) => updateSetting('allowContactRequests', val)}
              />
            ) : (
              <Text fontSize="$3" theme="alt2">
                {localSettings.allowContactRequests ? 'Enabled' : 'Disabled'}
              </Text>
            )}
          </XStack>
        </Card>

        <Card padding="$3" backgroundColor="$backgroundHover">
          <YStack gap="$2">
            <Text fontSize="$4" fontWeight="500">Preferred Contact Method</Text>
            <Text fontSize="$2" theme="alt2">
              How would you prefer people to reach you?
            </Text>
            {editable ? (
              <Select
                value={localSettings.preferredContactMethod}
                onValueChange={(val) => updateSetting('preferredContactMethod', val as 'email' | 'phone' | 'either')}
              >
                <Select.Trigger>
                  <Select.Value placeholder="Select method" />
                </Select.Trigger>
                <Select.Content>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    {Object.entries(contactMethodLabels).map(([value, label]) => (
                      <Select.Item key={value} value={value} index={Object.keys(contactMethodLabels).indexOf(value)}>
                        <Select.ItemText>{label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
            ) : (
              <Text fontSize="$3" theme="alt2">
                {contactMethodLabels[localSettings.preferredContactMethod]}
              </Text>
            )}
          </YStack>
        </Card>
      </YStack>
    </YStack>
  )
}
