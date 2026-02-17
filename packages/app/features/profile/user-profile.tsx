'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Section, Text, YStack, XStack, Heading, Separator, Spinner, Tabs } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { AddressList } from '@my/ui/src/profile/address-list'
import { PhoneManager, type PhoneEntry } from '@my/ui/src/profile/phone-manager'
import { EmailManager, type EmailEntry } from '@my/ui/src/profile/email-manager'
import { FamilyMembers, type AddFamilyMemberData } from '@my/ui/src/profile/family-members'
import { ConnectionsList } from '@my/ui/src/profile/connections-list'
import { PrivacySettings } from '@my/ui/src/profile/privacy-settings'
import { ContactRequestsList } from '@my/ui/src/profile/contact-requests-list'
import type { AddressType, PhoneType, RelationshipType, VisibilityLevel } from '@my/app/provider/dynamodb/types'

interface UserProfileProps {
  userEmail: string
  userName?: string
  userRole?: string
  userEcclesia?: string
}

interface Address {
  addressId: string
  type: AddressType
  label?: string
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country: string
  isPrimary: boolean
  isHousehold: boolean
}


interface FamilyMember {
  email: string
  name?: string
  relationshipType: RelationshipType
  status?: string
  createdAt?: string
}

interface Connection {
  targetEmail: string
  status: 'active' | 'pending' | 'blocked'
  createdAt: string
}

interface PrivacySettingsData {
  showName: VisibilityLevel
  showPhone: VisibilityLevel
  showAddress: VisibilityLevel
  showEmail: VisibilityLevel
  showFamily: VisibilityLevel
  allowContactRequests: boolean
  preferredContactMethod: 'email' | 'phone' | 'either'
}

interface ContactRequest {
  requestId: string
  requesterEmail: string
  requestType: 'phone' | 'email' | 'text'
  reason?: 'personal' | 'ecclesial'
  message?: string
  status: 'pending' | 'viewed' | 'responded' | 'declined'
  createdAt: string
}

