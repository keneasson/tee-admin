import { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Separator, Spinner, Heading, TextArea } from 'tamagui'
import { Button } from '../Button'
import { Building2, MapPin, Mail, Globe, Pencil, Save, X, Plus, Trash2, Users } from '@tamagui/lucide-icons'
import { brandColors } from '../branding/brand-colors'
import type { OrganizationType } from '@my/app/provider/dynamodb/types'

export interface OrganizationDetailData {
  name: string
  type: OrganizationType
  description?: string
  country: string
  province: string
  city: string
  contactEmail?: string
  website?: string
  memberEcclesias: string[]
  externalLinks?: {
    newsletterUrl?: string
    youtube?: string
    facebook?: string
    otherLinks?: Array<{ label: string; url: string }>
  }
  logoUrl?: string
  timezone?: string
  latitude?: number
  longitude?: number
  createdAt: string
  lastUpdated: string
}

interface OrganizationDetailViewProps {
  organization: OrganizationDetailData
  canEdit: boolean
  canDelete: boolean
  onUpdate?: (updates: Partial<OrganizationDetailData>) => Promise<boolean>
  onDelete?: () => Promise<void>
  onBack?: () => void
}

const TYPE_LABELS: Record<OrganizationType, string> = {
  fraternal_gathering: 'Fraternal Gathering',
  bible_school: 'Bible School',
  charity: 'Charity',
  youth_group: 'Youth Group',
  other: 'Other',
}

const TYPE_COLORS: Record<OrganizationType, { bg: string; text: string }> = {
  fraternal_gathering: { bg: '$blue3', text: '$blue11' },
  bible_school: { bg: '$green3', text: '$green11' },
  charity: { bg: '$purple3', text: '$purple11' },
  youth_group: { bg: '$orange3', text: '$orange11' },
  other: { bg: '$gray3', text: '$gray11' },
}

const ORG_TYPES: Array<{ value: OrganizationType; label: string }> = [
  { value: 'fraternal_gathering', label: 'Fraternal Gathering' },
  { value: 'bible_school', label: 'Bible School' },
  { value: 'charity', label: 'Charity' },
  { value: 'youth_group', label: 'Youth Group' },
  { value: 'other', label: 'Other' },
]

