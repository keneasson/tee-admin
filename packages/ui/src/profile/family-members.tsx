import React, { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Select, Spinner, Label } from 'tamagui'
import { Button } from '../Button'
import { Plus, Trash2, Users, Heart, User } from '@tamagui/lucide-icons'
import type { RelationshipType } from '@my/app/provider/dynamodb/types'

interface FamilyMember {
  email: string
  name?: string
  relationshipType: RelationshipType
  personId?: string
}

export interface AddFamilyMemberData {
  firstName: string
  lastName: string
  email?: string
  relationshipType: RelationshipType
}

interface FamilyMembersProps {
  members: FamilyMember[]
  editable?: boolean
  onAdd?: (data: AddFamilyMemberData) => Promise<void>
  onRemove?: (targetEmail: string, relationshipType: RelationshipType) => Promise<void>
  onMemberClick?: (email: string) => void
  onLookupEmail?: (email: string) => Promise<{ found: boolean; firstName?: string; lastName?: string } | null>
}

const relationshipTypeLabels: Record<RelationshipType, string> = {
  spouse: 'Spouse',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  grandparent: 'Grandparent',
  grandchild: 'Grandchild',
  extended_family: 'Extended Family',
  household_member: 'Household Member',
}

const relationshipTypePlurals: Record<RelationshipType, string> = {
  spouse: 'Spouses',
  parent: 'Parents',
  child: 'Children',
  sibling: 'Siblings',
  grandparent: 'Grandparents',
  grandchild: 'Grandchildren',
  extended_family: 'Extended Family',
  household_member: 'Household Members',
}

// Display order: spouse first, then children, then others
const relationshipDisplayOrder: RelationshipType[] = [
  'spouse', 'child', 'sibling', 'parent', 'grandchild', 'grandparent', 'extended_family', 'household_member',
]

const relationshipTypeIcons: Record<RelationshipType, React.ReactNode> = {
  spouse: <Heart size={16} />,
  parent: <User size={16} />,
  child: <User size={16} />,
  sibling: <Users size={16} />,
  grandparent: <User size={16} />,
  grandchild: <User size={16} />,
  extended_family: <Users size={16} />,
  household_member: <Users size={16} />,
}

