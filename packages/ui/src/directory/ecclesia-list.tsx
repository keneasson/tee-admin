import React from 'react'
import { YStack, XStack, Text, Card, Input, ScrollView, Spinner, Heading, useMedia } from 'tamagui'
import { Button } from '../Button'
import { Church, MapPin, Phone, Mail, Globe, Plus, Eye, Users, Clock, Search } from '@tamagui/lucide-icons'
import type { EcclesiaListItem, DirectoryAuthProps } from './types'

interface EcclesiaListProps {
  ecclesias: EcclesiaListItem[]
  loading?: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onViewEcclesia: (name: string) => void
  onAddEcclesia?: () => void
  authProps: DirectoryAuthProps
}

export function EcclesiaList({
  ecclesias,
  loading = false,
  searchQuery,
  onSearchChange,
  onViewEcclesia,
  onAddEcclesia,
  authProps,
}: EcclesiaListProps) {
  const media = useMedia()

  const filteredEcclesias = ecclesias.filter((ecclesia) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      ecclesia.name.toLowerCase().includes(searchLower) ||
      ecclesia.city?.toLowerCase().includes(searchLower) ||
      ecclesia.province?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <YStack gap="$4" flex={1}>
      {/* Header */}
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$2" flex={1}>
          <Heading size="$8">Ecclesia Directory</Heading>
          <Text color="$textSecondary">
            View ecclesia information including hall locations and contact details
          </Text>
        </YStack>
        {authProps.isAdminOrOwner && onAddEcclesia ? (
          <Button
            size="$4"
            theme="blue"
            icon={Plus}
            onPress={onAddEcclesia}
          >
            Add Ecclesia
          </Button>
        ) : null}
      </XStack>

      {/* Search */}
      <Card padding="$3" borderWidth={1} borderColor="$borderColor">
        <XStack alignItems="center" gap="$2">
          <Search size={16} color="$gray10" />
          <Input
            flex={1}
            placeholder="Search by name, city, or province..."
            value={searchQuery}
            onChangeText={onSearchChange}
            size="$4"
          />
        </XStack>
      </Card>

      {/* List */}
      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
          <Spinner size="small" width={20} height={20} />
          <Text marginTop="$4">Loading ecclesias...</Text>
        </YStack>
      ) : filteredEcclesias.length === 0 ? (
        <Card padding="$8" borderWidth={1} borderColor="$borderColor">
          <YStack gap="$3" alignItems="center">
            <Church size="$4" color="$gray11" />
            <Text fontSize="$5" fontWeight="600">No ecclesias found</Text>
            <Text color="$gray11" textAlign="center">
              {searchQuery
                ? 'Try adjusting your search'
                : 'No ecclesias have been added yet'}
            </Text>
          </YStack>
        </Card>
      ) : (
        <ScrollView>
          <XStack gap="$3" flexWrap="wrap">
            {filteredEcclesias.map((ecclesia) => (
              <Card
                key={ecclesia.id}
                padding="$4"
                borderWidth={1}
                borderColor="$borderColor"
                flexBasis={media.gtMd ? '48%' : '100%'}
                flexGrow={1}
              >
                <YStack gap="$3">
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack flex={1} gap="$1">
                      <XStack gap="$2" alignItems="center">
                        <Church size="$1" color="$blue10" />
                        <Text fontSize="$5" fontWeight="600">{ecclesia.name}</Text>
                      </XStack>
                      {(ecclesia.city || ecclesia.province) ? (
                        <Text fontSize="$3" color="$gray11">
                          {[ecclesia.city, ecclesia.province, ecclesia.country]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      ) : null}
                    </YStack>
                    <Button
                      size="$3"
                      icon={Eye}
                      variant="outlined"
                      onPress={() => onViewEcclesia(ecclesia.name)}
                    >
                      View
                    </Button>
                  </XStack>

                  {/* Venue & Address */}
                  {(ecclesia.venue || ecclesia.hall?.name || ecclesia.address) ? (
                    <YStack
                      gap="$2"
                      padding="$3"
                      backgroundColor="$gray2"
                      borderRadius="$3"
                    >
                      <XStack gap="$2" alignItems="center">
                        <MapPin size="$0.75" color="$green10" />
                        <Text fontSize="$3" fontWeight="600" color="$green11">
                          Meeting Location
                        </Text>
                      </XStack>
                      {(ecclesia.venue || ecclesia.hall?.name) ? (
                        <Text fontSize="$3" fontWeight="600">{ecclesia.venue || ecclesia.hall?.name}</Text>
                      ) : null}
                      {(ecclesia.address || ecclesia.hall?.address) ? (
                        <Text fontSize="$3" color="$gray11">{ecclesia.address || ecclesia.hall?.address}</Text>
                      ) : null}
                    </YStack>
                  ) : null}

                  {/* Contact Information */}
                  <XStack gap="$4" flexWrap="wrap">
                    {ecclesia.contactEmail ? (
                      <XStack gap="$1" alignItems="center">
                        <Mail size="$0.75" color="$gray11" />
                        <Text fontSize="$3" color="$gray11">{ecclesia.contactEmail}</Text>
                      </XStack>
                    ) : null}
                    {(ecclesia.phone || ecclesia.contactPhone) ? (
                      <XStack gap="$1" alignItems="center">
                        <Phone size="$0.75" color="$gray11" />
                        <Text fontSize="$3" color="$gray11">{ecclesia.phone || ecclesia.contactPhone}</Text>
                      </XStack>
                    ) : null}
                    {ecclesia.website ? (
                      <XStack gap="$1" alignItems="center">
                        <Globe size="$0.75" color="$gray11" />
                        <Text fontSize="$3" color="$blue10">{ecclesia.website}</Text>
                      </XStack>
                    ) : null}
                  </XStack>

                  {/* Member & Service Count Badges */}
                  <XStack gap="$4" flexWrap="wrap">
                    {ecclesia.memberCount ? (
                      <XStack gap="$1" alignItems="center">
                        <Users size="$0.75" color="$blue10" />
                        <Text fontSize="$3" color="$blue10" fontWeight="500">
                          In Directory: {ecclesia.memberCount}
                        </Text>
                      </XStack>
                    ) : null}
                    {ecclesia.services && ecclesia.services.length > 0 ? (
                      <XStack gap="$1" alignItems="center">
                        <Clock size="$0.75" color="$blue10" />
                        <Text fontSize="$3" color="$blue10" fontWeight="500">
                          {ecclesia.services.length} {ecclesia.services.length === 1 ? 'service' : 'services'}
                        </Text>
                      </XStack>
                    ) : null}
                  </XStack>

                  {/* Recording Brother (read-only on list) */}
                  {(ecclesia.recordingBrotherEmail || ecclesia.recordingBrotherName) ? (
                    <YStack
                      gap="$1"
                      padding="$3"
                      backgroundColor="$blue2"
                      borderRadius="$3"
                    >
                      <XStack gap="$2" alignItems="center">
                        <Mail size="$0.75" color="$blue10" />
                        <Text fontSize="$3" fontWeight="600" color="$blue11">
                          Recording Brother
                        </Text>
                      </XStack>
                      <Text fontSize="$3">
                        {ecclesia.recordingBrotherName ? `${ecclesia.recordingBrotherName} ` : ''}
                        {ecclesia.recordingBrotherEmail ? (
                          `<${ecclesia.recordingBrotherEmail}>`
                        ) : ''}
                      </Text>
                    </YStack>
                  ) : null}
                </YStack>
              </Card>
            ))}
          </XStack>
        </ScrollView>
      )}
    </YStack>
  )
}
