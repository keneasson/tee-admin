import { useState } from 'react'
import { YStack, XStack, Text, Card, Button, Heading, Input, Separator, Spinner } from '@my/ui'
import { Church, MapPin, Phone, Mail, Pencil, Save, X } from '@tamagui/lucide-icons'
import { PersonAutocomplete } from '../form/person-autocomplete'
import { ServiceList } from './service-list'
import { ExternalLinksCard } from './external-links-card'
import type { ExternalLinksData } from './external-links-card'
import { SubscriptionManager } from './subscription-manager'
import { SharingSettingsCard } from './sharing-settings-card'
import { RbAlertSettingsCard } from './rb-alert-settings-card'
import { NearbyEcclesiasCard } from './nearby-ecclesias-card'
import type { NearbyEcclesiaItem } from './nearby-ecclesias-card'
import { ScheduleEditor } from './schedule-editor'
import { ScheduleViewer } from './schedule-viewer'
import { ScheduleConfigEditor } from './schedule-config-editor'

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
  /** @deprecated Use scheduleConfig instead */
  services?: any[]
  website?: string
  externalLinks?: {
    newsletterUrl?: string
    youtube?: string
    facebook?: string
    otherLinks?: Array<{ label: string; url: string }>
  }
  logoUrl?: string
  scheduleConfig?: Record<string, any>
  // Multi-tenant fields
  timezone?: string
  latitude?: number
  longitude?: number
  locationSource?: 'address' | 'city' | 'manual'
  sharingPreference?: 'open' | 'subscribers-only' | 'private'
  excludedEcclesias?: string[]
  rbAlertPreference?: 'all' | 'major' | 'none'
  sharingRadiusKm?: number
  nearbyEcclesias?: string[]
}

interface EcclesiaDetailViewProps {
  ecclesia: EcclesiaDetailData
  canEdit: boolean
  onUpdate?: (updates: Partial<EcclesiaDetailData>) => Promise<boolean>
  onBack?: () => void
  initialEdit?: boolean
  showExternalLinks?: boolean
  /** Enriched nearby ecclesias (with distance + metadata) from API */
  nearbyEcclesiasData?: NearbyEcclesiaItem[]
  nearbyLoading?: boolean
  onEcclesiaClick?: (name: string) => void
}

export function EcclesiaDetailView({ ecclesia, canEdit, onUpdate, onBack, initialEdit = false, showExternalLinks = false, nearbyEcclesiasData, nearbyLoading, onEcclesiaClick }: EcclesiaDetailViewProps) {
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

      {/* Worship Services — derived from schedule configuration */}
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <ServiceList scheduleConfig={ecclesia.scheduleConfig} />
      </Card>

      {/* External Links Card (gated behind multi-tenant feature flag via prop) */}
      {showExternalLinks ? (
        <ExternalLinksCard
          data={{
            website: ecclesia.website,
            externalLinks: ecclesia.externalLinks,
            logoUrl: ecclesia.logoUrl,
          }}
          canEdit={canEdit}
          onSave={onUpdate ? async (updates: ExternalLinksData) => {
            return onUpdate({
              website: updates.website,
              externalLinks: updates.externalLinks,
              logoUrl: updates.logoUrl,
            } as Partial<EcclesiaDetailData>)
          } : undefined}
        />
      ) : null}

      {/* Schedule Viewer — config-driven table (gated behind multi-tenant feature flag) */}
      {showExternalLinks ? (
        <ScheduleViewer
          ecclesiaName={ecclesia.name}
          scheduleConfig={ecclesia.scheduleConfig}
        />
      ) : null}

      {/* Schedule Data Editor — for manually entering schedule entries */}
      {showExternalLinks && canEdit ? (
        <ScheduleEditor
          ecclesiaName={ecclesia.name}
          canEdit={canEdit}
        />
      ) : null}

      {/* Schedule Config Editor — choose tabs, fields, labels (admin only) */}
      {showExternalLinks && canEdit && onUpdate ? (
        <ScheduleConfigEditor
          scheduleConfig={ecclesia.scheduleConfig}
          onSave={async (config) => {
            return onUpdate({ scheduleConfig: config } as Partial<EcclesiaDetailData>)
          }}
        />
      ) : null}

      {/* Event Sharing Settings (gated behind multi-tenant feature flag via prop) */}
      {showExternalLinks ? (
        <SharingSettingsCard
          sharingPreference={ecclesia.sharingPreference}
          sharingRadiusKm={ecclesia.sharingRadiusKm}
          excludedEcclesias={ecclesia.excludedEcclesias}
          canEdit={canEdit}
          onSave={onUpdate ? async (updates) => {
            return onUpdate(updates as Partial<EcclesiaDetailData>)
          } : undefined}
        />
      ) : null}

      {/* RB Alert Preferences (gated behind multi-tenant feature flag via prop) */}
      {showExternalLinks ? (
        <RbAlertSettingsCard
          rbAlertPreference={ecclesia.rbAlertPreference}
          canEdit={canEdit}
          onSave={onUpdate ? async (pref) => {
            await onUpdate({ rbAlertPreference: pref } as Partial<EcclesiaDetailData>)
          } : async () => {}}
        />
      ) : null}

      {/* Nearby Ecclesias Discovery (gated behind multi-tenant feature flag via prop) */}
      {showExternalLinks && nearbyEcclesiasData ? (
        <NearbyEcclesiasCard
          ecclesiaName={ecclesia.name}
          nearbyEcclesias={nearbyEcclesiasData}
          loading={nearbyLoading}
          radiusKm={ecclesia.sharingRadiusKm ?? 300}
          onEcclesiaClick={onEcclesiaClick}
        />
      ) : null}

      {/* Event Subscriptions (gated behind multi-tenant feature flag via prop) */}
      {showExternalLinks ? (
        <SubscriptionManager
          ecclesiaName={ecclesia.name}
          canManage={canEdit}
        />
      ) : null}

    </YStack>
  )
}
