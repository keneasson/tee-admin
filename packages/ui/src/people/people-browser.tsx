import React, { useState } from 'react'
import { YStack, XStack, Text, Input, Select, Spinner, ScrollView, View } from 'tamagui'
import { Button } from '../Button'
import { Search, Filter, Plus, FileText, Globe } from '@tamagui/lucide-icons'
import { MemberCard } from './member-card'

interface MemberPrivacy {
  showName: 'authenticated' | 'ecclesia_and_connections' | 'connections_only' | 'private'
  showEmail: 'authenticated' | 'ecclesia_and_connections' | 'connections_only' | 'private'
  showPhone: 'authenticated' | 'ecclesia_and_connections' | 'connections_only' | 'private'
  showAddress: 'authenticated' | 'ecclesia_and_connections' | 'connections_only' | 'private'
  showFamily: 'authenticated' | 'ecclesia_and_connections' | 'connections_only' | 'private'
}

interface Member {
  id: string
  email: string
  name: string
  ecclesia?: string
  canViewDetails?: boolean
  privacy?: MemberPrivacy
}

interface PeopleBrowserProps {
  members: Member[]
  ecclesias: string[]
  loading?: boolean
  defaultEcclesia?: string | null
  isGlobalSearch?: boolean
  onMemberClick?: (id: string) => void
  onSearch?: (query: string) => void
  onFilterEcclesia?: (ecclesia: string | null) => void
  onDelete?: (email: string) => void
  deletingEmail?: string | null
  canAddMember?: boolean
  canReviewDrafts?: boolean
  onAddMember?: () => void
  pendingDraftCount?: number
  onShowDrafts?: () => void
}

export const PeopleBrowser: React.FC<PeopleBrowserProps> = ({
  members,
  ecclesias,
  loading = false,
  defaultEcclesia,
  isGlobalSearch = false,
  onMemberClick,
  onSearch,
  onFilterEcclesia,
  onDelete,
  deletingEmail,
  canAddMember,
  canReviewDrafts,
  onAddMember,
  pendingDraftCount = 0,
  onShowDrafts,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  // Use parent-controlled ecclesia if provided, otherwise local state
  const [localEcclesia, setLocalEcclesia] = useState<string | null>(defaultEcclesia ?? null)
  const selectedEcclesia = defaultEcclesia !== undefined ? defaultEcclesia : localEcclesia

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    onSearch?.(value)
  }

  const handleEcclesiaChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setLocalEcclesia(newValue)
    onFilterEcclesia?.(newValue)
  }

  // Client-side filtering — skip ecclesia filter when doing a global search
  const filteredMembers = members.filter((member) => {
    const matchesSearch = !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.ecclesia?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesEcclesia = isGlobalSearch || !selectedEcclesia || member.ecclesia === selectedEcclesia
    return matchesSearch && matchesEcclesia
  })

  return (
    <YStack gap="$4" flex={1}>
      {/* Header */}
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Text fontSize="$6" fontWeight="600">Contact List</Text>
        <Text fontSize="$3" theme="alt2">({filteredMembers.length} members)</Text>
        <XStack flex={1} />
        {canReviewDrafts && pendingDraftCount > 0 ? (
          <Button
            size="$3"
            theme="yellow"
            icon={FileText}
            borderWidth={2}
            onPress={onShowDrafts}
          >
            Review Drafts ({pendingDraftCount})
          </Button>
        ) : null}
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

      {/* Members List - Grid layout for wider screens */}
      {!loading && filteredMembers.length > 0 ? (
        <ScrollView flex={1}>
          <XStack flexWrap="wrap" gap="$2">
            {filteredMembers.map((member) => (
              <View key={member.id} width={280} minWidth={200} flexGrow={1} maxWidth={400}>
                <MemberCard
                  email={member.email}
                  name={member.name}
                  ecclesia={member.ecclesia}
                  canViewDetails={member.canViewDetails}
                  onPress={onMemberClick ? () => onMemberClick(member.id) : undefined}
                  onDelete={onDelete ? () => onDelete(member.email) : undefined}
                  isDeleting={deletingEmail === member.email}
                />
              </View>
            ))}
          </XStack>
        </ScrollView>
      ) : null}
    </YStack>
  )
}