export function OrganizationDetailView({
  organization,
  canEdit,
  canDelete,
  onUpdate,
  onDelete,
  onBack,
}: OrganizationDetailViewProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Edit state
  const [editType, setEditType] = useState<OrganizationType>(organization.type)
  const [editDescription, setEditDescription] = useState(organization.description || '')
  const [editContactEmail, setEditContactEmail] = useState(organization.contactEmail || '')
  const [editWebsite, setEditWebsite] = useState(organization.website || '')
  const [editMemberEcclesias, setEditMemberEcclesias] = useState<string[]>(organization.memberEcclesias || [])
  const [newEcclesia, setNewEcclesia] = useState('')

  const startEditing = () => {
    setEditType(organization.type)
    setEditDescription(organization.description || '')
    setEditContactEmail(organization.contactEmail || '')
    setEditWebsite(organization.website || '')
    setEditMemberEcclesias([...(organization.memberEcclesias || [])])
    setNewEcclesia('')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const saveEdits = async () => {
    if (!onUpdate) return
    setSaving(true)
    try {
      const success = await onUpdate({
        type: editType,
        description: editDescription.trim() || undefined,
        contactEmail: editContactEmail.trim() || undefined,
        website: editWebsite.trim() || undefined,
        memberEcclesias: editMemberEcclesias,
      })
      if (success) {
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const addEcclesia = () => {
    const trimmed = newEcclesia.trim()
    if (trimmed && !editMemberEcclesias.includes(trimmed)) {
      setEditMemberEcclesias([...editMemberEcclesias, trimmed])
      setNewEcclesia('')
    }
  }

  const removeEcclesia = (name: string) => {
    setEditMemberEcclesias(editMemberEcclesias.filter((e) => e !== name))
  }

  const locationParts = [organization.city, organization.province, organization.country].filter(Boolean)
  const typeColor = TYPE_COLORS[organization.type] || TYPE_COLORS.other

  return (
    <YStack gap="$4">
      {/* Header */}
      <Card padding="$4" backgroundColor="$backgroundHover">
        <YStack gap="$2">
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <XStack gap="$2" alignItems="center" flex={1}>
              <Building2 size={24} color="$blue10" />
              <Heading size="$7">{organization.name}</Heading>
            </XStack>
            <XStack gap="$2" alignItems="center">
              <Card
                paddingHorizontal="$2"
                paddingVertical="$1"
                backgroundColor={typeColor.bg}
                borderRadius="$2"
              >
                <Text fontSize="$2" fontWeight="600" color={typeColor.text}>
                  {TYPE_LABELS[organization.type] || 'Other'}
                </Text>
              </Card>
              {canEdit && !editing ? (
                <Button
                  size="$3"
                  icon={Pencil}
                  variant="outlined"
                  onPress={startEditing}
                >
                  Edit
                </Button>
              ) : null}
            </XStack>
          </XStack>
          {locationParts.length > 0 ? (
            <XStack gap="$1" alignItems="center">
              <MapPin size={14} color="$gray10" />
              <Text fontSize="$3" theme="alt2">{locationParts.join(', ')}</Text>
            </XStack>
          ) : null}
        </YStack>
      </Card>

      {/* Details Card */}
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <YStack gap="$3">
          <Text fontSize="$5" fontWeight="600">Details</Text>

          {editing ? (
            <YStack gap="$3">
              {/* Type */}
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Type</Text>
                <XStack gap="$2" flexWrap="wrap">
                  {ORG_TYPES.map((t) => {
                    const isActive = editType === t.value
                    return (
                      <Button
                        key={t.value}
                        size="$3"
                        theme={isActive ? 'blue' : undefined}
                        variant={isActive ? undefined : 'outlined'}
                        onPress={() => setEditType(t.value)}
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
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Brief description..."
                  numberOfLines={3}
                />
              </YStack>

              {/* Contact Email */}
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Contact Email</Text>
                <Input
                  value={editContactEmail}
                  onChangeText={setEditContactEmail}
                  placeholder="contact@example.com"
                  autoCapitalize="none"
                />
              </YStack>

              {/* Website */}
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Website</Text>
                <Input
                  value={editWebsite}
                  onChangeText={setEditWebsite}
                  placeholder="https://..."
                  autoCapitalize="none"
                />
              </YStack>

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
              {editMemberEcclesias.length > 0 ? (
                <XStack gap="$2" flexWrap="wrap">
                  {editMemberEcclesias.map((ecclesia) => (
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
                <Text fontSize="$3" theme="alt2">No member ecclesias added.</Text>
              )}

              <Separator />

              {/* Save/Cancel */}
              <XStack gap="$2" justifyContent="flex-end">
                <Button icon={X} onPress={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
                <Button icon={saving ? undefined : Save} theme="blue" onPress={saveEdits} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </XStack>
            </YStack>
          ) : (
            <YStack gap="$3">
              {/* Description */}
              {organization.description ? (
                <YStack gap="$1">
                  <Text fontSize="$3" fontWeight="600" theme="alt2">Description</Text>
                  <Text fontSize="$3">{organization.description}</Text>
                </YStack>
              ) : null}

              {/* Contact Info */}
              <XStack gap="$4" flexWrap="wrap">
                {organization.contactEmail ? (
                  <XStack gap="$1" alignItems="center">
                    <Mail size={14} color="$gray10" />
                    <Text fontSize="$3" theme="alt2">{organization.contactEmail}</Text>
                  </XStack>
                ) : null}
                {organization.website ? (
                  <XStack gap="$1" alignItems="center">
                    <Globe size={14} color="$gray10" />
                    <Text fontSize="$3" theme="alt2">{organization.website}</Text>
                  </XStack>
                ) : null}
              </XStack>

              {/* Member Ecclesias */}
              <YStack gap="$2">
                <XStack gap="$1" alignItems="center">
                  <Users size={16} color="$blue10" />
                  <Text fontSize="$4" fontWeight="600">
                    Member Ecclesias ({organization.memberEcclesias.length})
                  </Text>
                </XStack>
                {organization.memberEcclesias.length > 0 ? (
                  <XStack gap="$2" flexWrap="wrap">
                    {organization.memberEcclesias.map((ecclesia) => (
                      <Card
                        key={ecclesia}
                        paddingHorizontal="$3"
                        paddingVertical="$2"
                        backgroundColor="$blue3"
                        borderRadius="$3"
                      >
                        <Text fontSize="$3" color="$blue11">{ecclesia}</Text>
                      </Card>
                    ))}
                  </XStack>
                ) : (
                  <Text fontSize="$3" theme="alt2">No member ecclesias listed.</Text>
                )}
              </YStack>

              {/* Metadata */}
              <Separator />
              <XStack gap="$4" flexWrap="wrap">
                <Text fontSize="$2" theme="alt2">
                  Created: {new Date(organization.createdAt).toLocaleDateString()}
                </Text>
                <Text fontSize="$2" theme="alt2">
                  Last updated: {new Date(organization.lastUpdated).toLocaleDateString()}
                </Text>
              </XStack>
            </YStack>
          )}
        </YStack>
      </Card>

      {/* Danger Zone - Owner only */}
      {canDelete && onDelete && !editing ? (
        <Card padding="$4" borderWidth={1} borderColor="$red8">
          <YStack gap="$3">
            <Text fontSize="$5" fontWeight="600" color="$red10">Danger Zone</Text>
            <Text fontSize="$3" theme="alt2">
              Permanently delete this organization. This action cannot be undone.
            </Text>
            {confirmDelete ? (
              <XStack gap="$3" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$red10">
                  Are you sure?
                </Text>
                <Button
                  size="$3"
                  onPress={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  size="$3"
                  backgroundColor={brandColors.light.error}
                  color="white"
                  borderWidth={2}
                  borderColor={brandColors.light.error}
                  hoverStyle={{ backgroundColor: brandColors.light.error, opacity: 0.9 }}
                  onPress={handleDelete}
                  disabled={deleting}
                  icon={deleting ? <Spinner size="small" width={16} height={16} /> : Trash2}
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </XStack>
            ) : (
              <Button
                size="$3"
                alignSelf="flex-start"
                backgroundColor={brandColors.light.error}
                color="white"
                borderWidth={2}
                borderColor={brandColors.light.error}
                hoverStyle={{ backgroundColor: brandColors.light.error, opacity: 0.9 }}
                icon={Trash2}
                onPress={() => setConfirmDelete(true)}
              >
                Delete Organization
              </Button>
            )}
          </YStack>
        </Card>
      ) : null}
    </YStack>
  )
}