export const FamilyMembers: React.FC<FamilyMembersProps> = ({
  members,
  editable = false,
  onAdd,
  onRemove,
  onMemberClick,
  onLookupEmail,
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newType, setNewType] = useState<RelationshipType | ''>('')
  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [personFound, setPersonFound] = useState<boolean | null>(null)
  const [showNameFields, setShowNameFields] = useState(false)

  // Check if spouse already exists
  const hasSpouse = members.some(m => m.relationshipType === 'spouse')

  // Filter available relationship types
  const availableRelationshipTypes = Object.entries(relationshipTypeLabels).filter(
    ([value]) => !(value === 'spouse' && hasSpouse)
  )

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setNewEmail('')
    setNewType('')
    setIsAdding(false)
    setPersonFound(null)
    setShowNameFields(false)
  }

  const handleEmailBlur = async () => {
    if (!newEmail || !newEmail.includes('@') || !onLookupEmail) {
      // No valid email, show name fields for manual entry
      if (newEmail && !newEmail.includes('@')) return // Invalid email, wait for correction
      setShowNameFields(true)
      setPersonFound(null)
      return
    }

    setLookingUp(true)
    try {
      const result = await onLookupEmail(newEmail)
      if (result?.found) {
        setFirstName(result.firstName || '')
        setLastName(result.lastName || '')
        setPersonFound(true)
        setShowNameFields(false)
      } else {
        setPersonFound(false)
        setShowNameFields(true)
      }
    } catch {
      setPersonFound(false)
      setShowNameFields(true)
    } finally {
      setLookingUp(false)
    }
  }

  const handleSkipEmail = () => {
    setShowNameFields(true)
    setPersonFound(null)
  }

  const handleAdd = async () => {
    if (!onAdd || !firstName || !newType) return
    setLoading(true)
    try {
      await onAdd({
        firstName,
        lastName,
        email: newEmail || undefined,
        relationshipType: newType,
      })
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = firstName && newType && !loading

  const handleRemove = async (email: string, type: RelationshipType) => {
    if (!onRemove) return
    setLoading(true)
    try {
      await onRemove(email, type)
    } finally {
      setLoading(false)
    }
  }

  // Group members by relationship type
  const groupedMembers = members.reduce((acc, member) => {
    const type = member.relationshipType
    if (!acc[type]) acc[type] = []
    acc[type].push(member)
    return acc
  }, {} as Record<RelationshipType, FamilyMember[]>)

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$5" fontWeight="600">Family Members</Text>
        {editable && !isAdding ? (
          <Button size="$2" icon={Plus} onPress={() => setIsAdding(true)}>
            Add
          </Button>
        ) : null}
      </XStack>

      {isAdding ? (
        <Card padding="$3" backgroundColor="$background">
          <YStack gap="$3">
            {/* Step 1: Email lookup */}
            <YStack gap="$1">
              <Label htmlFor="email" fontSize="$2">Email Address</Label>
              <XStack gap="$2" alignItems="center">
                <Input
                  id="email"
                  flex={1}
                  placeholder="Enter email to find existing member"
                  value={newEmail}
                  onChangeText={(text: string) => {
                    setNewEmail(text)
                    setPersonFound(null)
                    if (!text) setShowNameFields(false)
                  }}
                  onBlur={handleEmailBlur}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  disabled={lookingUp}
                />
                {lookingUp ? <Spinner size="small" /> : null}
              </XStack>
              {personFound === true ? (
                <Text fontSize="$2" color="$green10">
                  Found: {firstName} {lastName}
                </Text>
              ) : null}
              {personFound === false ? (
                <Text fontSize="$2" color="$orange10">
                  Not found - enter name below to create new record
                </Text>
              ) : null}
              {!showNameFields && !personFound ? (
                <Button
                  size="$2"
                  marginTop="$2"
                  onPress={handleSkipEmail}
                >
                  Add without email (child/newborn)
                </Button>
              ) : null}
            </YStack>

            {/* Step 2: Name fields (shown if email not found or skipped) */}
            {showNameFields || personFound === false ? (
              <XStack gap="$2">
                <YStack flex={1} gap="$1">
                  <Label htmlFor="firstName" fontSize="$2">First Name *</Label>
                  <Input
                    id="firstName"
                    placeholder="First name"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </YStack>
                <YStack flex={1} gap="$1">
                  <Label htmlFor="lastName" fontSize="$2">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Last name"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </YStack>
              </XStack>
            ) : null}

            {/* Step 3: Relationship type (shown once we have a name) */}
            {(firstName || personFound) ? (
              <YStack gap="$1">
                <Label fontSize="$2">Relationship *</Label>
                <Select
                  value={newType}
                  onValueChange={(val) => setNewType(val as RelationshipType)}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select relationship..." />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      {availableRelationshipTypes.map(([value, label], index) => (
                        <Select.Item key={value} value={value} index={index}>
                          <Select.ItemText>{label}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>
                {hasSpouse ? (
                  <Text fontSize="$1" theme="alt2">
                    Spouse already added
                  </Text>
                ) : null}
              </YStack>
            ) : null}

            {/* Actions */}
            <XStack gap="$2" justifyContent="flex-end">
              <Button
                size="$2"
                onPress={resetForm}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="$2"
                theme="blue"
                onPress={handleAdd}
                disabled={!canSubmit}
                icon={loading ? <Spinner /> : undefined}
              >
                Add Family Member
              </Button>
            </XStack>
          </YStack>
        </Card>
      ) : null}

      {members.length === 0 && !isAdding ? (
        <Text fontSize="$3" theme="alt2">No family members added yet.</Text>
      ) : null}

      {relationshipDisplayOrder
        .filter((type) => groupedMembers[type]?.length > 0)
        .map((type) => {
          const typeMembers = groupedMembers[type]
          return (
        <YStack key={type} gap="$2">
          <XStack gap="$2" alignItems="center">
            {relationshipTypeIcons[type]}
            <Text fontSize="$3" fontWeight="600" theme="alt2">
              {typeMembers.length > 1 ? relationshipTypePlurals[type] : relationshipTypeLabels[type]}
            </Text>
          </XStack>
          {typeMembers.map((member) => (
            <Card
              key={`${member.email}-${member.relationshipType}`}
              padding="$3"
              backgroundColor="$backgroundHover"
              pressStyle={onMemberClick ? { opacity: 0.8 } : undefined}
              onPress={onMemberClick ? () => onMemberClick(member.email) : undefined}
              cursor={onMemberClick ? 'pointer' : undefined}
            >
              <XStack justifyContent="space-between" alignItems="center">
                <YStack>
                  <Text fontSize="$4" fontWeight="500">
                    {member.name || member.email}
                  </Text>
                  {member.name ? (
                    <Text fontSize="$2" theme="alt2">{member.email}</Text>
                  ) : null}
                </YStack>
                {editable ? (
                  <Button
                    size="$2"
                    circular
                    icon={Trash2}
                    theme="red"
                    onPress={() => {
                      handleRemove(member.email, member.relationshipType)
                    }}
                  />
                ) : null}
              </XStack>
            </Card>
          ))}
        </YStack>
          )
        })}
    </YStack>
  )
}