export const UserProfile: React.FC<UserProfileProps> = ({
  userEmail,
  userName,
  userRole,
  userEcclesia,
}) => {
  const [loading, setLoading] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [phones, setPhones] = useState<PhoneEntry[]>([])
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [savingPhones, setSavingPhones] = useState(false)
  const [savingEmails, setSavingEmails] = useState(false)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const [privacySettings, setPrivacySettings] = useState<PrivacySettingsData | null>(null)
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([])
  const [activeTab, setActiveTab] = useState('contact')

  // Fetch all user data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [addressesRes, phonesRes, emailsRes, relationshipsRes, connectionsRes, privacyRes, requestsRes] = await Promise.all([
        fetch('/api/user/addresses'),
        fetch('/api/user/phones'),
        fetch('/api/user/emails'),
        fetch('/api/user/relationships'),
        fetch('/api/user/connections'),
        fetch('/api/user/privacy'),
        fetch('/api/contact-requests'),
      ])

      if (addressesRes.ok) {
        const data = await addressesRes.json()
        setAddresses(data.addresses || [])
      }

      if (phonesRes.ok) {
        const data = await phonesRes.json()
        // Transform API response to PhoneEntry format
        const phoneEntries: PhoneEntry[] = (data.phones || []).map((p: any) => ({
          id: p.id,
          type: p.type,
          number: p.number,
        }))
        setPhones(phoneEntries)
      }

      if (emailsRes.ok) {
        const data = await emailsRes.json()
        setEmails(data.emails || [])
      }

      if (relationshipsRes.ok) {
        const data = await relationshipsRes.json()
        setFamilyMembers(data.relationships || [])
      }

      if (connectionsRes.ok) {
        const data = await connectionsRes.json()
        setConnections(data.connections || [])
        setBlockedUsers(data.blocked || [])
      }

      if (privacyRes.ok) {
        const data = await privacyRes.json()
        setPrivacySettings(data.privacy)
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setContactRequests(data.requests || [])
      }
    } catch (error) {
      console.error('Error fetching user data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Address handlers
  const handleAddAddress = async (address: Omit<Address, 'addressId'>) => {
    const res = await fetch('/api/user/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(address),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleUpdateAddress = async (addressId: string, updates: Partial<Address>) => {
    const res = await fetch('/api/user/addresses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId, ...updates }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    const res = await fetch(`/api/user/addresses?addressId=${addressId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchData()
    }
  }

  // Phone handlers for PhoneManager
  const handleSavePhones = async () => {
    setSavingPhones(true)
    try {
      const res = await fetch('/api/user/phones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phones: phones.map(p => ({
            id: p.id,
            type: p.type,
            number: p.number,
          })),
        }),
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setSavingPhones(false)
    }
  }

  // Email handlers for EmailManager
  const handleSaveEmails = async () => {
    setSavingEmails(true)
    try {
      const res = await fetch('/api/user/emails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emails.map(e => ({
            id: e.id,
            email: e.email,
            verified: e.verified,
            isPrimary: e.isPrimary,
          })),
        }),
      })
      if (res.ok) {
        await fetchData()
      }
    } finally {
      setSavingEmails(false)
    }
  }

  const handleSendVerification = async (emailId: string) => {
    const res = await fetch('/api/user/emails/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  // Family handlers
  const handleAddFamilyMember = async (data: AddFamilyMemberData) => {
    const res = await fetch('/api/user/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleLookupEmail = async (email: string): Promise<{ found: boolean; firstName?: string; lastName?: string } | null> => {
    try {
      const res = await fetch(`/api/user/lookup?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        return data
      }
      return { found: false }
    } catch {
      return { found: false }
    }
  }

  const handleRemoveFamilyMember = async (targetEmail: string, relationshipType: RelationshipType) => {
    const res = await fetch(`/api/user/relationships?targetEmail=${encodeURIComponent(targetEmail)}&relationshipType=${relationshipType}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchData()
    }
  }

  // Connection handlers
  const handleAddConnection = async (targetEmail: string) => {
    const res = await fetch('/api/user/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleRemoveConnection = async (targetEmail: string) => {
    const res = await fetch(`/api/user/connections?targetEmail=${encodeURIComponent(targetEmail)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleBlockUser = async (targetEmail: string) => {
    const res = await fetch('/api/user/connections/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleUnblockUser = async (targetEmail: string) => {
    const res = await fetch(`/api/user/connections/block?targetEmail=${encodeURIComponent(targetEmail)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchData()
    }
  }

  // Privacy handlers
  const handleSavePrivacy = async (updates: Partial<PrivacySettingsData>) => {
    const res = await fetch('/api/user/privacy', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  // Contact request handlers
  const handleMarkViewed = async (requestId: string) => {
    const res = await fetch(`/api/contact-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'viewed' }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleRespond = async (requestId: string) => {
    const res = await fetch(`/api/contact-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'responded' }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleDecline = async (requestId: string) => {
    const res = await fetch(`/api/contact-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
    if (res.ok) {
      await fetchData()
    }
  }

  const handleDeleteRequest = async (requestId: string) => {
    const res = await fetch(`/api/contact-requests/${requestId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchData()
    }
  }

  if (loading) {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center" padding="$6">
            <Spinner size="large" />
            <Text fontSize="$4" theme="alt2">Loading profile...</Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  const pendingRequestCount = contactRequests.filter(r => r.status === 'pending').length

  return (
    <Wrapper>
      <Section gap={'$4'}>
        <YStack gap="$4">
          {/* Header */}
          <YStack gap="$2">
            <Heading size={5}>My Profile</Heading>
            <Text fontSize="$4">{userName || userEmail}</Text>
            <XStack gap="$4">
              <Text fontSize="$3" theme="alt2">Role: {userRole || 'Guest'}</Text>
              {userEcclesia ? <Text fontSize="$3" theme="alt2">Ecclesia: {userEcclesia}</Text> : null}
            </XStack>
          </YStack>

          <Separator />

          {/* Tabs */}
          <Tabs
            defaultValue="contact"
            value={activeTab}
            onValueChange={setActiveTab}
            orientation="horizontal"
            flexDirection="column"
          >
            <Tabs.List>
              <Tabs.Tab value="contact">
                <Text>Contact Info</Text>
              </Tabs.Tab>
              <Tabs.Tab value="family">
                <Text>Family</Text>
              </Tabs.Tab>
              <Tabs.Tab value="connections">
                <Text>Connections</Text>
              </Tabs.Tab>
              <Tabs.Tab value="privacy">
                <Text>Privacy</Text>
              </Tabs.Tab>
              <Tabs.Tab value="requests">
                <XStack gap="$2" alignItems="center">
                  <Text>Requests</Text>
                  {pendingRequestCount > 0 ? (
                    <Text fontSize="$2" color="$red10">({pendingRequestCount})</Text>
                  ) : null}
                </XStack>
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Content value="contact">
              <YStack gap="$6" paddingTop="$4" paddingBottom="$8">
                <EmailManager
                  emails={emails}
                  onChange={setEmails}
                  onSave={handleSaveEmails}
                  onSendVerification={handleSendVerification}
                  saving={savingEmails}
                />
                <Separator />
                <PhoneManager
                  phones={phones}
                  onChange={setPhones}
                  onSave={handleSavePhones}
                  saving={savingPhones}
                />
                <Separator />
                <AddressList
                  addresses={addresses}
                  editable
                  onAdd={handleAddAddress}
                  onUpdate={handleUpdateAddress}
                  onDelete={handleDeleteAddress}
                />
              </YStack>
            </Tabs.Content>

            <Tabs.Content value="family">
              <YStack paddingTop="$4" paddingBottom="$8">
                <FamilyMembers
                  members={familyMembers}
                  editable
                  onAdd={handleAddFamilyMember}
                  onRemove={handleRemoveFamilyMember}
                  onLookupEmail={handleLookupEmail}
                />
              </YStack>
            </Tabs.Content>

            <Tabs.Content value="connections">
              <YStack paddingTop="$4" paddingBottom="$8">
                <ConnectionsList
                  connections={connections}
                  blockedUsers={blockedUsers}
                  editable
                  onAdd={handleAddConnection}
                  onRemove={handleRemoveConnection}
                  onBlock={handleBlockUser}
                  onUnblock={handleUnblockUser}
                />
              </YStack>
            </Tabs.Content>

            <Tabs.Content value="privacy">
              <YStack paddingTop="$4" paddingBottom="$8">
                {privacySettings ? (
                  <PrivacySettings
                    settings={privacySettings}
                    editable
                    onSave={handleSavePrivacy}
                  />
                ) : null}
              </YStack>
            </Tabs.Content>

            <Tabs.Content value="requests">
              <YStack paddingTop="$4" paddingBottom="$8">
                <ContactRequestsList
                  requests={contactRequests}
                  onMarkViewed={handleMarkViewed}
                  onRespond={handleRespond}
                  onDecline={handleDecline}
                  onDelete={handleDeleteRequest}
                />
              </YStack>
            </Tabs.Content>
          </Tabs>
        </YStack>
      </Section>
    </Wrapper>
  )
}
