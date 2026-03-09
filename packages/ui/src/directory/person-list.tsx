import React, { useState, useMemo } from 'react'
import { YStack, XStack, Text, Input, Select, Spinner, ScrollView, View, Card } from 'tamagui'
import { Button } from '../Button'
import { Search, Filter, Plus, FileText, Globe } from '@tamagui/lucide-icons'
import { PersonCard } from './person-card'
import type { DirectoryMember, EcclesiaListItem } from './types'

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
  ecclesiaDetails?: EcclesiaListItem[]
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
  ecclesiaDetails,
}) => {
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [localEcclesia, setLocalEcclesia] = useState<string | null>(defaultEcclesia ?? null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null)

  const searchQuery = controlledSearchQuery !== undefined ? controlledSearchQuery : localSearchQuery
  const selectedEcclesia = controlledEcclesia !== undefined ? controlledEcclesia : localEcclesia

  // Global search: when 3+ chars, search across all ecclesias
  const isGlobalSearch = searchQuery.length >= 3

  // Build lookup map from ecclesia name to its metadata
  const ecclesiaMetaMap = useMemo(() => {
    const map = new Map<string, EcclesiaListItem>()
    if (ecclesiaDetails) {
      for (const e of ecclesiaDetails) {
        map.set(e.name, e)
      }
    }
    return map
  }, [ecclesiaDetails])

  // Available countries from ecclesia metadata
  const availableCountries = useMemo(() => {
    if (!ecclesiaDetails) return []
    const countries = new Set<string>()
    for (const e of ecclesiaDetails) {
      if (e.country) countries.add(e.country)
    }
    return Array.from(countries).sort()
  }, [ecclesiaDetails])

  // Available provinces filtered by selected country
  const availableProvinces = useMemo(() => {
    if (!ecclesiaDetails) return []
    const provinces = new Set<string>()
    for (const e of ecclesiaDetails) {
      if (e.province && (!selectedCountry || e.country === selectedCountry)) {
        provinces.add(e.province)
      }
    }
    return Array.from(provinces).sort()
  }, [ecclesiaDetails, selectedCountry])

  // Ecclesia options filtered by country + province
  const filteredEcclesiaOptions = useMemo(() => {
    if (!selectedCountry && !selectedProvince) return ecclesias
    return ecclesias.filter((name) => {
      const meta = ecclesiaMetaMap.get(name)
      if (!meta) return false
      if (selectedCountry && meta.country !== selectedCountry) return false
      if (selectedProvince && meta.province !== selectedProvince) return false
      return true
    })
  }, [ecclesias, ecclesiaMetaMap, selectedCountry, selectedProvince])

  const handleSearchChange = (value: string) => {
    setLocalSearchQuery(value)
    onSearchChange?.(value)
  }

  const handleEcclesiaChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setLocalEcclesia(newValue)
    onEcclesiaChange?.(newValue)
  }

  const handleCountryChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setSelectedCountry(newValue)
    // Reset province when country changes
    setSelectedProvince(null)
    // Reset ecclesia if it's no longer compatible
    if (selectedEcclesia && newValue) {
      const meta = ecclesiaMetaMap.get(selectedEcclesia)
      if (meta && meta.country !== newValue) {
        handleEcclesiaChange('all')
      }
    }
  }

  const handleProvinceChange = (value: string) => {
    const newValue = value === 'all' ? null : value
    setSelectedProvince(newValue)
    // Reset ecclesia if it's no longer compatible
    if (selectedEcclesia && newValue) {
      const meta = ecclesiaMetaMap.get(selectedEcclesia)
      if (meta && meta.province !== newValue) {
        handleEcclesiaChange('all')
      }
    }
  }

  // Client-side filtering
  const filteredMembers = members.filter((member) => {
    const matchesSearch = !searchQuery ||
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.ecclesia?.toLowerCase().includes(searchQuery.toLowerCase())

    // Location filtering via ecclesia metadata
    let matchesLocation = true
    if (!isGlobalSearch && (selectedCountry || selectedProvince)) {
      if (member.ecclesia) {
        const meta = ecclesiaMetaMap.get(member.ecclesia)
        if (meta) {
          if (selectedCountry && meta.country !== selectedCountry) matchesLocation = false
          if (selectedProvince && meta.province !== selectedProvince) matchesLocation = false
        } else {
          // No metadata for this ecclesia — exclude if filters are active
          matchesLocation = false
        }
      } else {
        // No ecclesia on member — exclude if location filters are active
        matchesLocation = false
      }
    }

    const matchesEcclesia = isGlobalSearch || !selectedEcclesia || member.ecclesia === selectedEcclesia
    return matchesSearch && matchesLocation && matchesEcclesia
  })

  const showCountryFilter = ecclesiaDetails && availableCountries.length >= 2
  const showProvinceFilter = ecclesiaDetails && availableProvinces.length >= 2

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

      {/* Add Member button row */}
      {canAddMember ? (
        <XStack>
          <Button
            size="$3"
            theme="blue"
            icon={Plus}
            borderWidth={2}
            onPress={onAddMember}
          >
            Add Member
          </Button>
        </XStack>
      ) : null}

      {/* Search row */}
      <XStack alignItems="center" gap="$2">
        <Search size={16} color="$gray10" />
        <Input
          flex={1}
          placeholder="Search by name or email"
          value={searchQuery}
          onChangeText={handleSearchChange}
        />
      </XStack>

      {/* Filter row */}
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Filter size={16} color="$gray10" />
        <Text fontSize="$3" theme="alt2">({filteredMembers.length} members)</Text>

        {ecclesias.length > 1 ? (
          <View minWidth={180}>
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
                  {filteredEcclesiaOptions.map((ecclesia, index) => (
                    <Select.Item key={ecclesia} value={ecclesia} index={index + 1}>
                      <Select.ItemText>{ecclesia}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
          </View>
        ) : null}

        {showCountryFilter ? (
          <View minWidth={160}>
            <Select
              value={selectedCountry || 'all'}
              onValueChange={handleCountryChange}
            >
              <Select.Trigger>
                <Select.Value placeholder="All Countries" />
              </Select.Trigger>
              <Select.Content>
                <Select.ScrollUpButton />
                <Select.Viewport>
                  <Select.Item value="all" index={0}>
                    <Select.ItemText>All Countries</Select.ItemText>
                  </Select.Item>
                  {availableCountries.map((country, index) => (
                    <Select.Item key={country} value={country} index={index + 1}>
                      <Select.ItemText>{country}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
          </View>
        ) : null}

        {showProvinceFilter ? (
          <View minWidth={160}>
            <Select
              value={selectedProvince || 'all'}
              onValueChange={handleProvinceChange}
            >
              <Select.Trigger>
                <Select.Value placeholder="All States/Provinces" />
              </Select.Trigger>
              <Select.Content>
                <Select.ScrollUpButton />
                <Select.Viewport>
                  <Select.Item value="all" index={0}>
                    <Select.ItemText>All States/Provinces</Select.ItemText>
                  </Select.Item>
                  {availableProvinces.map((province, index) => (
                    <Select.Item key={province} value={province} index={index + 1}>
                      <Select.ItemText>{province}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
          </View>
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
            {searchQuery || selectedEcclesia || selectedCountry || selectedProvince
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
