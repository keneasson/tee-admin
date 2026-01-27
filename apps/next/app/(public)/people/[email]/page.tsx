'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { Section, Text, YStack, XStack, Heading, Card, Button, Separator, Spinner } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { ContactRequestButton } from '@my/ui/src/profile/contact-request-button'
import { SuggestEditButton } from '@my/ui/src/profile/suggest-edit-button'
import { ArrowLeft, Phone, Mail, MapPin, Users, Lock, Edit3 } from '@tamagui/lucide-icons'
import type { ContactRequestType, EditRequestField } from '@my/app/provider/dynamodb/types'

interface MemberProfile {
  email: string
  name?: string
  ecclesia?: string
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

  const handleContactRequest = async (type: ContactRequestType, message?: string) => {
    const res = await fetch('/api/contact-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientEmail: memberEmail,
        requestType: type,
        message,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to send request')
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
                  onRequest={handleContactRequest}
                />
              ) : null}
            </XStack>
          </Card>

          {/* Email */}
          <Separator />
          {permissions.canViewEmail ? (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack justifyContent="space-between" alignItems="center">
                <XStack gap="$3" alignItems="center" flex={1}>
                  <Mail size={20} color="$blue10" />
                  <YStack flex={1}>
                    <Text fontSize="$4" fontWeight="500">{profile.email}</Text>
                  </YStack>
                </XStack>
                <XStack gap="$2">
                  {!isOwnProfile ? (
                    <>
                      <Button size="$2" onPress={() => handleEmailClick(profile.email)}>
                        Email
                      </Button>
                      <SuggestEditButton
                        targetEmail={profile.email}
                        targetName={profile.name}
                        field="email"
                        currentValue={profile.email}
                        onRequest={(value, msg) => handleSuggestEdit('email', profile.email, value, msg)}
                        iconOnly
                      />
                    </>
                  ) : (
                    <Button size="$2" icon={Edit3} onPress={() => router.push('/profile')}>
                      Edit
                    </Button>
                  )}
                </XStack>
              </XStack>
            </Card>
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
