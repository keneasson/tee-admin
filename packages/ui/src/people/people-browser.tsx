import React, { useState } from 'react'
import { YStack, XStack, Text, Input, Select, Spinner, ScrollView, View } from 'tamagui'
import { Search, Filter } from '@tamagui/lucide-icons'
import { MemberCard } from './member-card'

interface Member {
  email: string
  name: string
  ecclesia?: string
  canViewDetails?: boolean
}

interface PeopleBrowserProps {
  members: Member[]
  ecclesias: string[]
  loading?: boolean
  onMemberClick?: (email: string) => void
  onSearch?: (query: string) => void
  onFilterEcclesia?: (ecclesia: string | null) => void
  onDelete?: (email: string) => void
  deletingEmail?: string | null
}

export const PeopleBrowser: React.FC<PeopleBrowserProps> = ({
  members,
  ecclesias,
  loading = false,
  onMemberClick,
  onSearch,
  onFilterEcclesia,
  onDelete,
  deletingEmail,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEcclesia, setSelectedEcclesia] = useState<string | null>(null)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    onSearch?.(value)
  }

  const handleEcclesiaChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setSelectedEcclesia(newValue)
    onFilterEcclesia?.(newValue)
  }

  // Client-side filtering if no server-side handlers
  const filteredMembers = members.filter((member) => {
    const matchesSearch = !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.ecclesia?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesEcclesia = !selectedEcclesia || member.ecclesia === selectedEcclesia
    return matchesSearch && matchesEcclesia
  })

  return (
    <YStack gap="$4" flex={1}>
      {/* Header */}
      <XStack gap="$2" alignItems="center">
        <Text fontSize="$6" fontWeight="600">Contact List</Text>
        <Text fontSize="$3" theme="alt2">({filteredMembers.length} members)</Text>
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

      {/* Loading State */}
      {loading ? (
        <YStack flex={1} alignItems="center" justifyContent="center" padding="$6">
          <Spinner size="small" />
          <Text fontSize="$3" theme="alt2" marginTop="$2">Loading members...</Text>
        </YStack>
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
              <View key={member.email} width={280} minWidth={200} flexGrow={1} maxWidth={400}>
                <MemberCard
                  email={member.email}
                  name={member.name}
                  ecclesia={member.ecclesia}
                  canViewDetails={member.canViewDetails}
                  onPress={onMemberClick ? () => onMemberClick(member.email) : undefined}
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
