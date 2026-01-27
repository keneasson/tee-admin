import React, { useState } from 'react'
import { YStack, XStack, Text, Button, Card, Input, Select, Spinner } from 'tamagui'
import { Plus, Trash2, Users, Heart, User } from '@tamagui/lucide-icons'
import type { RelationshipType } from '@my/app/provider/dynamodb/types'

interface FamilyMember {
  email: string
  name?: string
  relationshipType: RelationshipType
}

interface FamilyMembersProps {
  members: FamilyMember[]
  editable?: boolean
  onAdd?: (targetEmail: string, relationshipType: RelationshipType) => Promise<void>
  onRemove?: (targetEmail: string, relationshipType: RelationshipType) => Promise<void>
  onMemberClick?: (email: string) => void
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
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newType, setNewType] = useState<RelationshipType>('spouse')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!onAdd || !newEmail) return
    setLoading(true)
    try {
      await onAdd(newEmail, newType)
      setNewEmail('')
      setNewType('spouse')
      setIsAdding(false)
    } finally {
      setLoading(false)
    }
  }

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
          <YStack gap="$2">
            <Input
              placeholder="Email address of family member"
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Select
              value={newType}
              onValueChange={(val) => setNewType(val as RelationshipType)}
            >
              <Select.Trigger>
                <Select.Value placeholder="Relationship" />
              </Select.Trigger>
              <Select.Content>
                <Select.ScrollUpButton />
                <Select.Viewport>
                  {Object.entries(relationshipTypeLabels).map(([value, label]) => (
                    <Select.Item key={value} value={value} index={Object.keys(relationshipTypeLabels).indexOf(value)}>
                      <Select.ItemText>{label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
            <XStack gap="$2" justifyContent="flex-end">
              <Button
                size="$2"
                onPress={() => { setIsAdding(false); setNewEmail(''); setNewType('spouse') }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                size="$2"
                theme="blue"
                onPress={handleAdd}
                disabled={loading || !newEmail}
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

      {Object.entries(groupedMembers).map(([type, typeMembers]) => (
        <YStack key={type} gap="$2">
          <XStack gap="$2" alignItems="center">
            {relationshipTypeIcons[type as RelationshipType]}
            <Text fontSize="$3" fontWeight="600" theme="alt2">
              {relationshipTypeLabels[type as RelationshipType]}
              {typeMembers.length > 1 ? 's' : ''}
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
      ))}
    </YStack>
  )
}
