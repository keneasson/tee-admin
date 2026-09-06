'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Section, Text, YStack, XStack, Heading, Card, Button, Separator, Spinner, Select, Adapt, Sheet, Input, View } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { ContactRequestButton } from '@my/ui/src/profile/contact-request-button'
import { ConnectButton } from '@my/ui/src/profile/connect-button'
import { SuggestEditButton } from '@my/ui/src/profile/suggest-edit-button'
import { ArrowLeft, Phone, Mail, MapPin, Users, Lock, Edit3, Shield, Check, ChevronDown, ChevronUp, X, Save, Search, Plus, Trash2 } from '@tamagui/lucide-icons'
import type { ContactRequestType, ContactRequestReason, EditRequestField } from '@my/app/provider/dynamodb/types'
import { ManagedRegionsCard } from '@my/ui/src/admin/managed-regions-card'
import { getRegionOptions } from '@my/app/config/regions'
import { useFeatureFlag } from '@my/app/features/feature-flags/use-feature-flag'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'

interface MemberProfile {
  email: string
  personId?: string
  name?: string
  firstName?: string
  lastName?: string
  ecclesia?: string
  ecclesiaInfo?: {
    city: string
    province: string
    country: string
    venue?: string
    address?: string
    recordingBrotherEmail?: string
    recordingBrotherName?: string
  }
  isInterEcclesia?: boolean
  isPrivate?: boolean
  isDeceased?: boolean
  canEdit?: boolean
  availableContactMethods?: ContactRequestType[]
  role?: string
  managedRegions?: string[]
  canSetRole?: boolean
  allowedRoles?: string[]
  emails?: Array<{
    email: string
    emailType: string
    emailId?: string
    verified?: boolean
  }>
  phones?: Array<{
    phoneId?: string
    type: string
    number: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  addresses?: Array<{
    addressId?: string
    type: string
    label?: string
    street1: string
    street2?: string
    city: string
    province: string
    postalCode: string
    country: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  family?: Array<{
    email: string
    name?: string
    personId?: string
    relationshipType: string
  }>
  privacy?: {
    showName: string
    showEmail: string
    showPhone: string
    showAddress: string
    showFamily: string
  }
  connectionStatus?: 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'self'
  needsConnection?: boolean
  permissions: {
    canViewName: boolean
    canViewPhone: boolean
    canViewAddress: boolean
    canViewEmail: boolean
    canViewFamily: boolean
    canRequestContact: boolean
  }
}

type VisibilityLevel = 'authenticated' | 'ecclesia_and_connections' | 'connections_only' | 'private'

function getPrivacyColor(level: string): string {
  switch (level) {
    case 'authenticated':
      return '#22c55e' // green
    case 'ecclesia_and_connections':
    case 'connections_only':
      return '#f59e0b' // amber
    case 'private':
    default:
      return '#ef4444' // red
  }
}

function getPrivacyLabel(level: string): string {
  switch (level) {
    case 'authenticated': return 'Public'
    case 'ecclesia_and_connections': return 'Members only'
    case 'connections_only': return 'Connections only'
    case 'private': return 'Private'
    default: return 'Private'
  }
}

/** Small colored dot + label showing the privacy level for a field */
function PrivacyIndicator({ level }: { level: string }) {
  return (
    <XStack gap="$1" alignItems="center" {...({ title: getPrivacyLabel(level) } as any)}>
      <View
        width={8}
        height={8}
        borderRadius={4}
        backgroundColor={getPrivacyColor(level)}
      />
      <Text fontSize={10} color="$gray10">{getPrivacyLabel(level)}</Text>
    </XStack>
  )
}

export default function MemberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const isHydrated = useHydrated()
  const multiTenantEnabled = useFeatureFlag(FEATURE_FLAGS.MULTI_TENANT_INIT)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleUpdating, setRoleUpdating] = useState(false)
  const [roleMessage, setRoleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editEcclesia, setEditEcclesia] = useState('')
  const [saving, setSaving] = useState(false)
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ecclesiaSuggestions, setEcclesiaSuggestions] = useState<Array<{ name: string; city: string; province: string }>>([])
  const [showEcclesiaDrop, setShowEcclesiaDrop] = useState(false)
  const [ecclesiaSearching, setEcclesiaSearching] = useState(false)
  const [myPhones, setMyPhones] = useState<Array<{ type: string; number: string }>>([])
  const ecclesiaTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const ecclesiaContainerRef = useRef<HTMLDivElement>(null)

  // Inline add form state
  const [addingEmail, setAddingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [addingPhone, setAddingPhone] = useState(false)
  const [newPhoneType, setNewPhoneType] = useState('mobile')
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [addingAddress, setAddingAddress] = useState(false)
  const [newAddressType, setNewAddressType] = useState('home')
  const [newStreet1, setNewStreet1] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newProvince, setNewProvince] = useState('')
  const [newPostalCode, setNewPostalCode] = useState('')
  const [newCountry, setNewCountry] = useState('Canada')
  const [addingFamily, setAddingFamily] = useState(false)
  const [newFamilyEmail, setNewFamilyEmail] = useState('')
  const [newRelationType, setNewRelationType] = useState('spouse')
  const [contactSaving, setContactSaving] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Assist-a-member: change/promote the member's login email on their behalf
  const [changingLogin, setChangingLogin] = useState(false)
  const [newLoginEmail, setNewLoginEmail] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginMessage, setLoginMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const memberId = decodeURIComponent((params?.email as string) || '')
  const sessionEmail = session?.user?.email?.toLowerCase() || ''
  const isOwnProfile = sessionEmail !== '' && sessionEmail === profile?.email?.toLowerCase()

  const contactsUrl = `/api/people/${encodeURIComponent(memberId)}/contacts`

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(memberId)}`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
      } else if (res.status === 404) {
        setError('Member not found')
      } else {
        setError('Failed to load profile')
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProfile()
    }
  }, [status, fetchProfile])

  // Fetch viewer's own phones for "Call Me" callback
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/user/phones')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.success && Array.isArray(data.phones)) {
          setMyPhones(data.phones.map((p: { type: string; number: string }) => ({
            type: p.type,
            number: p.number,
          })))
        }
      })
      .catch(() => {/* ignore — phones are optional */})
  }, [status])

  const handleContactRequest = async (type: ContactRequestType, message?: string, reason?: ContactRequestReason) => {
    const res = await fetch('/api/contact-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: profile!.email,
        requestType: type,
        message,
        reason,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to send request')
    }
  }

  const handleSetRole = async (newRole: string) => {
    setRoleUpdating(true)
    setRoleMessage(null)
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile!.email, newRole }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRoleMessage({ type: 'success', text: `Role changed to ${newRole}` })
        // Update local profile state
        setProfile(prev => prev ? { ...prev, role: newRole } : null)
        setTimeout(() => setRoleMessage(null), 3000)
      } else {
        setRoleMessage({ type: 'error', text: data.error || 'Failed to update role' })
      }
    } catch (err) {
      setRoleMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setRoleUpdating(false)
    }
  }


  const handleEmailClick = (email: string) => {
    window.location.href = `mailto:${email}`
  }

  const handlePhoneClick = (number: string) => {
    window.location.href = `tel:${number.replace(/[^+\d]/g, '')}`
  }

  const handleAddressClick = (address: NonNullable<MemberProfile['addresses']>[0]) => {
    const query = encodeURIComponent(
      `${address.street1}, ${address.city}, ${address.province} ${address.postalCode}, ${address.country}`
    )
    window.open(`https://maps.google.com/?q=${query}`, '_blank')
  }

  const handleConnect = async () => {
    const res = await fetch('/api/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: profile!.email }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to send connection request')
    }
  }

  const handleAcceptConnection = async () => {
    if (!profile) return
    const res = await fetch('/api/connections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterEmail: profile!.email, action: 'accept' }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to accept connection')
    }
    // Refresh profile to show updated data now that connection is active
    fetchProfile()
  }

  const handleDeclineConnection = async () => {
    const res = await fetch('/api/connections', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterEmail: profile!.email, action: 'decline' }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to decline connection')
    }
  }

  const handleSuggestEdit = async (field: EditRequestField, currentValue: string | undefined, suggestedValue: string, message?: string) => {
    const res = await fetch('/api/edit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetEmail: profile!.email,
        field,
        suggestedValue,
        currentValue,
        message,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to send edit suggestion')
    }
  }

  const startEditing = () => {
    if (!profile) return
    setEditFirstName(profile.firstName || '')
    setEditLastName(profile.lastName || '')
    setEditEcclesia(profile.ecclesia || '')
    setEditMessage(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditMessage(null)
    setEcclesiaSuggestions([])
    setShowEcclesiaDrop(false)
  }

  const handleEcclesiaInput = (text: string) => {
    setEditEcclesia(text)
    if (ecclesiaTimeoutRef.current) clearTimeout(ecclesiaTimeoutRef.current)

    if (text.length < 3) {
      setEcclesiaSuggestions([])
      setShowEcclesiaDrop(false)
      return
    }

    ecclesiaTimeoutRef.current = setTimeout(async () => {
      setEcclesiaSearching(true)
      try {
        const res = await fetch(`/api/ecclesia/search?q=${encodeURIComponent(text)}&limit=5`)
        const data = await res.json()
        if (data.success && data.data) {
          setEcclesiaSuggestions(data.data)
          setShowEcclesiaDrop(true)
        }
      } catch {
        // ignore search errors
      } finally {
        setEcclesiaSearching(false)
      }
    }, 300)
  }

  const selectEcclesia = (name: string) => {
    setEditEcclesia(name)
    setShowEcclesiaDrop(false)
    setEcclesiaSuggestions([])
  }

  const saveEdit = async () => {
    setSaving(true)
    setEditMessage(null)
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(memberId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          ecclesia: editEcclesia,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setProfile(prev => prev ? {
          ...prev,
          name: data.profile.name,
          firstName: data.profile.firstName,
          lastName: data.profile.lastName,
          ecclesia: data.profile.ecclesia,
        } : null)
        setEditing(false)
      } else {
        setEditMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch {
      setEditMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setSaving(false)
    }
  }

  // ===== Admin contact CRUD helpers =====

  const addContact = async (body: Record<string, string>) => {
    setContactSaving(true)
    setContactError(null)
    try {
      const res = await fetch(contactsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setContactError(data.error || 'Failed to add')
        return false
      }
      return true
    } catch {
      setContactError('An error occurred')
      return false
    } finally {
      setContactSaving(false)
    }
  }

  const deleteContact = async (queryParams: string) => {
    setDeletingId(queryParams)
    try {
      const res = await fetch(`${contactsUrl}?${queryParams}`, { method: 'DELETE' })
      if (res.ok) {
        fetchProfile()
      }
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  // Assist a member: change their login email (brand-new address) or promote an
  // existing verified secondary to be the login. Posts to the admin-attested
  // email-change route (no member confirmation round-trip — canEdit vouches).
  const changeLoginEmail = async (payload: { promoteEmailId?: string; email?: string; newEmail?: string }) => {
    if (!profile?.personId) return
    setLoginBusy(true)
    setLoginMessage(null)
    try {
      const res = await fetch(`/api/admin/people/${encodeURIComponent(profile.personId)}/email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        const moved: string[] = Array.isArray(data.movedTopics) ? data.movedTopics : []
        const movedText = moved.length > 0
          ? ` Moved ${moved.length} subscription${moved.length === 1 ? '' : 's'} (${moved.join(', ')}).`
          : ' No subscriptions to move.'
        setLoginMessage({ type: 'success', text: `Login changed to ${data.newEmail}.${movedText}` })
        setChangingLogin(false)
        setNewLoginEmail('')
        fetchProfile()
      } else {
        setLoginMessage({ type: 'error', text: data.error || 'Failed to change login email' })
      }
    } catch {
      setLoginMessage({ type: 'error', text: 'An error occurred' })
    } finally {
      setLoginBusy(false)
    }
  }

  const handleAddEmail = async () => {
    const ok = await addContact({ type: 'email', email: newEmail.trim() })
    if (ok) {
      setNewEmail('')
      setAddingEmail(false)
      fetchProfile()
    }
  }

  const handleAddPhone = async () => {
    const ok = await addContact({ type: 'phone', phoneType: newPhoneType, number: newPhoneNumber.trim() })
    if (ok) {
      setNewPhoneNumber('')
      setNewPhoneType('mobile')
      setAddingPhone(false)
      fetchProfile()
    }
  }

  const handleAddAddress = async () => {
    const ok = await addContact({
      type: 'address',
      addressType: newAddressType,
      street1: newStreet1.trim(),
      city: newCity.trim(),
      province: newProvince.trim(),
      postalCode: newPostalCode.trim(),
      country: newCountry.trim(),
    })
    if (ok) {
      setNewStreet1('')
      setNewCity('')
      setNewProvince('')
      setNewPostalCode('')
      setNewCountry('Canada')
      setNewAddressType('home')
      setAddingAddress(false)
      fetchProfile()
    }
  }

  const handleAddFamily = async () => {
    const ok = await addContact({
      type: 'relationship',
      targetEmail: newFamilyEmail.trim(),
      relationshipType: newRelationType,
    })
    if (ok) {
      setNewFamilyEmail('')
      setNewRelationType('spouse')
      setAddingFamily(false)
      fetchProfile()
    }
  }

  if (!isHydrated || status === 'loading' || loading) {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center" padding="$6">
            <Spinner size="large" />
            <Text fontSize="$4" theme="alt2">Loading...</Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center" padding="$6">
            <Text fontSize="$4">Please sign in to view member profiles.</Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  if (error) {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4">
            <Button icon={ArrowLeft} onPress={() => router.back()}>
              Back
            </Button>
            <Card padding="$4" backgroundColor="$red2">
              <Text fontSize="$4" color="$red10">{error}</Text>
            </Card>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  if (!profile) {
    return null
  }

  const { permissions } = profile
  const canEdit = profile.canEdit && !isOwnProfile

  // Limited profile: detailed contact info is private, but show what we know
  if (profile.isPrivate) {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4">
            <Button alignSelf="flex-start" icon={ArrowLeft} onPress={() => router.back()}>
              Back to Contact List
            </Button>

            {/* Header — show name and/or ecclesia */}
            <Card padding="$4" backgroundColor="$backgroundHover">
              <YStack gap="$2">
                <Heading size="$7">
                  {profile.name || profile.ecclesia || 'Member'}
                </Heading>
                {profile.name && profile.ecclesia ? (
                  <Text fontSize="$3" theme="alt2">{profile.ecclesia}</Text>
                ) : null}
              </YStack>
            </Card>

            <Text fontSize="$3" theme="alt2">
              Contact details are private. Use the buttons below to reach out or connect.
            </Text>

            {/* Contact actions — left-aligned */}
            <XStack gap="$2" flexWrap="wrap">
              {permissions.canRequestContact ? (
                <ContactRequestButton
                  recipientEmail={profile.email}
                  recipientName={profile.name}
                  allowedTypes={profile.availableContactMethods || ['email']}
                  onRequest={handleContactRequest}
                  requesterPhones={myPhones}
                />
              ) : null}
              <ConnectButton
                targetEmail={profile.email}
                targetName={profile.name}
                connectionStatus={profile.connectionStatus || 'none'}
                needsConnection={profile.needsConnection || false}
                onConnect={handleConnect}
                onAccept={handleAcceptConnection}
                onDecline={handleDeclineConnection}
              />
            </XStack>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Section gap={'$4'}>
        <YStack gap="$4">
          {/* Back button */}
          <Button alignSelf="flex-start" icon={ArrowLeft} onPress={() => router.back()}>
            Back to Contact List
          </Button>

          {/* Header */}
          <Card padding="$4" backgroundColor="$backgroundHover">
            {editing ? (
              <YStack gap="$3">
                <XStack gap="$2" alignItems="center">
                  <Edit3 size={20} />
                  <Text fontSize="$4" fontWeight="600">Edit Name & Ecclesia</Text>
                </XStack>
                <XStack gap="$3" flexWrap="wrap">
                  <YStack gap="$1" flex={1} minWidth={150}>
                    <Text fontSize="$2" fontWeight="600">First Name</Text>
                    <Input
                      value={editFirstName}
                      onChangeText={setEditFirstName}
                      placeholder="First name"
                      autoFocus
                    />
                  </YStack>
                  <YStack gap="$1" flex={1} minWidth={150}>
                    <Text fontSize="$2" fontWeight="600">Last Name</Text>
                    <Input
                      value={editLastName}
                      onChangeText={setEditLastName}
                      placeholder="Last name"
                    />
                  </YStack>
                </XStack>
                <YStack gap="$1" position="relative" ref={ecclesiaContainerRef as any}>
                  <Text fontSize="$2" fontWeight="600">Ecclesia</Text>
                  <XStack position="relative">
                    <Input
                      flex={1}
                      value={editEcclesia}
                      onChangeText={handleEcclesiaInput}
                      placeholder="Type ecclesia name..."
                      autoComplete="off"
                      onFocus={() => {
                        if (editEcclesia.length >= 3 && ecclesiaSuggestions.length > 0) {
                          setShowEcclesiaDrop(true)
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowEcclesiaDrop(false), 200)
                      }}
                    />
                    <XStack position="absolute" right="$2" top={0} bottom={0} alignItems="center">
                      {ecclesiaSearching ? (
                        <Spinner size="small" />
                      ) : (
                        <Search size={16} color="$gray10" />
                      )}
                    </XStack>
                  </XStack>
                  {showEcclesiaDrop && ecclesiaSuggestions.length > 0 ? (
                    <YStack
                      position="absolute"
                      top="100%"
                      left={0}
                      right={0}
                      marginTop="$1"
                      backgroundColor="$background"
                      borderWidth={1}
                      borderColor="$borderColor"
                      borderRadius="$3"
                      maxHeight={200}
                      overflow="hidden"
                      zIndex={99999}
                      elevation={5}
                    >
                      {ecclesiaSuggestions.map((s) => (
                        <Button
                          key={`${s.name}-${s.city}`}
                          chromeless
                          justifyContent="flex-start"
                          paddingHorizontal="$3"
                          paddingVertical="$2"
                          borderRadius={0}
                          hoverStyle={{ backgroundColor: '$backgroundHover' }}
                          pressStyle={{ backgroundColor: '$backgroundHover' }}
                          onPress={() => selectEcclesia(s.name)}
                        >
                          <YStack alignItems="flex-start" gap="$0.5">
                            <Text fontSize="$3" fontWeight="600">{s.name}</Text>
                            <Text fontSize="$2" theme="alt2">{s.city}, {s.province}</Text>
                          </YStack>
                        </Button>
                      ))}
                    </YStack>
                  ) : null}
                </YStack>
                {editMessage ? (
                  <Text fontSize="$3" color={editMessage.type === 'success' ? '$green10' : '$red10'}>
                    {editMessage.text}
                  </Text>
                ) : null}
                <XStack gap="$2" justifyContent="flex-end">
                  <Button icon={X} onPress={cancelEditing} disabled={saving}>
                    Cancel
                  </Button>
                  <Button icon={Save} theme="blue" onPress={saveEdit} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </XStack>
              </YStack>
            ) : (
              <YStack gap="$3">
                {permissions.canViewName ? (
                  <>
                    <XStack gap="$2" alignItems="center" flexWrap="wrap">
                      <Heading size="$7">{profile.name || 'Unknown'}</Heading>
                      {profile.privacy?.showName ? (
                        <PrivacyIndicator level={profile.privacy.showName} />
                      ) : null}
                      {isOwnProfile ? (
                        <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$blue4">
                          <Text fontSize="$2" color="$blue10" fontWeight="600">Your Profile</Text>
                        </Card>
                      ) : profile.canEdit ? (
                        <Button
                          size="$2"
                          icon={Edit3}
                          chromeless
                          circular
                          onPress={startEditing}
                        />
                      ) : (
                        <SuggestEditButton
                          targetEmail={profile.email}
                          targetName={profile.name}
                          field="name"
                          currentValue={profile.name}
                          onRequest={(value, msg) => handleSuggestEdit('name', profile.name, value, msg)}
                          iconOnly
                        />
                      )}
                    </XStack>
                    {profile.ecclesia ? (
                      <Text fontSize="$3" theme="alt2">{profile.ecclesia}</Text>
                    ) : null}
                    {profile.isDeceased ? (
                      <Text fontSize="$3" color="$gray10">This member has passed away.</Text>
                    ) : null}
                  </>
                ) : (
                  <XStack gap="$2" alignItems="center">
                    <Lock size={20} />
                    <Text fontSize="$4" theme="alt2">Name hidden</Text>
                  </XStack>
                )}

                {/* Action buttons — left-aligned */}
                <XStack gap="$2" flexWrap="wrap">
                  {isOwnProfile ? (
                    <Button
                      icon={Edit3}
                      onPress={() => router.push('/profile')}
                      theme="blue"
                    >
                      Edit Profile
                    </Button>
                  ) : null}
                  {!isOwnProfile && permissions.canRequestContact ? (
                    <ContactRequestButton
                      recipientEmail={profile.email}
                      recipientName={profile.name}
                      allowedTypes={profile.availableContactMethods || ['email']}
                      onRequest={handleContactRequest}
                      requesterPhones={myPhones}
                    />
                  ) : null}
                  {!isOwnProfile ? (
                    <ConnectButton
                      targetEmail={profile.email}
                      targetName={profile.name}
                      connectionStatus={profile.connectionStatus || 'none'}
                      needsConnection={profile.needsConnection || false}
                      onConnect={handleConnect}
                      onAccept={handleAcceptConnection}
                      onDecline={handleDeclineConnection}
                    />
                  ) : null}
                </XStack>
              </YStack>
            )}
          </Card>

          {/* Set Role - for Owner/Admin viewers */}
          {profile.canSetRole && profile.allowedRoles && !isOwnProfile ? (
            <Card padding="$4" backgroundColor="$backgroundHover">
              <XStack gap="$3" alignItems="center" flexWrap="wrap">
                <XStack gap="$2" alignItems="center">
                  <Shield size={20} />
                  <Text fontSize="$4" fontWeight="600">Role</Text>
                </XStack>
                <Select
                  value={profile.role || 'guest'}
                  onValueChange={handleSetRole}
                  disablePreventBodyScroll
                >
                  <Select.Trigger width={180} iconAfter={ChevronDown} disabled={roleUpdating}>
                    <Select.Value placeholder="Select role" />
                  </Select.Trigger>

                  <Adapt when="sm" platform="touch">
                    <Sheet
                      modal
                      dismissOnSnapToBottom
                      snapPoints={[30]}
                    >
                      <Sheet.Frame>
                        <Sheet.ScrollView>
                          <Adapt.Contents />
                        </Sheet.ScrollView>
                      </Sheet.Frame>
                      <Sheet.Overlay />
                    </Sheet>
                  </Adapt>

                  <Select.Content zIndex={200000}>
                    <Select.ScrollUpButton alignItems="center" justifyContent="center" height="$3">
                      <ChevronUp size={20} />
                    </Select.ScrollUpButton>
                    <Select.Viewport>
                      <Select.Group>
                        {profile.allowedRoles.map((role, index) => (
                          <Select.Item key={role} index={index} value={role}>
                            <Select.ItemText>{role.charAt(0).toUpperCase() + role.slice(1)}</Select.ItemText>
                            <Select.ItemIndicator marginLeft="auto">
                              <Check size={16} />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton alignItems="center" justifyContent="center" height="$3">
                      <ChevronDown size={20} />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select>
                {roleUpdating ? <Spinner size="small" /> : null}
                {roleMessage ? (
                  <Text
                    fontSize="$3"
                    color={roleMessage.type === 'success' ? '$green10' : '$red10'}
                  >
                    {roleMessage.text}
                  </Text>
                ) : null}
              </XStack>
            </Card>
          ) : null}

          {/* Managed Regions — for Owner viewing an Admin (multi-tenant only) */}
          {multiTenantEnabled && profile.canSetRole && (profile.role === 'admin' || profile.role === 'owner') && !isOwnProfile ? (
            <ManagedRegionsCard
              person={{ managedRegions: profile.managedRegions, role: profile.role }}
              regionOptions={getRegionOptions()}
              canEdit={profile.allowedRoles?.includes('owner') || false}
              onSave={async (managedRegions) => {
                const res = await fetch(`/api/admin/people/${encodeURIComponent(profile.personId || '')}/managed-regions`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ managedRegions }),
                })
                if (!res.ok) {
                  const data = await res.json()
                  throw new Error(data.error || 'Failed to save')
                }
                setProfile((prev) => prev ? { ...prev, managedRegions } : null)
              }}
            />
          ) : null}

          {/* Email */}
          <Separator />
          {permissions.canViewEmail ? (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <Mail size={20} />
                <Text fontSize="$4" fontWeight="600">Email</Text>
                {profile.privacy?.showEmail ? (
                  <PrivacyIndicator level={profile.privacy.showEmail} />
                ) : null}
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} chromeless circular onPress={() => router.push('/profile')} />
                ) : null}
                {canEdit ? (
                  <Button
                    size="$2"
                    icon={Plus}
                    chromeless
                    circular
                    onPress={() => { setAddingEmail(!addingEmail); setContactError(null) }}
                  />
                ) : null}
              </XStack>
              {profile.emails && profile.emails.length > 0 ? (
                profile.emails.map((emailEntry, index) => (
                  <XStack key={index} gap="$2" alignItems="center" flexWrap="wrap">
                    <Text
                      fontSize="$4"
                      color="$blue10"
                      textDecorationLine="underline"
                      cursor="pointer"
                      onPress={() => handleEmailClick(emailEntry.email)}
                    >
                      {emailEntry.email}
                    </Text>
                    {emailEntry.emailType === 'primary' ? (
                      <Text fontSize="$2" theme="alt2">• Login</Text>
                    ) : null}
                    {canEdit && emailEntry.emailType !== 'primary' && emailEntry.verified ? (
                      <Button
                        size="$2"
                        variant="outlined"
                        disabled={loginBusy}
                        aria-label={`Set ${emailEntry.email} as login email`}
                        onPress={() =>
                          changeLoginEmail(
                            emailEntry.emailId
                              ? { promoteEmailId: emailEntry.emailId }
                              : { email: emailEntry.email }
                          )
                        }
                      >
                        Set as login email
                      </Button>
                    ) : null}
                    {canEdit && emailEntry.emailId ? (
                      <Button
                        size="$2"
                        icon={Trash2}
                        chromeless
                        circular
                        disabled={deletingId === `type=email&id=${emailEntry.emailId}`}
                        onPress={() => deleteContact(`type=email&id=${emailEntry.emailId}`)}
                      />
                    ) : !isOwnProfile ? (
                      <SuggestEditButton
                        targetEmail={profile.email}
                        targetName={profile.name}
                        field="email"
                        currentValue={emailEntry.email}
                        onRequest={(value, msg) => handleSuggestEdit('email', emailEntry.email, value, msg)}
                        iconOnly
                      />
                    ) : null}
                  </XStack>
                ))
              ) : (
                <Text
                  fontSize="$4"
                  color="$blue10"
                  textDecorationLine="underline"
                  cursor="pointer"
                  onPress={() => handleEmailClick(profile.email)}
                >
                  {profile.email}
                </Text>
              )}
              {/* Add email form */}
              {addingEmail ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <YStack gap="$2">
                    <Input
                      placeholder="Email address"
                      value={newEmail}
                      onChangeText={setNewEmail}
                      autoFocus
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {contactError ? <Text fontSize="$2" color="$red10">{contactError}</Text> : null}
                    <XStack gap="$2" justifyContent="flex-end">
                      <Button size="$3" icon={X} onPress={() => { setAddingEmail(false); setContactError(null) }} disabled={contactSaving}>
                        Cancel
                      </Button>
                      <Button size="$3" theme="blue" onPress={handleAddEmail} disabled={contactSaving || !newEmail.includes('@')}>
                        {contactSaving ? 'Adding...' : 'Add'}
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              ) : null}
              {/* Assist a member: change their sign-in (login) email on their behalf */}
              {canEdit && profile.personId ? (
                <YStack gap="$2">
                  {changingLogin ? (
                    <Card padding="$3" backgroundColor="$backgroundHover">
                      <YStack gap="$2">
                        <Text fontSize="$3" fontWeight="600">Change login email</Text>
                        <Text fontSize="$2" theme="alt2">
                          Set this member&apos;s sign-in email to a new address. Their email
                          subscriptions move with it and the old address is notified.
                        </Text>
                        <Input
                          placeholder="New login email"
                          value={newLoginEmail}
                          onChangeText={setNewLoginEmail}
                          autoFocus
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        <XStack gap="$2" justifyContent="flex-end">
                          <Button
                            size="$3"
                            icon={X}
                            variant="outlined"
                            onPress={() => { setChangingLogin(false); setNewLoginEmail(''); setLoginMessage(null) }}
                            disabled={loginBusy}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="$3"
                            variant="action"
                            onPress={() => changeLoginEmail({ newEmail: newLoginEmail.trim() })}
                            disabled={loginBusy || !newLoginEmail.includes('@')}
                          >
                            {loginBusy ? 'Changing...' : 'Change login'}
                          </Button>
                        </XStack>
                      </YStack>
                    </Card>
                  ) : (
                    <Button
                      size="$2"
                      variant="outlined"
                      alignSelf="flex-start"
                      onPress={() => { setChangingLogin(true); setLoginMessage(null) }}
                    >
                      Change login email
                    </Button>
                  )}
                  {loginMessage ? (
                    <Text fontSize="$3" color={loginMessage.type === 'success' ? '$green10' : '$red10'}>
                      {loginMessage.text}
                    </Text>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>
          ) : (
            <XStack gap="$2" alignItems="center">
              <Lock size={16} />
              <Mail size={16} color="$gray10" />
              <Text fontSize="$3" theme="alt2">Email hidden</Text>
            </XStack>
          )}

          {/* Phone Numbers */}
          <Separator />
          {permissions.canViewPhone ? (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <Phone size={20} />
                <Text fontSize="$4" fontWeight="600">Phone</Text>
                {profile.privacy?.showPhone ? (
                  <PrivacyIndicator level={profile.privacy.showPhone} />
                ) : null}
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} chromeless circular onPress={() => router.push('/profile')} />
                ) : null}
                {canEdit ? (
                  <Button
                    size="$2"
                    icon={Plus}
                    chromeless
                    circular
                    onPress={() => { setAddingPhone(!addingPhone); setContactError(null) }}
                  />
                ) : null}
              </XStack>
              {profile.phones && profile.phones.length > 0 ? (
                profile.phones.map((phone, index) => (
                  <XStack key={index} gap="$2" alignItems="center">
                    <Text
                      fontSize="$4"
                      color="$blue10"
                      textDecorationLine="underline"
                      cursor="pointer"
                      onPress={() => handlePhoneClick(phone.number)}
                    >
                      {phone.number}
                    </Text>
                    <Text fontSize="$2" theme="alt2">
                      {phone.type}
                      {phone.isPrimary ? ' • Primary' : ''}
                      {phone.isHousehold ? ' • Household' : ''}
                    </Text>
                    {canEdit && phone.phoneId ? (
                      <Button
                        size="$2"
                        icon={Trash2}
                        chromeless
                        circular
                        disabled={deletingId === `type=phone&id=${phone.phoneId}`}
                        onPress={() => deleteContact(`type=phone&id=${phone.phoneId}`)}
                      />
                    ) : !isOwnProfile ? (
                      <SuggestEditButton
                        targetEmail={profile.email}
                        targetName={profile.name}
                        field="phone"
                        currentValue={phone.number}
                        onRequest={(value, msg) => handleSuggestEdit('phone', phone.number, value, msg)}
                        iconOnly
                      />
                    ) : null}
                  </XStack>
                ))
              ) : (
                <Text fontSize="$3" theme="alt2">No phone numbers available.</Text>
              )}
              {/* Add phone form */}
              {addingPhone ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <YStack gap="$2">
                    <XStack gap="$2" flexWrap="wrap">
                      <Select
                        value={newPhoneType}
                        onValueChange={setNewPhoneType}
                        disablePreventBodyScroll
                      >
                        <Select.Trigger width={130} iconAfter={ChevronDown}>
                          <Select.Value placeholder="Type" />
                        </Select.Trigger>
                        <Select.Content zIndex={200000}>
                          <Select.Viewport>
                            <Select.Group>
                              {['mobile', 'home', 'work', 'other'].map((t, i) => (
                                <Select.Item key={t} index={i} value={t}>
                                  <Select.ItemText>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Group>
                          </Select.Viewport>
                        </Select.Content>
                      </Select>
                      <Input
                        flex={1}
                        minWidth={150}
                        placeholder="Phone number"
                        value={newPhoneNumber}
                        onChangeText={setNewPhoneNumber}
                        autoFocus
                        keyboardType="phone-pad"
                      />
                    </XStack>
                    {contactError ? <Text fontSize="$2" color="$red10">{contactError}</Text> : null}
                    <XStack gap="$2" justifyContent="flex-end">
                      <Button size="$3" icon={X} onPress={() => { setAddingPhone(false); setContactError(null) }} disabled={contactSaving}>
                        Cancel
                      </Button>
                      <Button size="$3" theme="blue" onPress={handleAddPhone} disabled={contactSaving || newPhoneNumber.trim().length < 7}>
                        {contactSaving ? 'Adding...' : 'Add'}
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              ) : null}
            </YStack>
          ) : (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack gap="$2" alignItems="center">
                <Lock size={16} />
                <Phone size={16} color="$gray10" />
              </XStack>
            </Card>
          )}

          {/* Addresses */}
          <Separator />
          {permissions.canViewAddress ? (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <MapPin size={20} />
                <Text fontSize="$4" fontWeight="600">Address</Text>
                {profile.privacy?.showAddress ? (
                  <PrivacyIndicator level={profile.privacy.showAddress} />
                ) : null}
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} chromeless circular onPress={() => router.push('/profile')} />
                ) : null}
                {canEdit ? (
                  <Button
                    size="$2"
                    icon={Plus}
                    chromeless
                    circular
                    onPress={() => { setAddingAddress(!addingAddress); setContactError(null) }}
                  />
                ) : null}
              </XStack>
              {profile.addresses && profile.addresses.length > 0 ? (
                profile.addresses.map((address, index) => {
                  const fullAddress = [
                    address.street1,
                    address.street2,
                    `${address.city}, ${address.province} ${address.postalCode}`,
                  ].filter(Boolean).join('\n')

                  return (
                    <YStack key={index} gap="$1">
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize="$3" fontWeight="500">
                          {address.label || address.type}
                          {address.isPrimary ? ' • Primary' : ''}
                        </Text>
                        {canEdit && address.addressId ? (
                          <Button
                            size="$2"
                            icon={Trash2}
                            chromeless
                            circular
                            disabled={deletingId === `type=address&id=${address.addressId}`}
                            onPress={() => deleteContact(`type=address&id=${address.addressId}`)}
                          />
                        ) : !isOwnProfile ? (
                          <SuggestEditButton
                            targetEmail={profile.email}
                            targetName={profile.name}
                            field="address"
                            currentValue={fullAddress}
                            onRequest={(value, msg) => handleSuggestEdit('address', fullAddress, value, msg)}
                            iconOnly
                          />
                        ) : null}
                      </XStack>
                      <Text
                        fontSize="$3"
                        color="$blue10"
                        textDecorationLine="underline"
                        cursor="pointer"
                        onPress={() => handleAddressClick(address)}
                      >
                        {address.street1}
                        {address.street2 ? `, ${address.street2}` : ''}
                        {`, ${address.city}, ${address.province} ${address.postalCode}`}
                      </Text>
                    </YStack>
                  )
                })
              ) : (
                <Text fontSize="$3" theme="alt2">No addresses available.</Text>
              )}
              {/* Add address form */}
              {addingAddress ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <YStack gap="$2">
                    <Select
                      value={newAddressType}
                      onValueChange={setNewAddressType}
                      disablePreventBodyScroll
                    >
                      <Select.Trigger width={150} iconAfter={ChevronDown}>
                        <Select.Value placeholder="Type" />
                      </Select.Trigger>
                      <Select.Content zIndex={200000}>
                        <Select.Viewport>
                          <Select.Group>
                            {['home', 'work', 'mailing', 'other'].map((t, i) => (
                              <Select.Item key={t} index={i} value={t}>
                                <Select.ItemText>{t.charAt(0).toUpperCase() + t.slice(1)}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Group>
                        </Select.Viewport>
                      </Select.Content>
                    </Select>
                    <Input
                      placeholder="Street address"
                      value={newStreet1}
                      onChangeText={setNewStreet1}
                      autoFocus
                    />
                    <XStack gap="$2" flexWrap="wrap">
                      <Input flex={1} minWidth={120} placeholder="City" value={newCity} onChangeText={setNewCity} />
                      <Input width={80} placeholder="Province" value={newProvince} onChangeText={setNewProvince} />
                      <Input width={100} placeholder="Postal code" value={newPostalCode} onChangeText={setNewPostalCode} />
                    </XStack>
                    <Input placeholder="Country" value={newCountry} onChangeText={setNewCountry} />
                    {contactError ? <Text fontSize="$2" color="$red10">{contactError}</Text> : null}
                    <XStack gap="$2" justifyContent="flex-end">
                      <Button size="$3" icon={X} onPress={() => { setAddingAddress(false); setContactError(null) }} disabled={contactSaving}>
                        Cancel
                      </Button>
                      <Button
                        size="$3"
                        theme="blue"
                        onPress={handleAddAddress}
                        disabled={contactSaving || !newStreet1.trim() || !newCity.trim() || !newProvince.trim() || !newPostalCode.trim()}
                      >
                        {contactSaving ? 'Adding...' : 'Add'}
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              ) : null}
            </YStack>
          ) : (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack gap="$2" alignItems="center">
                <Lock size={16} />
                <MapPin size={16} color="$gray10" />
              </XStack>
            </Card>
          )}

          {/* Family Members */}
          <Separator />
          {permissions.canViewFamily ? (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center">
                <Users size={20} />
                <Text fontSize="$4" fontWeight="600">Family</Text>
                {profile.privacy?.showFamily ? (
                  <PrivacyIndicator level={profile.privacy.showFamily} />
                ) : null}
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} chromeless circular onPress={() => router.push('/profile')} />
                ) : null}
                {canEdit ? (
                  <Button
                    size="$2"
                    icon={Plus}
                    chromeless
                    circular
                    onPress={() => { setAddingFamily(!addingFamily); setContactError(null) }}
                  />
                ) : null}
              </XStack>
              {profile.family && profile.family.length > 0 ? (
                profile.family.map((member, index) => (
                  <Card
                    key={index}
                    padding="$3"
                    backgroundColor="$backgroundHover"
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => router.push(`/people/${encodeURIComponent(member.personId || member.email)}`)}
                    cursor="pointer"
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack>
                        <Text fontSize="$4" fontWeight="500">
                          {member.name || 'Family Member'}
                        </Text>
                        <Text fontSize="$2" theme="alt2" textTransform="capitalize">
                          {member.relationshipType.replace('_', ' ')}
                        </Text>
                      </YStack>
                      {canEdit ? (
                        <Button
                          size="$2"
                          icon={Trash2}
                          chromeless
                          circular
                          disabled={deletingId === `type=relationship&targetEmail=${encodeURIComponent(member.email)}&relationshipType=${member.relationshipType}`}
                          onPress={(e: any) => {
                            e.stopPropagation()
                            deleteContact(`type=relationship&targetEmail=${encodeURIComponent(member.email)}&relationshipType=${member.relationshipType}`)
                          }}
                        />
                      ) : null}
                    </XStack>
                  </Card>
                ))
              ) : (
                <Text fontSize="$3" theme="alt2">No family members listed.</Text>
              )}
              {/* Add family form */}
              {addingFamily ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <YStack gap="$2">
                    <Select
                      value={newRelationType}
                      onValueChange={setNewRelationType}
                      disablePreventBodyScroll
                    >
                      <Select.Trigger width={180} iconAfter={ChevronDown}>
                        <Select.Value placeholder="Relationship" />
                      </Select.Trigger>
                      <Select.Content zIndex={200000}>
                        <Select.Viewport>
                          <Select.Group>
                            {['spouse', 'parent', 'child', 'sibling', 'grandparent', 'grandchild', 'extended_family', 'household_member'].map((t, i) => (
                              <Select.Item key={t} index={i} value={t}>
                                <Select.ItemText>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</Select.ItemText>
                              </Select.Item>
                            ))}
                          </Select.Group>
                        </Select.Viewport>
                      </Select.Content>
                    </Select>
                    <Input
                      placeholder="Family member's email"
                      value={newFamilyEmail}
                      onChangeText={setNewFamilyEmail}
                      autoFocus
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {contactError ? <Text fontSize="$2" color="$red10">{contactError}</Text> : null}
                    <XStack gap="$2" justifyContent="flex-end">
                      <Button size="$3" icon={X} onPress={() => { setAddingFamily(false); setContactError(null) }} disabled={contactSaving}>
                        Cancel
                      </Button>
                      <Button size="$3" theme="blue" onPress={handleAddFamily} disabled={contactSaving || !newFamilyEmail.includes('@')}>
                        {contactSaving ? 'Adding...' : 'Add'}
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              ) : null}
            </YStack>
          ) : (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack gap="$2" alignItems="center">
                <Lock size={16} />
                <Users size={16} color="$gray10" />
              </XStack>
            </Card>
          )}
        </YStack>
      </Section>
    </Wrapper>
  )
}
