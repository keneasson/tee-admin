import React, { useState, useRef, useMemo, useCallback } from 'react'
import { YStack, XStack, Text, Card, Input, Select, Spinner, Label } from 'tamagui'
import { Button } from '../Button'
import { Plus, Trash2, Users, Heart, User, Search, X, UserPlus, Link2, Link2Off } from '@tamagui/lucide-icons'
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

interface PersonSearchResult {
  id: string
  name: string
  email: string
  ecclesia?: string
}

interface FamilyMembersProps {
  members: FamilyMember[]
  editable?: boolean
  onAdd?: (data: AddFamilyMemberData) => Promise<void>
  onRemove?: (targetEmail: string, relationshipType: RelationshipType) => Promise<void>
  onMemberClick?: (email: string) => void
  onSearchPeople?: (query: string) => Promise<PersonSearchResult[]>
  /** @deprecated Use onSearchPeople instead */
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
  onSearchPeople,
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selectedEmail, setSelectedEmail] = useState('')
  const [newType, setNewType] = useState<RelationshipType | ''>('')
  const [loading, setLoading] = useState(false)
  const [manualEntry, setManualEntry] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<PersonSearchResult | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Check if spouse already exists
  const hasSpouse = members.some(m => m.relationshipType === 'spouse')

  // Filter available relationship types
  const availableRelationshipTypes = Object.entries(relationshipTypeLabels).filter(
    ([value]) => !(value === 'spouse' && hasSpouse)
  )

  // Existing family member emails to exclude from search results
  const existingEmails = useMemo(() => new Set(members.map(m => m.email.toLowerCase())), [members])

  const resetForm = () => {
    setFirstName('')
    setLastName('')
    setSelectedEmail('')
    setNewType('')
    setIsAdding(false)
    setManualEntry(false)
    setSelectedPerson(null)
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    setSelectedPerson(null)

    if (!query || query.length < 2 || !onSearchPeople) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    // Debounce search
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await onSearchPeople(query)
        // Filter out people already in family list
        const filtered = results.filter(r => !existingEmails.has(r.email.toLowerCase()))
        setSearchResults(filtered)
        setShowDropdown(true)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [onSearchPeople, existingEmails])

  const handleSelectPerson = (person: PersonSearchResult) => {
    setSelectedPerson(person)
    setSearchQuery(person.name)
    const nameParts = person.name.split(' ')
    setFirstName(nameParts[0] || '')
    setLastName(nameParts.slice(1).join(' ') || '')
    setSelectedEmail(person.email)
    setShowDropdown(false)
  }

  const handleSearchBlur = () => {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowDropdown(false)
      }
    }, 200)
  }

  const handleAdd = async () => {
    if (!onAdd || !firstName || !newType) return
    setLoading(true)
    try {
      await onAdd({
        firstName,
        lastName,
        email: selectedEmail || undefined,
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
            {/* Step 1: Relationship type */}
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

            {/* Step 2: Search for person (shown once relationship is selected) */}
            {newType ? (
              manualEntry ? (
                // Manual entry mode for people not in the system
                <YStack gap="$2">
                  <XStack gap="$2" alignItems="center">
                    <UserPlus size={14} color="$blue10" />
                    <Text fontSize="$2" fontWeight="600" color="$blue10">
                      New person (not in directory)
                    </Text>
                  </XStack>
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
                  <Button
                    size="$2"
                    icon={Search}
                    alignSelf="flex-start"
                    onPress={() => {
                      setManualEntry(false)
                      setFirstName('')
                      setLastName('')
                      setSearchQuery('')
                      setSelectedPerson(null)
                    }}
                  >
                    Back to search
                  </Button>
                </YStack>
              ) : (
                // Search mode
                <YStack gap="$1" position="relative" ref={containerRef}>
                  <Label fontSize="$2">
                    Search for {relationshipTypeLabels[newType as RelationshipType] || 'person'}
                  </Label>
                  <YStack position="relative">
                    <Input
                      placeholder="Type a name or email to search..."
                      value={searchQuery}
                      onChangeText={handleSearch}
                      onBlur={handleSearchBlur}
                      onFocus={() => {
                        if (searchResults.length > 0 && !selectedPerson) setShowDropdown(true)
                      }}
                      autoCapitalize="none"
                      autoComplete="off"
                      autoCorrect={false}
                      paddingRight={searchQuery ? '$8' : '$6'}
                    />
                    <XStack
                      position="absolute"
                      right="$2"
                      top="50%"
                      transform="translateY(-50%)"
                      gap="$1"
                    >
                      {searchQuery ? (
                        <Button
                          size="$2"
                          circular
                          icon={X}
                          chromeless
                          onPress={() => {
                            setSearchQuery('')
                            setSelectedPerson(null)
                            setSearchResults([])
                            setShowDropdown(false)
                          }}
                          hoverStyle={{ backgroundColor: '$gray3' }}
                        />
                      ) : null}
                      {searching ? (
                        <Spinner size="small" color="$gray11" />
                      ) : (
                        <Search size={14} color="$gray11" style={{ pointerEvents: 'none' }} />
                      )}
                    </XStack>

                    {showDropdown && searchResults.length > 0 ? (
                      <YStack
                        position="absolute"
                        top="100%"
                        left={0}
                        right={0}
                        marginTop="$1"
                        backgroundColor="$background"
                        borderWidth={2}
                        borderColor="$textTertiary"
                        borderRadius="$3"
                        maxHeight={200}
                        overflow="hidden"
                        zIndex={99999}
                        elevation={5}
                        shadowColor="$shadowColor"
                        shadowOffset={{ width: 0, height: 4 }}
                        shadowOpacity={0.1}
                        shadowRadius={8}
                      >
                        {searchResults.map((person, index) => (
                          <Button
                            key={person.id}
                            chromeless
                            justifyContent="flex-start"
                            paddingHorizontal="$3"
                            paddingVertical="$2.5"
                            borderRadius={0}
                            backgroundColor="transparent"
                            hoverStyle={{ backgroundColor: '$blue2' }}
                            pressStyle={{ backgroundColor: '$blue3' }}
                            onPress={() => handleSelectPerson(person)}
                            borderBottomWidth={index < searchResults.length - 1 ? 1 : 0}
                            borderBottomColor="$borderColor"
                          >
                            <YStack alignItems="flex-start" width="100%" gap="$0.5">
                              <Text fontSize="$3" fontWeight="600" color="$textPrimary">
                                {person.name}
                              </Text>
                              {person.ecclesia ? (
                                <Text fontSize="$2" color="$gray11">{person.ecclesia}</Text>
                              ) : null}
                            </YStack>
                          </Button>
                        ))}
                      </YStack>
                    ) : null}

                    {showDropdown && searchQuery.length >= 2 && searchResults.length === 0 && !searching ? (
                      <YStack
                        position="absolute"
                        top="100%"
                        left={0}
                        right={0}
                        marginTop="$1"
                        backgroundColor="$background"
                        borderWidth={2}
                        borderColor="$textTertiary"
                        borderRadius="$3"
                        padding="$3"
                        zIndex={99999}
                        elevation={5}
                      >
                        <Text fontSize="$3" theme="alt2" textAlign="center">
                          No matching people found
                        </Text>
                      </YStack>
                    ) : null}
                  </YStack>

                  {selectedPerson ? (
                    <Card padding="$2" backgroundColor="$green2" borderWidth={1} borderColor="$green8" marginTop="$1">
                      <Text fontSize="$2" color="$green11">
                        Selected: {selectedPerson.name}
                        {selectedPerson.ecclesia ? ` (${selectedPerson.ecclesia})` : ''}
                      </Text>
                    </Card>
                  ) : null}

                  <Button
                    size="$2"
                    icon={UserPlus}
                    alignSelf="flex-start"
                    marginTop="$1"
                    onPress={() => setManualEntry(true)}
                  >
                    Add person not in directory
                  </Button>
                </YStack>
              )
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
                Add {newType ? relationshipTypeLabels[newType as RelationshipType] : 'Family Member'}
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
          {typeMembers.map((member) => {
            const hasListing = !!member.personId
            return (
            <Card
              key={`${member.email}-${member.relationshipType}`}
              padding="$3"
              backgroundColor="$backgroundHover"
            >
              <XStack justifyContent="space-between" alignItems="center">
                <XStack gap="$2" alignItems="center" flex={1}>
                  {hasListing && onMemberClick ? (
                    <Button
                      size="$2"
                      circular
                      chromeless
                      icon={<Link2 size={16} color="$blue10" />}
                      onPress={() => onMemberClick(member.personId!)}
                      hoverStyle={{ backgroundColor: '$blue2' }}
                    />
                  ) : (
                    <Link2Off size={16} color="$gray8" style={{ marginLeft: 8, marginRight: 8 }} />
                  )}
                  <Text fontSize="$4" fontWeight="500">
                    {member.name || 'Family Member'}
                  </Text>
                </XStack>
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
            )
          })}
        </YStack>
          )
        })}
    </YStack>
  )
}
