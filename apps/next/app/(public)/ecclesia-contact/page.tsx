'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { YStack, XStack, Text, Button, Input, Card, H2, H3, Paragraph, Checkbox, Separator, View } from 'tamagui'
import { Check, Plus, Users, User, Mail } from '@tamagui/lucide-icons'

interface EcclesiaMember {
  email: string
  firstName?: string
  lastName?: string
  isRecordingBrother?: boolean
}

interface ContactInfo {
  email: string
  firstName: string
  lastName: string
  ecclesia: string
  isRecordingBrother: boolean
  subscribed: boolean
  ecclesiaMembers: EcclesiaMember[]
}

export default function EcclesiaContactPage() {
  const isHydrated = useHydrated()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
  const token = searchParams?.get('token') ?? null

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const signInAttempted = useRef(false)

  // Form state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [isRecordingBrother, setIsRecordingBrother] = useState(false)

  // Add member form
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberFirstName, setNewMemberFirstName] = useState('')
  const [newMemberLastName, setNewMemberLastName] = useState('')
  const [newMemberIsRecordingBrother, setNewMemberIsRecordingBrother] = useState(false)
  const [addingMember, setAddingMember] = useState(false)

  // Auto-sign-in: When token is present and user has no session, create a session
  useEffect(() => {
    if (!isHydrated || !token || sessionStatus === 'loading' || signInAttempted.current) return

    // Only attempt sign-in if no active session
    if (sessionStatus === 'unauthenticated') {
      signInAttempted.current = true
      setSigningIn(true)

      // First fetch contact info to get the email, then sign in
      const autoSignIn = async () => {
        try {
          const res = await fetch(`/api/ecclesia-contact?token=${encodeURIComponent(token)}`)
          const data = await res.json()

          if (data.error || !data.email) {
            setSigningIn(false)
            return
          }

          // Sign in via OTP provider with ecclesia token
          const result = await signIn('otp', {
            email: data.email,
            ecclesiaToken: token,
            redirect: false,
          })

          if (result?.error) {
            console.error('Ecclesia auto-sign-in failed:', result.error)
          }
        } catch (err) {
          console.error('Ecclesia auto-sign-in error:', err)
        } finally {
          setSigningIn(false)
        }
      }

      autoSignIn()
    }
  }, [isHydrated, token, sessionStatus])

  const fetchContactInfo = async () => {
    if (!token) {
      setError('No token provided. Please use the link from your email.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/ecclesia-contact?token=${encodeURIComponent(token)}`)
      const data = await res.json()

      if (data.error) {
        setError(data.expired
          ? 'This link has expired. Please contact the sender for a new link.'
          : data.error
        )
      } else {
        setContactInfo(data)
        setFirstName(data.firstName || '')
        setLastName(data.lastName || '')
        setIsRecordingBrother(data.isRecordingBrother || false)
      }
    } catch (err) {
      setError('Failed to load contact information')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContactInfo()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/ecclesia-contact?token=${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          isRecordingBrother
        }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setSuccess('Contact information updated successfully!')
        // Refresh to get updated ecclesia members list
        await fetchContactInfo()
      }
    } catch (err) {
      setError('Failed to update contact information')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !newMemberEmail) return

    setAddingMember(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/ecclesia-contact?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMemberEmail,
          firstName: newMemberFirstName,
          lastName: newMemberLastName,
          isRecordingBrother: newMemberIsRecordingBrother
        }),
      })

      const data = await res.json()

      if (data.error) {
        setError(data.error)
      } else {
        setSuccess(`${newMemberEmail} has been added to ${contactInfo?.ecclesia}!`)
        // Clear form and refresh
        setNewMemberEmail('')
        setNewMemberFirstName('')
        setNewMemberLastName('')
        setNewMemberIsRecordingBrother(false)
        setShowAddMember(false)
        await fetchContactInfo()
      }
    } catch (err) {
      setError('Failed to add ecclesia member')
      console.error(err)
    } finally {
      setAddingMember(false)
    }
  }

  if (!isHydrated) {
    return <Loading />
  }

  if (signingIn) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Loading />
        <Text marginTop="$4">Setting up your session...</Text>
      </YStack>
    )
  }

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Loading />
        <Text marginTop="$4">Loading your contact information...</Text>
      </YStack>
    )
  }

  if (error && !contactInfo) {
    return (
      <YStack flex={1} padding="$4" maxWidth={600} marginHorizontal="auto" backgroundColor="#FEFEFE">
        <View padding="$4" backgroundColor="#FFEBEE" borderRadius="$4" borderColor="#C62828" borderWidth={1}>
          <H2 color="#C62828" marginBottom="$2">Unable to Load Contact Info</H2>
          <Paragraph color="#C62828">{error}</Paragraph>
          <Paragraph marginTop="$4" color="#4A4A4A">
            If you need assistance, please reply to any inter-ecclesia email you have received.
          </Paragraph>
        </View>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" maxWidth={700} marginHorizontal="auto" gap="$4" backgroundColor="#FEFEFE">
      {/* Header with Ecclesia Name */}
      <YStack gap="$2">
        <H2 color="#1B365D">{contactInfo?.ecclesia || 'Inter-Ecclesia Contact'}</H2>
        <Text color="#4A4A4A">Update your contact information for inter-ecclesia communications</Text>
      </YStack>

      {/* Your Info Card */}
      <Card padding="$4" backgroundColor="#FFFFFF" borderColor="#D0CFC4" borderWidth={1}>
        <form onSubmit={handleSubmit}>
          <YStack gap="$4">
            <XStack gap="$2" alignItems="center">
              <User size={20} color="#1B365D" />
              <Text fontSize="$5" fontWeight="600" color="#1A1A1A">Your Information</Text>
            </XStack>

            {/* Email - Read Only */}
            <YStack gap="$2">
              <Text fontWeight="600" color="#1A1A1A">Email Address</Text>
              <View padding="$3" backgroundColor="#F2F0E8" borderRadius="$3" borderWidth={1} borderColor="#D0CFC4">
                <Text color="#4A4A4A">{contactInfo?.email}</Text>
              </View>
            </YStack>

            {/* Name Fields */}
            <XStack gap="$3" flexWrap="wrap">
              <YStack gap="$2" flex={1} minWidth={200}>
                <Text fontWeight="600" color="#1A1A1A">First Name (Optional)</Text>
                <Input
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Your first name"
                  size="$4"
                  backgroundColor="#FFFFFF"
                  borderColor="#D0CFC4"
                  color="#1A1A1A"
                  placeholderTextColor="#6B6B6B"
                />
              </YStack>
              <YStack gap="$2" flex={1} minWidth={200}>
                <Text fontWeight="600" color="#1A1A1A">Last Name (Optional)</Text>
                <Input
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Your last name"
                  size="$4"
                  backgroundColor="#FFFFFF"
                  borderColor="#D0CFC4"
                  color="#1A1A1A"
                  placeholderTextColor="#6B6B6B"
                />
              </YStack>
            </XStack>

            {/* Recording Brother Checkbox */}
            <XStack gap="$3" alignItems="center">
              <Checkbox
                checked={isRecordingBrother}
                onCheckedChange={(checked) => setIsRecordingBrother(checked === true)}
                size="$5"
                backgroundColor={isRecordingBrother ? '#1B365D' : '#FFFFFF'}
                borderColor="#1B365D"
                borderWidth={2}
              >
                <Checkbox.Indicator>
                  <Check size={16} color="#FFFFFF" />
                </Checkbox.Indicator>
              </Checkbox>
              <YStack>
                <Text fontWeight="600" color="#1A1A1A">I am the Recording Brother</Text>
                <Text fontSize="$2" color="#4A4A4A">
                  Check this if you are the primary contact for your ecclesia
                </Text>
              </YStack>
            </XStack>

            {error ? (
              <View padding="$3" backgroundColor="#FFEBEE" borderRadius="$3" borderColor="#C62828" borderWidth={1}>
                <Text color="#C62828">{error}</Text>
              </View>
            ) : null}

            {success ? (
              <View padding="$3" backgroundColor="#E8F5E9" borderRadius="$3" borderColor="#2D7D32" borderWidth={1}>
                <Text color="#2D7D32">{success}</Text>
              </View>
            ) : null}

            <Button
              onPress={handleSubmit as any}
              disabled={saving}
              backgroundColor="#1B365D"
              pressStyle={{ backgroundColor: '#153056' }}
              hoverStyle={{ backgroundColor: '#2A4A73' }}
              disabledStyle={{ backgroundColor: '#A8A8A8' }}
            >
              <Text color="#FFFFFF">{saving ? 'Saving...' : 'Save My Information'}</Text>
            </Button>
          </YStack>
        </form>
      </Card>

      {/* Ecclesia Members Card - Only show if ecclesia is set */}
      {contactInfo?.ecclesia ? (
        <Card padding="$4" backgroundColor="#FFFFFF" borderColor="#D0CFC4" borderWidth={1}>
          <YStack gap="$4">
            <XStack gap="$2" alignItems="center" justifyContent="space-between" flexWrap="wrap">
              <XStack gap="$2" alignItems="center">
                <Users size={20} color="#1B365D" />
                <Text fontSize="$5" fontWeight="600" color="#1A1A1A">{contactInfo?.ecclesia} Members</Text>
              </XStack>
              <Button
                size="$3"
                icon={Plus}
                onPress={() => setShowAddMember(!showAddMember)}
                backgroundColor={showAddMember ? '#6B6B6B' : '#1B365D'}
                pressStyle={{ backgroundColor: showAddMember ? '#4A4A4A' : '#153056' }}
                hoverStyle={{ backgroundColor: showAddMember ? '#5A5A5A' : '#2A4A73' }}
              >
                <Text color="#FFFFFF">{showAddMember ? 'Cancel' : 'Add Member'}</Text>
              </Button>
            </XStack>

            {/* Add Member Form */}
            {showAddMember ? (
              <View padding="$4" backgroundColor="#F8F6F0" borderRadius="$4" borderColor="#D0CFC4" borderWidth={1}>
                <form onSubmit={handleAddMember}>
                  <YStack gap="$3">
                    <Text fontWeight="600" color="#1A1A1A">Add Another Member from {contactInfo?.ecclesia}</Text>

                    <YStack gap="$2">
                      <Text color="#1A1A1A">Email Address *</Text>
                      <Input
                        value={newMemberEmail}
                        onChangeText={setNewMemberEmail}
                        placeholder="email@example.com"
                        size="$4"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        backgroundColor="#FFFFFF"
                        borderColor="#D0CFC4"
                        color="#1A1A1A"
                        placeholderTextColor="#6B6B6B"
                      />
                    </YStack>

                    <XStack gap="$3" flexWrap="wrap">
                      <YStack gap="$2" flex={1} minWidth={150}>
                        <Text color="#1A1A1A">First Name</Text>
                        <Input
                          value={newMemberFirstName}
                          onChangeText={setNewMemberFirstName}
                          placeholder="First name"
                          size="$4"
                          backgroundColor="#FFFFFF"
                          borderColor="#D0CFC4"
                          color="#1A1A1A"
                          placeholderTextColor="#6B6B6B"
                        />
                      </YStack>
                      <YStack gap="$2" flex={1} minWidth={150}>
                        <Text color="#1A1A1A">Last Name</Text>
                        <Input
                          value={newMemberLastName}
                          onChangeText={setNewMemberLastName}
                          placeholder="Last name"
                          size="$4"
                          backgroundColor="#FFFFFF"
                          borderColor="#D0CFC4"
                          color="#1A1A1A"
                          placeholderTextColor="#6B6B6B"
                        />
                      </YStack>
                    </XStack>

                    <XStack gap="$3" alignItems="center">
                      <Checkbox
                        checked={newMemberIsRecordingBrother}
                        onCheckedChange={(checked) => setNewMemberIsRecordingBrother(checked === true)}
                        size="$5"
                        backgroundColor={newMemberIsRecordingBrother ? '#1B365D' : '#FFFFFF'}
                        borderColor="#1B365D"
                        borderWidth={2}
                      >
                        <Checkbox.Indicator>
                          <Check size={16} color="#FFFFFF" />
                        </Checkbox.Indicator>
                      </Checkbox>
                      <Text color="#1A1A1A">This person is the Recording Brother</Text>
                    </XStack>

                    <Button
                      onPress={handleAddMember as any}
                      disabled={addingMember || !newMemberEmail}
                      backgroundColor="#2D7D32"
                      pressStyle={{ backgroundColor: '#1B5E20' }}
                      hoverStyle={{ backgroundColor: '#388E3C' }}
                      disabledStyle={{ backgroundColor: '#A8A8A8' }}
                    >
                      <Text color="#FFFFFF">{addingMember ? 'Adding...' : 'Add Member'}</Text>
                    </Button>
                  </YStack>
                </form>
              </View>
            ) : null}

            {/* Member List */}
            {contactInfo?.ecclesiaMembers && contactInfo.ecclesiaMembers.length > 0 ? (
              <YStack gap="$2">
                {contactInfo.ecclesiaMembers.map((member) => (
                  <View key={member.email} padding="$3" backgroundColor="#F8F6F0" borderRadius="$3" borderWidth={1} borderColor="#E8E6DD">
                    <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
                      <YStack>
                        <XStack gap="$2" alignItems="center">
                          <Mail size={14} color="#4A4A4A" />
                          <Text fontWeight="500" color="#1A1A1A">{member.email}</Text>
                        </XStack>
                        {(member.firstName || member.lastName) ? (
                          <Text color="#4A4A4A" marginLeft="$5">
                            {[member.firstName, member.lastName].filter(Boolean).join(' ')}
                          </Text>
                        ) : null}
                      </YStack>
                      {member.isRecordingBrother ? (
                        <View paddingHorizontal="$2" paddingVertical="$1" backgroundColor="#1B365D" borderRadius="$2">
                          <Text fontSize="$2" color="#FFFFFF" fontWeight="600">
                            Recording Brother
                          </Text>
                        </View>
                      ) : null}
                    </XStack>
                  </View>
                ))}
              </YStack>
            ) : (
              <Text color="#4A4A4A" textAlign="center" padding="$4">
                No other members from {contactInfo?.ecclesia} yet.
                {'\n'}Use "Add Member" to add colleagues who should receive inter-ecclesia emails.
              </Text>
            )}
          </YStack>
        </Card>
      ) : null}

      {/* Info Card */}
      <View padding="$4" backgroundColor="#F8F6F0" borderRadius="$4" borderWidth={1} borderColor="#E8E6DD">
        <YStack gap="$2">
          <Text fontWeight="600" color="#1A1A1A">About Inter-Ecclesia Communications</Text>
          <Paragraph fontSize="$3" color="#4A4A4A">
            You are receiving inter-ecclesia communications as a contact for your ecclesia.
            These emails contain announcements that may be relevant to share with your ecclesia members.
          </Paragraph>
          <Paragraph fontSize="$3" color="#4A4A4A" marginTop="$2">
            To reply to an announcement or ask questions, simply reply to the email -
            your message will go directly to the sender.
          </Paragraph>
        </YStack>
      </View>
    </YStack>
  )
}
