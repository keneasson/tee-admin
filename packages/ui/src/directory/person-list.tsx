import React, { useState } from 'react'
import { YStack, XStack, Text, Input, Select, Spinner, ScrollView, View, Card } from 'tamagui'
import { Button } from '../Button'
import { Search, Filter, Plus, FileText, Globe } from '@tamagui/lucide-icons'
import { PersonCard } from './person-card'
import type { DirectoryMember } from './types'

interface PersonListProps {
  members: DirectoryMember[]
  ecclesias: string[]
  loading?: boolean
  defaultEcclesia?: string | null
  searchQuery?: string
  onSearchChange?: (query: string) => void
  selectedEcclesia?: string | null
  onEcclesiaChange?: (ecclesia: string | null) => void
  onMemberClick?: (id: string) => void
  canAddMember?: boolean
  onAddMember?: () => void
  pendingDraftCount?: number
  onShowDrafts?: () => void
  canReviewDrafts?: boolean
}

export const PersonList: React.FC<PersonListProps> = ({
  members,
  ecclesias,
  loading = false,
  defaultEcclesia,
  searchQuery: controlledSearchQuery,
  onSearchChange,
  selectedEcclesia: controlledEcclesia,
  onEcclesiaChange,
  onMemberClick,
  canAddMember,
  onAddMember,
  pendingDraftCount = 0,
  onShowDrafts,
  canReviewDrafts,
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [localEcclesia, setLocalEcclesia] = useState<string | null>(defaultEcclesia ?? null)

  const searchQuery = controlledSearchQuery !== undefined ? controlledSearchQuery : localSearchQuery
  const selectedEcclesia = controlledEcclesia !== undefined ? controlledEcclesia : localEcclesia

  // Global search: when 3+ chars, search across all ecclesias
  const isGlobalSearch = searchQuery.length >= 3

  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value)
    onSearchChange?.(value)
  }

  const handleEcclesiaChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setLocalEcclesia(newValue)
    onEcclesiaChange?.(newValue)
  }

  // Client-side filtering
  const filteredMembers = members.filter((member) => {
    const matchesSearch = !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.ecclesia?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesEcclesia = isGlobalSearch || !selectedEcclesia || member.ecclesia === selectedEcclesia
    return matchesSearch && matchesEcclesia
  })

  return (
    <YStack gap="$4" flex={1}>
      {/* Draft notification banner */}
      {canReviewDrafts && pendingDraftCount > 0 ? (
        <Card
          padding="$3"
          backgroundColor="$yellow2"
          borderWidth={1}
          borderColor="$yellow6"
          pressStyle={{ opacity: 0.8 }}
          onPress={onShowDrafts}
          cursor="pointer"
        >
          <XStack gap="$2" alignItems="center">
            <FileText size={18} color="$yellow10" />
            <Text fontWeight="600" color="$yellow11">
              {pendingDraftCount} pending draft{pendingDraftCount !== 1 ? 's' : ''} to review
            </Text>
          </XStack>
        </Card>
      ) : null}

      {/* Header */}
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Text fontSize="$6" fontWeight="600">Contact List</Text>
        <Text fontSize="$3" theme="alt2">({filteredMembers.length} members)</Text>
        <XStack flex={1} />
        {canAddMember ? (
          <Button
            size="$3"
            theme="blue"
            icon={Plus}
            borderWidth={2}
            onPress={onAddMember}
          >
            Add Member
          </Button>
        ) : null}
      </XStack>

      {/* Search and Filter */}
      <XStack gap="$2" flexWrap="wrap">
        <XStack flex={1} minWidth={200} alignItems="center" gap="$2">
          <Search size={16} color="$gray10" />
          <Input
            flex={1}
            placeholder="Search by name or ecclesia..."
            value={searchQuery}
            onChangeText={handleSearchChange}
          />
        </XStack>
        {ecclesias.length > 1 ? (
          <XStack minWidth={200} alignItems="center" gap="$2">
            <Filter size={16} color="$gray10" />
            <View flex={1}>
              <Select
                value={selectedEcclesia || 'all'}
                onValueChange={handleEcclesiaChange}
              >
                <Select.Trigger>
                  <Select.Value placeholder="All Ecclesias" />
                </Select.Trigger>
                <Select.Content>
                  <Select.ScrollUpButton />
                  <Select.Viewport>
                    <Select.Item value="all" index={0}>
                      <Select.ItemText>All Ecclesias</Select.ItemText>
                    </Select.Item>
                    {ecclesias.map((ecclesia, index) => (
                      <Select.Item key={ecclesia} value={ecclesia} index={index + 1}>
                        <Select.ItemText>{ecclesia}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                  <Select.ScrollDownButton />
                </Select.Content>
              </Select>
            </View>
          </XStack>
        ) : null}
      </XStack>

      {/* Global search indicator */}
      {isGlobalSearch && selectedEcclesia ? (
        <XStack gap="$2" alignItems="center" paddingHorizontal="$2">
          <Globe size={14} color="$blue10" />
          <Text fontSize="$3" color="$blue10">
            Searching all ecclesias
          </Text>
        </XStack>
      ) : null}

      {/* Loading State */}
      {loading ? (
        <XStack alignItems="center" justifyContent="center" padding="$6" gap="$2">
          <Spinner size="small" width={20} height={20} />
          <Text fontSize="$3" theme="alt2">Loading members...</Text>
        </XStack>
      ) : null}

      {/* Empty State */}
      {!loading && filteredMembers.length === 0 ? (
        <YStack flex={1} alignItems="center" justifyContent="center" padding="$6">
          <Text fontSize="$4" theme="alt2">
            {searchQuery || selectedEcclesia
              ? 'No members match your search'
              : 'No members found'}
          </Text>
        </YStack>
      ) : null}

      {/* Members Grid */}
      {!loading && filteredMembers.length > 0 ? (
        <ScrollView flex={1}>
          <XStack flexWrap="wrap" gap="$2">
            {filteredMembers.map((member) => (
              <View key={member.id} width={280} minWidth={200} flexGrow={1} maxWidth={400}>
                <PersonCard
                  name={member.name}
                  ecclesia={member.ecclesia}
                  hideEcclesia={!!selectedEcclesia && !isGlobalSearch}
                  onPress={onMemberClick ? () => onMemberClick(member.id) : undefined}
                />
              </View>
            ))}
          </XStack>
        </ScrollView>
      ) : null}
    </YStack>
  )
}
