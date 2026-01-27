'use client'

import { useEffect, useState, useCallback } from 'react'
import { YStack, XStack, Text, Spinner, Heading, Card, Input, Button, ScrollView } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { Church, MapPin, Phone, Mail, Globe, Pencil, Plus, Trash } from '@tamagui/lucide-icons'
import { AddEcclesiaModal } from '@my/ui/src/form/add-ecclesia-modal'
import { Dialog } from 'tamagui'
import { brandColors } from '@my/ui/src/branding/brand-colors'

interface Ecclesia {
  id: string
  name: string
  city?: string
  province?: string
  country?: string
  address?: string
  postalCode?: string
  hall?: {
    name?: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
    parkingInfo?: string
  }
  contactEmail?: string
  contactPhone?: string
  website?: string
}

export default function EcclesialDirectoryPage() {
  const { hasAccess, isLoading: authLoading } = useAdminAccess()
  const isHydrated = useHydrated()
  const [ecclesias, setEcclesias] = useState<Ecclesia[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedEcclesia, setSelectedEcclesia] = useState<Ecclesia | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [ecclesiaToDelete, setEcclesiaToDelete] = useState<Ecclesia | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchEcclesias = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ecclesias')
      if (res.ok) {
        const data = await res.json()
        setEcclesias(data.ecclesias || [])
      }
    } catch (error) {
      console.error('Error fetching ecclesias:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) {
      fetchEcclesias()
    }
  }, [hasAccess, fetchEcclesias])

  const filteredEcclesias = ecclesias.filter((ecclesia) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      ecclesia.name.toLowerCase().includes(searchLower) ||
      ecclesia.city?.toLowerCase().includes(searchLower) ||
      ecclesia.province?.toLowerCase().includes(searchLower)
    )
  })

  const handleAddNew = () => {
    setSelectedEcclesia(null)
    setModalMode('add')
    setModalOpen(true)
  }

  const handleEdit = (ecclesia: Ecclesia) => {
    setSelectedEcclesia(ecclesia)
    setModalMode('edit')
    setModalOpen(true)
  }

  const handleEcclesiaAdded = () => {
    // Refresh the list
    fetchEcclesias()
  }

  const handleDeleteClick = (ecclesia: Ecclesia) => {
    setEcclesiaToDelete(ecclesia)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!ecclesiaToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/ecclesia?name=${encodeURIComponent(ecclesiaToDelete.name)}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setDeleteConfirmOpen(false)
        setEcclesiaToDelete(null)
        fetchEcclesias()
      } else {
        const data = await response.json()
        console.error('Delete failed:', data.error)
        alert(`Failed to delete: ${data.error}`)
      }
    } catch (error) {
      console.error('Error deleting ecclesia:', error)
      alert('Failed to delete ecclesia')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!isHydrated || authLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="small" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="flex-start">
        <YStack gap="$2" flex={1}>
          <Heading size="$8">Ecclesial Directory</Heading>
          <Text color="$textSecondary">
            View and manage ecclesia information including hall locations and contact details
          </Text>
        </YStack>
        <Button
          size="$4"
          theme="blue"
          icon={Plus}
          onPress={handleAddNew}
        >
          Add Ecclesia
        </Button>
      </XStack>

      {/* Search */}
      <Card padding="$3" borderWidth={1} borderColor="$borderColor">
        <Input
          placeholder="Search by name, city, or province..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          size="$4"
        />
      </Card>

      {/* Ecclesia List */}
      {loading ? (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
          <Spinner size="small" />
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
          <YStack gap="$3">
            {filteredEcclesias.map((ecclesia) => (
              <Card
                key={ecclesia.id}
                padding="$4"
                borderWidth={1}
                borderColor="$borderColor"
                hoverStyle={{ borderColor: '$blue8' }}
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
                    <XStack gap="$2">
                      <Button
                        size="$3"
                        icon={Pencil}
                        variant="outlined"
                        onPress={() => handleEdit(ecclesia)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="$3"
                        icon={Trash}
                        backgroundColor={brandColors.light.error}
                        color="white"
                        borderWidth={2}
                        borderColor={brandColors.light.error}
                        hoverStyle={{
                          backgroundColor: brandColors.light.error,
                          opacity: 0.9
                        }}
                        onPress={() => handleDeleteClick(ecclesia)}
                      >
                        Delete
                      </Button>
                    </XStack>
                  </XStack>

                  {/* Hall Information */}
                  {ecclesia.hall?.name ? (
                    <YStack
                      gap="$2"
                      padding="$3"
                      backgroundColor="$gray2"
                      borderRadius="$3"
                    >
                      <XStack gap="$2" alignItems="center">
                        <MapPin size="$0.75" color="$green10" />
                        <Text fontSize="$3" fontWeight="600" color="$green11">
                          Hall Location
                        </Text>
                      </XStack>
                      <Text fontSize="$3">{ecclesia.hall.name}</Text>
                      {ecclesia.hall.address ? (
                        <Text fontSize="$3" color="$gray11">{ecclesia.hall.address}</Text>
                      ) : null}
                      {(ecclesia.hall.city || ecclesia.hall.province) ? (
                        <Text fontSize="$3" color="$gray11">
                          {[
                            ecclesia.hall.city,
                            ecclesia.hall.province,
                            ecclesia.hall.postalCode
                          ].filter(Boolean).join(', ')}
                        </Text>
                      ) : null}
                      {ecclesia.hall.parkingInfo ? (
                        <Text fontSize="$2" color="$gray10">
                          Parking: {ecclesia.hall.parkingInfo}
                        </Text>
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
                    {ecclesia.contactPhone ? (
                      <XStack gap="$1" alignItems="center">
                        <Phone size="$0.75" color="$gray11" />
                        <Text fontSize="$3" color="$gray11">{ecclesia.contactPhone}</Text>
                      </XStack>
                    ) : null}
                    {ecclesia.website ? (
                      <XStack gap="$1" alignItems="center">
                        <Globe size="$0.75" color="$gray11" />
                        <Text fontSize="$3" color="$blue10">{ecclesia.website}</Text>
                      </XStack>
                    ) : null}
                  </XStack>
                </YStack>
              </Card>
            ))}
          </YStack>
        </ScrollView>
      )}

      {/* Add/Edit Ecclesia Modal */}
      <AddEcclesiaModal
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        mode={modalMode}
        initialData={selectedEcclesia ? {
          name: selectedEcclesia.name,
          country: selectedEcclesia.country,
          province: selectedEcclesia.province,
          city: selectedEcclesia.city,
          address: selectedEcclesia.address || selectedEcclesia.hall?.address,
          postalCode: selectedEcclesia.postalCode || selectedEcclesia.hall?.postalCode,
        } : undefined}
        onEcclesiaAdded={handleEcclesiaAdded}
      />

      {/* Delete Confirmation Modal */}
      <Dialog modal open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            key="content"
            bordered
            elevate
            animation={[
              'quick',
              {
                opacity: {
                  overshootClamping: true,
                },
              },
            ]}
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
            padding="$4"
          >
            <Dialog.Title fontSize="$6" fontWeight="600">
              Confirm Deletion
            </Dialog.Title>
            <Dialog.Description fontSize="$4" color="$gray11">
              Are you sure you want to delete "{ecclesiaToDelete?.name}"? This action cannot be undone.
            </Dialog.Description>

            <XStack gap="$3" justifyContent="flex-end" marginTop="$2">
              <Dialog.Close asChild>
                <Button
                  variant="outlined"
                  borderWidth={2}
                  borderColor="$textTertiary"
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                backgroundColor={brandColors.light.error}
                color="white"
                borderWidth={2}
                borderColor={brandColors.light.error}
                hoverStyle={{
                  backgroundColor: brandColors.light.error,
                  opacity: 0.9
                }}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Ecclesia'}
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  )
}
