'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Section, Text, YStack, XStack, Heading, Card, Button, Separator, Spinner, Select, Adapt, Sheet, Input } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { ContactRequestButton } from '@my/ui/src/profile/contact-request-button'
import { SuggestEditButton } from '@my/ui/src/profile/suggest-edit-button'
import { ArrowLeft, Phone, Mail, MapPin, Users, Lock, Edit3, Shield, Check, ChevronDown, ChevronUp, X, Save, Search } from '@tamagui/lucide-icons'
import type { ContactRequestType, ContactRequestReason, EditRequestField } from '@my/app/provider/dynamodb/types'

interface MemberProfile {
  email: string
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
  }
  isInterEcclesia?: boolean
  isPrivate?: boolean
  isDeceased?: boolean
  canEdit?: boolean
  availableContactMethods?: ContactRequestType[]
  role?: string
  canSetRole?: boolean
  allowedRoles?: string[]
  emails?: Array<{
    email: string
    emailType: string
  }>
  phones?: Array<{
    type: string
    number: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  addresses?: Array<{
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
    relationshipType: string
  }>
  permissions: {
    canViewName: boolean
    canViewPhone: boolean
    canViewAddress: boolean
    canViewEmail: boolean
    canViewFamily: boolean
    canRequestContact: boolean
  }
}

