import { useState } from 'react'
import { YStack, XStack, Text, Input, Card, Separator, TextArea } from 'tamagui'
import { Button } from '../Button'
import { Save, X, Plus } from '@tamagui/lucide-icons'
import type { OrganizationType } from '@my/app/provider/dynamodb/types'

export interface OrganizationFormData {
  name: string
  type: OrganizationType
  description?: string
  country: string
  province: string
  city: string
  contactEmail?: string
  website?: string
  memberEcclesias: string[]
}

interface OrganizationFormProps {
  initialData?: OrganizationFormData
  isEdit?: boolean
  onSubmit: (data: OrganizationFormData) => Promise<boolean>
  onCancel: () => void
}

const ORG_TYPES: Array<{ value: OrganizationType; label: string }> = [
  { value: 'fraternal_gathering', label: 'Fraternal Gathering' },
  { value: 'bible_school', label: 'Bible School' },
  { value: 'charity', label: 'Charity' },
  { value: 'youth_group', label: 'Youth Group' },
  { value: 'other', label: 'Other' },
]

export function OrganizationForm({ initialData, isEdit = false, onSubmit, onCancel }: OrganizationFormProps) {
  const [name, setName] = useState(initialData?.name || '')
  const [type, setType] = useState<OrganizationType>(initialData?.type || 'other')
  const [description, setDescription] = useState(initialData?.description || '')
  const [country, setCountry] = useState(initialData?.country || '')
  const [province, setProvince] = useState(initialData?.province || '')
  const [city, setCity] = useState(initialData?.city || '')
  const [contactEmail, setContactEmail] = useState(initialData?.contactEmail || '')
  const [website, setWebsite] = useState(initialData?.website || '')
  const [memberEcclesias, setMemberEcclesias] = useState<string[]>(initialData?.memberEcclesias || [])
  const [newEcclesia, setNewEcclesia] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    if (!country.trim()) {
      setError('Country is required')
      return
    }
    if (!province.trim()) {
      setError('Province is required')
      return
    }
    if (!city.trim()) {
      setError('City is required')
      return
    }

    setSaving(true)
    try {
      const success = await onSubmit({
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        country: country.trim(),
        province: province.trim(),
        city: city.trim(),
        contactEmail: contactEmail.trim() || undefined,
        website: website.trim() || undefined,
        memberEcclesias,
      })
      if (!success) {
        setError('Failed to save organization. Please try again.')
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const addEcclesia = () => {
    const trimmed = newEcclesia.trim()
    if (trimmed && !memberEcclesias.includes(trimmed)) {
      setMemberEcclesias([...memberEcclesias, trimmed])
      setNewEcclesia('')
    }
  }

  const removeEcclesia = (ecclesiaName: string) => {
    setMemberEcclesias(memberEcclesias.filter((e) => e !== ecclesiaName))
  }

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$4">
        <Text fontSize="$6" fontWeight="600">
          {isEdit ? 'Edit Organization' : 'Create Organization'}
        </Text>

        {error ? (
          <Card padding="$3" backgroundColor="$red2" borderWidth={1} borderColor="$red8">
            <Text fontSize="$3" color="$red11">{error}</Text>
          </Card>
        ) : null}

        {/* Name */}
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600">Name *</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Organization name"
            disabled={isEdit}
            opacity={isEdit ? 0.6 : 1}
          />
          {isEdit ? (
            <Text fontSize="$2" color="$gray11">Name cannot be changed after creation</Text>
          ) : null}
        </YStack>

        {/* Type */}
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600">Type</Text>
          <XStack gap="$2" flexWrap="wrap">
            {ORG_TYPES.map((t) => {
              const isActive = type === t.value
              return (
                <Button
                  key={t.value}
                  size="$3"
                  theme={isActive ? 'blue' : undefined}
                  variant={isActive ? undefined : 'outlined'}
                  onPress={() => setType(t.value)}
                >
                  {t.label}
                </Button>
              )
            })}
          </XStack>
        </YStack>

        {/* Description */}
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600">Description</Text>
          <TextArea
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description of the organization..."
            numberOfLines={3}
          />
        </YStack>

        <Separator />

        {/* Location */}
        <Text fontSize="$4" fontWeight="600">Location</Text>
        <XStack gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={150}>
            <Text fontSize="$3" fontWeight="600">Country *</Text>
            <Input
              value={country}
              onChangeText={setCountry}
              placeholder="Country"
              disabled={isEdit}
              opacity={isEdit ? 0.6 : 1}
            />
          </YStack>
          <YStack gap="$1" flex={1} minWidth={150}>
            <Text fontSize="$3" fontWeight="600">Province *</Text>
            <Input
              value={province}
              onChangeText={setProvince}
              placeholder="Province / State"
              disabled={isEdit}
              opacity={isEdit ? 0.6 : 1}
            />
          </YStack>
          <YStack gap="$1" flex={1} minWidth={150}>
            <Text fontSize="$3" fontWeight="600">City *</Text>
            <Input
              value={city}
              onChangeText={setCity}
              placeholder="City"
              disabled={isEdit}
              opacity={isEdit ? 0.6 : 1}
            />
          </YStack>
        </XStack>

        <Separator />

        {/* Contact Info */}
        <Text fontSize="$4" fontWeight="600">Contact Information</Text>
        <XStack gap="$3" flexWrap="wrap">
          <YStack gap="$1" flex={1} minWidth={200}>
            <Text fontSize="$3" fontWeight="600">Contact Email</Text>
            <Input
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="contact@example.com"
              autoCapitalize="none"
            />
          </YStack>
          <YStack gap="$1" flex={1} minWidth={200}>
            <Text fontSize="$3" fontWeight="600">Website</Text>
            <Input
              value={website}
              onChangeText={setWebsite}
              placeholder="https://..."
              autoCapitalize="none"
            />
          </YStack>
        </XStack>

        <Separator />

        {/* Member Ecclesias */}
        <Text fontSize="$4" fontWeight="600">Member Ecclesias</Text>
        <XStack gap="$2" alignItems="center">
          <Input
            flex={1}
            value={newEcclesia}
            onChangeText={setNewEcclesia}
            placeholder="Add an ecclesia name..."
            onSubmitEditing={addEcclesia}
          />
          <Button size="$3" icon={Plus} theme="blue" onPress={addEcclesia} disabled={!newEcclesia.trim()}>
            Add
          </Button>
        </XStack>

        {memberEcclesias.length > 0 ? (
          <XStack gap="$2" flexWrap="wrap">
            {memberEcclesias.map((ecclesia) => (
              <Card
                key={ecclesia}
                paddingHorizontal="$3"
                paddingVertical="$2"
                backgroundColor="$blue3"
                borderRadius="$3"
              >
                <XStack gap="$2" alignItems="center">
                  <Text fontSize="$3" color="$blue11">{ecclesia}</Text>
                  <Button
                    size="$2"
                    circular
                    icon={<X size={12} />}
                    chromeless
                    onPress={() => removeEcclesia(ecclesia)}
                  />
                </XStack>
              </Card>
            ))}
          </XStack>
        ) : (
          <Text fontSize="$3" theme="alt2">No member ecclesias added yet.</Text>
        )}

        <Separator />

        {/* Actions */}
        <XStack gap="$3" justifyContent="flex-end">
          <Button icon={X} onPress={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            icon={saving ? undefined : Save}
            theme="blue"
            onPress={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Organization'}
          </Button>
        </XStack>
      </YStack>
    </Card>
  )
}
