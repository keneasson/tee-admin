import { useState } from 'react'
import { YStack, XStack, Text, Card, Button, Heading, Input, Separator, Spinner } from '@my/ui'
import { Church, MapPin, Phone, Mail, User, Pencil, Save, X } from '@tamagui/lucide-icons'
import { PersonAutocomplete } from '../form/person-autocomplete'
import { ServiceList } from './service-list'
import { ServiceFormModal } from './service-form-modal'
import type { EcclesiaService, ServiceType } from './service-list'

export interface EcclesiaDetailData {
  name: string
  country: string
  province: string
  city: string
  address?: string
  postalCode?: string
  venue?: string
  phone?: string
  contactEmail?: string
  recordingBrotherEmail?: string
  recordingBrotherName?: string
  services?: EcclesiaService[]
}

interface EcclesiaDetailViewProps {
  ecclesia: EcclesiaDetailData
  canEdit: boolean
  onUpdate?: (updates: Partial<EcclesiaDetailData>) => Promise<boolean>
  onBack?: () => void
  initialEdit?: boolean
}

export function EcclesiaDetailView({ ecclesia, canEdit, onUpdate, onBack, initialEdit = false }: EcclesiaDetailViewProps) {
  const [editing, setEditing] = useState(canEdit && initialEdit)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editName, setEditName] = useState(ecclesia.name)
  const [editAddress, setEditAddress] = useState(ecclesia.address || '')
  const [editVenue, setEditVenue] = useState(ecclesia.venue || '')
  const [editPostalCode, setEditPostalCode] = useState(ecclesia.postalCode || '')
  const [editPhone, setEditPhone] = useState(ecclesia.phone || '')
  const [editContactEmail, setEditContactEmail] = useState(ecclesia.contactEmail || '')
  const [editRbName, setEditRbName] = useState(ecclesia.recordingBrotherName || '')
  const [editRbEmail, setEditRbEmail] = useState(ecclesia.recordingBrotherEmail || '')

  // Service modal state
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<EcclesiaService | null>(null)

  const startEditing = () => {
    setEditName(ecclesia.name)
    setEditAddress(ecclesia.address || '')
    setEditVenue(ecclesia.venue || '')
    setEditPostalCode(ecclesia.postalCode || '')
    setEditPhone(ecclesia.phone || '')
    setEditContactEmail(ecclesia.contactEmail || '')
    setEditRbName(ecclesia.recordingBrotherName || '')
    setEditRbEmail(ecclesia.recordingBrotherEmail || '')
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const saveEdits = async () => {
    if (!onUpdate) return
    setSaving(true)
    try {
      const success = await onUpdate({
        name: editName.trim(),
        address: editAddress,
        venue: editVenue,
        postalCode: editPostalCode,
        phone: editPhone,
        contactEmail: editContactEmail,
        recordingBrotherName: editRbName,
        recordingBrotherEmail: editRbEmail,
      })
      if (success) {
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAddService = () => {
    setEditingService(null)
    setServiceModalOpen(true)
  }

  const handleEditService = (service: EcclesiaService) => {
    setEditingService(service)
    setServiceModalOpen(true)
  }

  const handleDeleteService = async (serviceId: string) => {
    if (!onUpdate) return
    const currentServices = ecclesia.services || []
    const updatedServices = currentServices.filter((s) => s.id !== serviceId)
    await onUpdate({ services: updatedServices })
  }

  const handleSaveService = async (serviceData: Omit<EcclesiaService, 'id'> & { id?: string }) => {
    if (!onUpdate) return
    const currentServices = [...(ecclesia.services || [])]

    if (serviceData.id) {
      // Editing existing service
      const index = currentServices.findIndex((s) => s.id === serviceData.id)
      if (index >= 0) {
        currentServices[index] = { ...serviceData, id: serviceData.id } as EcclesiaService
      }
    } else {
      // Adding new service - generate a simple ID
      const id = `svc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
      currentServices.push({ ...serviceData, id } as EcclesiaService)
    }

    await onUpdate({ services: currentServices })
  }

  const locationParts = [ecclesia.city, ecclesia.province, ecclesia.country].filter(Boolean)

  return (
    <YStack gap="$4">
      {/* Header */}
      <Card padding="$4" backgroundColor="$backgroundHover">
        <YStack gap="$2">
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <XStack gap="$2" alignItems="center" flex={1}>
              <Church size={24} color="$blue10" />
              <Heading size="$7">{ecclesia.name}</Heading>
            </XStack>
            {canEdit && !editing ? (
              <Button
                size="$3"
                icon={Pencil}
                variant="outlined"
                onPress={startEditing}
              >
                Edit
              </Button>
            ) : null}
          </XStack>
          {locationParts.length > 0 ? (
            <Text fontSize="$3" theme="alt2">{locationParts.join(', ')}</Text>
          ) : null}
        </YStack>
      </Card>

      {/* General Info Card */}
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <YStack gap="$3">
          <Text fontSize="$5" fontWeight="600">General Information</Text>

          {editing ? (
            <YStack gap="$3">
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Ecclesia Name</Text>
                <Input value={editName} onChangeText={setEditName} placeholder="Ecclesia name" />
              </YStack>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Venue / Hall Name</Text>
                <Input value={editVenue} onChangeText={setEditVenue} placeholder="Hall name" />
              </YStack>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Address</Text>
                <Input value={editAddress} onChangeText={setEditAddress} placeholder="Street address" />
              </YStack>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Postal Code</Text>
                <Input value={editPostalCode} onChangeText={setEditPostalCode} placeholder="Postal code" />
              </YStack>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Phone</Text>
                <Input value={editPhone} onChangeText={setEditPhone} placeholder="Contact phone" />
              </YStack>
              <YStack gap="$1">
                <Text fontSize="$3" fontWeight="600">Contact Email</Text>
                <Input
                  value={editContactEmail}
                  onChangeText={setEditContactEmail}
                  placeholder="General contact email"
                  autoCapitalize="none"
                />
              </YStack>

              <Separator />
              <Text fontSize="$4" fontWeight="600">Recording Brother</Text>
              <XStack gap="$2" flexWrap="wrap">
                <PersonAutocomplete
                  ecclesia={ecclesia.name}
                  value={editRbName}
                  onChangeText={setEditRbName}
                  onSelect={(person) => {
                    setEditRbName(person.name)
                    setEditRbEmail(person.email)
                  }}
                  label="Name"
                  placeholder="Type to search members..."
                  showAllEmails
                />
                <YStack gap="$1" flex={1} minWidth={200}>
                  <Text fontSize="$3" fontWeight="600">Email</Text>
                  <Input
                    value={editRbEmail}
                    onChangeText={setEditRbEmail}
                    placeholder="Recording brother email"
                    autoCapitalize="none"
                  />
                </YStack>
              </XStack>

              <XStack gap="$2" justifyContent="flex-end">
                <Button icon={X} onPress={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
                <Button icon={saving ? undefined : Save} theme="blue" onPress={saveEdits} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </XStack>
            </YStack>
          ) : (
            <YStack gap="$3">
              {/* Venue & Address */}
              {(ecclesia.venue || ecclesia.address) ? (
                <YStack gap="$2" padding="$3" backgroundColor="$gray2" borderRadius="$3">
                  <XStack gap="$2" alignItems="center">
                    <MapPin size={16} color="$green10" />
                    <Text fontSize="$3" fontWeight="600" color="$green11">
                      Meeting Location
                    </Text>
                  </XStack>
                  {ecclesia.venue ? (
                    <Text fontSize="$3" fontWeight="600">{ecclesia.venue}</Text>
                  ) : null}
                  {ecclesia.address ? (
                    <Text fontSize="$3" theme="alt2">
                      {ecclesia.address}
                      {ecclesia.postalCode ? `, ${ecclesia.postalCode}` : ''}
                    </Text>
                  ) : null}
                </YStack>
              ) : (
                <Text fontSize="$3" theme="alt2">No address information available.</Text>
              )}

              {/* Contact info */}
              <XStack gap="$4" flexWrap="wrap">
                {ecclesia.phone ? (
                  <XStack gap="$1" alignItems="center">
                    <Phone size={14} color="$gray10" />
                    <Text fontSize="$3" theme="alt2">{ecclesia.phone}</Text>
                  </XStack>
                ) : null}
                {ecclesia.contactEmail ? (
                  <XStack gap="$1" alignItems="center">
                    <Mail size={14} color="$gray10" />
                    <Text fontSize="$3" theme="alt2">{ecclesia.contactEmail}</Text>
                  </XStack>
                ) : null}
              </XStack>
            </YStack>
          )}
        </YStack>
      </Card>

      {/* Recording Brother Card (read-only display when not editing) */}
      {!editing ? (
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <YStack gap="$2">
            <XStack gap="$2" alignItems="center">
              <User size={16} color="$blue10" />
              <Text fontSize="$4" fontWeight="600">Recording Brother</Text>
            </XStack>
            {(ecclesia.recordingBrotherName || ecclesia.recordingBrotherEmail) ? (
              <YStack gap="$1">
                {ecclesia.recordingBrotherName ? (
                  <Text fontSize="$3">{ecclesia.recordingBrotherName}</Text>
                ) : null}
                {ecclesia.recordingBrotherEmail ? (
                  <Text fontSize="$3" theme="alt2">{ecclesia.recordingBrotherEmail}</Text>
                ) : null}
              </YStack>
            ) : (
              <Text fontSize="$3" theme="alt2">No recording brother assigned.</Text>
            )}
          </YStack>
        </Card>
      ) : null}

      {/* Worship Services Card */}
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <ServiceList
          services={ecclesia.services || []}
          canEdit={canEdit}
          onAdd={handleAddService}
          onEdit={handleEditService}
          onDelete={handleDeleteService}
        />
      </Card>

      {/* Service Form Modal */}
      <ServiceFormModal
        isOpen={serviceModalOpen}
        onOpenChange={setServiceModalOpen}
        service={editingService}
        onSave={handleSaveService}
      />
    </YStack>
  )
}