export default function MemberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const isHydrated = useHydrated()
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

  const memberEmail = decodeURIComponent((params?.email as string) || '')
  // Use both URL param and profile email for comparison (handles encoding issues)
  const sessionEmail = session?.user?.email?.toLowerCase() || ''
  const isOwnProfile = sessionEmail !== '' && (
    sessionEmail === memberEmail.toLowerCase() ||
    sessionEmail === profile?.email?.toLowerCase()
  )

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(memberEmail)}`)
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
  }, [memberEmail])

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
        recipientEmail: memberEmail,
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
        body: JSON.stringify({ email: memberEmail, newRole }),
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

  const handleFamilyMemberClick = (email: string) => {
    router.push(`/people/${encodeURIComponent(email)}`)
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

  const handleSuggestEdit = async (field: EditRequestField, currentValue: string | undefined, suggestedValue: string, message?: string) => {
    const res = await fetch('/api/edit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetEmail: memberEmail,
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
      const res = await fetch(`/api/people/${encodeURIComponent(memberEmail)}`, {
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

  // Limited profile: detailed contact info is private, but show what we know
  if (profile.isPrivate) {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4">
            <Button alignSelf="flex-start" icon={ArrowLeft} onPress={() => router.back()}>
              Back to Contact List
            </Button>

            {/* Header — show name and/or ecclesia, no lock */}
            <Card padding="$6" backgroundColor="$backgroundHover">
              <YStack gap="$3">
                <Heading size={4}>
                  {profile.name || profile.ecclesia || profile.email}
                </Heading>
                {profile.name && profile.ecclesia ? (
                  <Text fontSize="$3" theme="alt2">{profile.ecclesia}</Text>
                ) : null}
                {profile.ecclesiaInfo ? (
                  <XStack gap="$1" alignItems="center">
                    <MapPin size={14} color="$gray10" />
                    <Text fontSize="$3" theme="alt2">
                      {profile.ecclesiaInfo.city}, {profile.ecclesiaInfo.province}
                      {profile.ecclesiaInfo.venue ? ` \u2022 ${profile.ecclesiaInfo.venue}` : ''}
                    </Text>
                  </XStack>
                ) : null}
                {profile.ecclesiaInfo?.address ? (
                  <Text fontSize="$2" theme="alt2">{profile.ecclesiaInfo.address}</Text>
                ) : null}
              </YStack>
            </Card>

            {/* Email — already visible in the URL, just show it */}
            <Card padding="$4" backgroundColor="$backgroundHover">
              <XStack gap="$3" alignItems="center">
                <Mail size={20} color="$blue10" />
                <Text fontSize="$4" fontWeight="500">{profile.email}</Text>
                <Button size="$2" marginLeft="auto" onPress={() => { window.location.href = `mailto:${profile.email}` }}>
                  Email
                </Button>
              </XStack>
            </Card>

            <Text fontSize="$2" theme="alt2">
              Detailed contact information is not publicly shared for this member.
            </Text>
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
              <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$4">
                <YStack gap="$2" flex={1}>
                  {permissions.canViewName ? (
                    <>
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <Heading size={4}>{profile.name || 'Unknown'}</Heading>
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
                        <YStack gap="$1">
                          <Text fontSize="$3" theme="alt2">{profile.ecclesia}</Text>
                          {profile.ecclesiaInfo ? (
                            <XStack gap="$1" alignItems="center">
                              <MapPin size={12} color="$gray10" />
                              <Text fontSize="$2" theme="alt2">
                                {profile.ecclesiaInfo.city}, {profile.ecclesiaInfo.province}
                                {profile.ecclesiaInfo.venue ? ` \u2022 ${profile.ecclesiaInfo.venue}` : ''}
                              </Text>
                            </XStack>
                          ) : null}
                        </YStack>
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
                </YStack>

                {/* Only show "Edit Profile" on your OWN profile */}
                {isOwnProfile ? (
                  <Button
                    icon={Edit3}
                    onPress={() => router.push('/profile')}
                    theme="blue"
                  >
                    Edit Profile
                  </Button>
                ) : null}

                {/* Show contact request button on OTHER profiles */}
                {!isOwnProfile && permissions.canRequestContact ? (
                  <ContactRequestButton
                    recipientEmail={profile.email}
                    recipientName={profile.name}
                    allowedTypes={profile.availableContactMethods || ['email']}
                    onRequest={handleContactRequest}
                    requesterPhones={myPhones}
                  />
                ) : null}
              </XStack>
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

          {/* Email */}
          <Separator />
          {permissions.canViewEmail ? (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center" justifyContent="space-between">
                <XStack gap="$2" alignItems="center">
                  <Mail size={20} />
                  <Text fontSize="$4" fontWeight="600">Email</Text>
                </XStack>
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} onPress={() => router.push('/profile')}>
                    Edit
                  </Button>
                ) : null}
              </XStack>
              {profile.emails && profile.emails.length > 0 ? (
                profile.emails.map((emailEntry, index) => (
                  <Card key={index} padding="$3" backgroundColor="$backgroundHover">
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1}>
                        <Text fontSize="$4" fontWeight="500">{emailEntry.email}</Text>
                        <Text fontSize="$2" theme="alt2">{emailEntry.emailType}</Text>
                      </YStack>
                      {!isOwnProfile ? (
                        <XStack gap="$2">
                          <Button size="$2" onPress={() => handleEmailClick(emailEntry.email)}>
                            Email
                          </Button>
                          <SuggestEditButton
                            targetEmail={profile.email}
                            targetName={profile.name}
                            field="email"
                            currentValue={emailEntry.email}
                            onRequest={(value, msg) => handleSuggestEdit('email', emailEntry.email, value, msg)}
                            iconOnly
                          />
                        </XStack>
                      ) : null}
                    </XStack>
                  </Card>
                ))
              ) : (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <XStack justifyContent="space-between" alignItems="center">
                    <XStack gap="$3" alignItems="center" flex={1}>
                      <Mail size={20} color="$blue10" />
                      <Text fontSize="$4" fontWeight="500">{profile.email}</Text>
                    </XStack>
                    {!isOwnProfile ? (
                      <Button size="$2" onPress={() => handleEmailClick(profile.email)}>
                        Email
                      </Button>
                    ) : null}
                  </XStack>
                </Card>
              )}
            </YStack>
          ) : (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack gap="$2" alignItems="center">
                <Lock size={16} />
                <Mail size={16} color="$gray10" />
              </XStack>
            </Card>
          )}

          {/* Phone Numbers */}
          <Separator />
          {permissions.canViewPhone ? (
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center" justifyContent="space-between">
                <XStack gap="$2" alignItems="center">
                  <Phone size={20} />
                  <Text fontSize="$4" fontWeight="600">Phone</Text>
                </XStack>
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} onPress={() => router.push('/profile')}>
                    Edit
                  </Button>
                ) : null}
              </XStack>
              {profile.phones && profile.phones.length > 0 ? (
                profile.phones.map((phone, index) => (
                  <Card key={index} padding="$3" backgroundColor="$backgroundHover">
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack flex={1}>
                        <Text fontSize="$4" fontWeight="500">{phone.number}</Text>
                        <Text fontSize="$2" theme="alt2">
                          {phone.type}
                          {phone.isPrimary ? ' • Primary' : ''}
                          {phone.isHousehold ? ' • Household' : ''}
                        </Text>
                      </YStack>
                      {!isOwnProfile ? (
                        <XStack gap="$2">
                          <Button size="$2" onPress={() => handlePhoneClick(phone.number)}>
                            Call
                          </Button>
                          <SuggestEditButton
                            targetEmail={profile.email}
                            targetName={profile.name}
                            field="phone"
                            currentValue={phone.number}
                            onRequest={(value, msg) => handleSuggestEdit('phone', phone.number, value, msg)}
                            iconOnly
                          />
                        </XStack>
                      ) : null}
                    </XStack>
                  </Card>
                ))
              ) : (
                <Text fontSize="$3" theme="alt2">No phone numbers available.</Text>
              )}
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
              <XStack gap="$2" alignItems="center" justifyContent="space-between">
                <XStack gap="$2" alignItems="center">
                  <MapPin size={20} />
                  <Text fontSize="$4" fontWeight="600">Address</Text>
                </XStack>
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} onPress={() => router.push('/profile')}>
                    Edit
                  </Button>
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
                    <Card key={index} padding="$3" backgroundColor="$backgroundHover">
                      <XStack justifyContent="space-between" alignItems="flex-start">
                        <YStack gap="$1" flex={1}>
                          <Text fontSize="$3" fontWeight="500">
                            {address.label || address.type}
                            {address.isPrimary ? ' • Primary' : ''}
                          </Text>
                          <Text fontSize="$3">{address.street1}</Text>
                          {address.street2 ? <Text fontSize="$3">{address.street2}</Text> : null}
                          <Text fontSize="$3">
                            {address.city}, {address.province} {address.postalCode}
                          </Text>
                        </YStack>
                        {!isOwnProfile ? (
                          <XStack gap="$2">
                            <Button size="$2" onPress={() => handleAddressClick(address)}>
                              Map
                            </Button>
                            <SuggestEditButton
                              targetEmail={profile.email}
                              targetName={profile.name}
                              field="address"
                              currentValue={fullAddress}
                              onRequest={(value, msg) => handleSuggestEdit('address', fullAddress, value, msg)}
                              iconOnly
                            />
                          </XStack>
                        ) : null}
                      </XStack>
                    </Card>
                  )
                })
              ) : (
                <Text fontSize="$3" theme="alt2">No addresses available.</Text>
              )}
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
              <XStack gap="$2" alignItems="center" justifyContent="space-between">
                <XStack gap="$2" alignItems="center">
                  <Users size={20} />
                  <Text fontSize="$4" fontWeight="600">Family</Text>
                </XStack>
                {isOwnProfile ? (
                  <Button size="$2" icon={Edit3} onPress={() => router.push('/profile')}>
                    Edit
                  </Button>
                ) : null}
              </XStack>
              {profile.family && profile.family.length > 0 ? (
                profile.family.map((member, index) => (
                  <Card
                    key={index}
                    padding="$3"
                    backgroundColor="$backgroundHover"
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => handleFamilyMemberClick(member.email)}
                    cursor="pointer"
                  >
                    <XStack justifyContent="space-between" alignItems="center">
                      <YStack>
                        <Text fontSize="$4" fontWeight="500">
                          {member.name || member.email}
                        </Text>
                        <Text fontSize="$2" theme="alt2" textTransform="capitalize">
                          {member.relationshipType.replace('_', ' ')}
                        </Text>
                      </YStack>
                    </XStack>
                  </Card>
                ))
              ) : (
                <Text fontSize="$3" theme="alt2">No family members listed.</Text>
              )}
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
