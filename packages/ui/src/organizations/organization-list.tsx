import { useState } from 'react'
import { YStack, XStack, Text, Input, ScrollView, Spinner, Heading, Card } from 'tamagui'
import { Button } from '../Button'
import { Plus, Search, Building2 } from '@tamagui/lucide-icons'
import { OrganizationCard } from './organization-card'
import type { OrganizationCardData } from './organization-card'
import type { OrganizationType } from '@my/app/provider/dynamodb/types'

interface OrganizationListProps {
  organizations: OrganizationCardData[]
  loading?: boolean
  onOrganizationClick?: (name: string) => void
  onCreateClick?: () => void
  canCreate?: boolean
}

const TYPE_FILTERS: Array<{ value: OrganizationType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'fraternal_gathering', label: 'Fraternal Gatherings' },
  { value: 'bible_school', label: 'Bible Schools' },
  { value: 'charity', label: 'Charities' },
  { value: 'youth_group', label: 'Youth Groups' },
  { value: 'other', label: 'Other' },
]

export function OrganizationList({
  organizations,
  loading = false,
  onOrganizationClick,
  onCreateClick,
  canCreate = false,
}: OrganizationListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<OrganizationType | 'all'>('all')

  const filtered = organizations.filter((org) => {
    if (typeFilter !== 'all' && org.type !== typeFilter) return false
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      org.name.toLowerCase().includes(searchLower) ||
      org.city?.toLowerCase().includes(searchLower) ||
      org.province?.toLowerCase().includes(searchLower) ||
      (org.description || '').toLowerCase().includes(searchLower)
    )
  })

  return (
    <YStack gap="$4" flex={1}>
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$2" flex={1}>
          <Heading size="$8">Organizations</Heading>
          <Text color="$textSecondary">
            Cross-ecclesia groups, fraternal gatherings, Bible schools, and more
          </Text>
        </YStack>
        {canCreate && onCreateClick ? (
          <Button
            size="$4"
            theme="blue"
            icon={Plus}
            onPress={onCreateClick}
          >
            Create Organization
          </Button>
        ) : null}
      </XStack>

      {/* Search */}
      <XStack gap="$2" alignItems="center">
        <Search size="$1" color="$gray11" />
        <Input
          flex={1}
          placeholder="Search organizations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          size="$4"
        />
      </XStack>

      {/* Type filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <XStack gap="$2" paddingVertical="$1">
          {TYPE_FILTERS.map((filter) => {
            const isActive = typeFilter === filter.value
            return (
              <Button
                key={filter.value}
                size="$3"
                theme={isActive ? 'blue' : undefined}
                variant={isActive ? undefined : 'outlined'}
                onPress={() => setTypeFilter(filter.value)}
              >
                {filter.label}
              </Button>
            )
          })}
        </XStack>
      </ScrollView>

      {/* List */}
      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
          <Spinner size="small" width={20} height={20} />
          <Text marginTop="$4" theme="alt2">Loading organizations...</Text>
        </YStack>
      ) : filtered.length === 0 ? (
        <Card padding="$6" borderWidth={1} borderColor="$borderColor">
          <YStack alignItems="center" gap="$3">
            <Building2 size={48} color="$gray8" />
            <Text fontSize="$5" fontWeight="600" theme="alt2">
              {searchQuery || typeFilter !== 'all' ? 'No matching organizations' : 'No organizations yet'}
            </Text>
            <Text fontSize="$3" theme="alt2" textAlign="center">
              {searchQuery || typeFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Organizations will appear here once created.'}
            </Text>
          </YStack>
        </Card>
      ) : (
        <YStack gap="$3">
          <Text fontSize="$3" theme="alt2">
            {filtered.length} organization{filtered.length !== 1 ? 's' : ''}
          </Text>
          {filtered.map((org) => (
            <OrganizationCard
              key={org.name}
              organization={org}
              onPress={onOrganizationClick ? () => onOrganizationClick(org.name) : undefined}
            />
          ))}
        </YStack>
      )}
    </YStack>
  )
}
