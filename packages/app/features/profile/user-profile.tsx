'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Section, Text, YStack, XStack, Heading, Separator, Spinner, Tabs, Card, Input, Button } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { AddressList } from '@my/ui/src/profile/address-list'
import { PhoneManager, movePhoneToFront, type PhoneEntry } from '@my/ui/src/profile/phone-manager'
import { EmailManager, moveEmailToFront, type EmailEntry } from '@my/ui/src/profile/email-manager'
import { FamilyMembers, type AddFamilyMemberData } from '@my/ui/src/profile/family-members'
import { ConnectionsList } from '@my/ui/src/profile/connections-list'
import { PrivacySettings } from '@my/ui/src/profile/privacy-settings'
import { ContactRequestsList } from '@my/ui/src/profile/contact-requests-list'
import { Church, Search, Pencil, Check, X } from '@tamagui/lucide-icons'
import type { AddressType, PhoneType, RelationshipType, VisibilityLevel } from '@my/app/provider/dynamodb/types'

interface UserProfileProps {
  userEmail: string
  userName?: string
  userRole?: string
  userEcclesia?: string
  onNavigateToPerson?: (personId: string) => void
  /**
   * Fired when a sensitive mutation is refused with the fresh-auth step-up gate
   * (403 `{ stepUpRequired }`). The platform layer (apps/next) mounts <Verify>
   * and, once re-verified, calls the supplied `retry` to re-run the mutation.
   * Kept as a prop because this shared package cannot import next-auth/Verify.
   */
  onStepUpRequired?: (retry: () => void) => void
  /**
   * Whether the secure change-login flow (SECURE_EMAIL_CHANGE) is available to
   * this session — resolved server-side by the platform layer and threaded down.
   * Gates the "Set as login" menu item and the login-row change pencil.
   */
  canChangeLogin?: boolean
  /** Launch the secure change-login flow (owned by the platform layer). */
  onChangeLogin?: () => void
  /** Launch the secure change-login flow pre-filled with an already-verified address. */
  onSetLogin?: (email: string) => void
  /**
   * Monotonic counter the platform layer bumps to force a re-fetch of the profile
   * lists (e.g. after a login-email promote, so the new address shows as "Login"
   * and the old one as "Retired"). Changing the value re-runs `fetchData`; the
   * initial 0 is ignored so it never double-fetches on mount.
   */
  reloadSignal?: number
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
  personId?: string
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
  allowConnectionRequests: boolean
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

/** 'Unknown' is the stored placeholder for an unset ecclesia; treat it as empty. */
const normalizeEcclesia = (value?: string): string =>
  value && value !== 'Unknown' ? value : ''

export const UserProfile: React.FC<UserProfileProps> = ({
  userEmail,
  userName,
  userRole,
  userEcclesia,
  onNavigateToPerson,
  onStepUpRequired,
  canChangeLogin = false,
  onChangeLogin,
  onSetLogin,
  reloadSignal = 0,
}) => {
  const [loading, setLoading] = useState(true)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [phones, setPhones] = useState<PhoneEntry[]>([])
  const [emails, setEmails] = useState<EmailEntry[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [blockedUsers, setBlockedUsers] = useState<string[]>([])
  const [privacySettings, setPrivacySettings] = useState<PrivacySettingsData | null>(null)
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([])
  const [activeTab, setActiveTab] = useState('contact')
  const [displayName, setDisplayName] = useState<string>(userName || '')
  // 'Unknown' is the stored sentinel for "no ecclesia set" — normalize it (and
  // any empty value) to '' everywhere so it never renders as a real ecclesia in
  // the header, the display card, or the edit field.
  const [ecclesia, setEcclesia] = useState<string>(normalizeEcclesia(userEcclesia))
  const [editingEcclesia, setEditingEcclesia] = useState(false)
  const [ecclesiaInput, setEcclesiaInput] = useState('')
  const [ecclesiaSuggestions, setEcclesiaSuggestions] = useState<Array<{ name: string; city: string; province: string }>>([])
  const [showEcclesiaDrop, setShowEcclesiaDrop] = useState(false)
  const [ecclesiaSearching, setEcclesiaSearching] = useState(false)
  const [savingEcclesia, setSavingEcclesia] = useState(false)
  const [ecclesiaError, setEcclesiaError] = useState('')
  const ecclesiaTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [firstNameInput, setFirstNameInput] = useState('')
  const [lastNameInput, setLastNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState('')

  // Fetch all user data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [addressesRes, phonesRes, emailsRes, relationshipsRes, connectionsRes, privacyRes, requestsRes, profileRes] = await Promise.all([
        fetch('/api/user/addresses'),
        fetch('/api/user/phones'),
        fetch('/api/user/emails'),
        fetch('/api/user/relationships'),
        fetch('/api/user/connections'),
        fetch('/api/user/privacy'),
        fetch('/api/contact-requests'),
        fetch('/api/user/profile'),
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

      if (profileRes.ok) {
        const data = await profileRes.json()
        if (data.user?.name) {
          setDisplayName(data.user.name)
        }
        if (data.user?.firstName) {
          setFirstName(data.user.firstName)
        }
        if (data.user?.lastName) {
          setLastName(data.user.lastName)
        }
        if (data.user?.ecclesia) {
          setEcclesia(normalizeEcclesia(data.user.ecclesia))
        }
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

  // Re-fetch when the platform layer bumps reloadSignal (e.g. after a login-email
  // promote). Skip the initial 0 so this never double-fetches on mount.
  useEffect(() => {
    if (reloadSignal > 0) fetchData()
  }, [reloadSignal, fetchData])

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

  // The fresh-auth gate (require-fresh-auth) refuses sensitive edits with a
  // 403 `{ stepUpRequired }`. Surface that to the platform layer (which mounts
  // <Verify>) rather than failing silently; on re-verify it calls `retry`.
  const handledStepUp = async (res: Response, retry: () => void): Promise<boolean> => {
    if (res.status !== 403) return false
    const body = await res.clone().json().catch(() => ({} as any))
    if (body?.stepUpRequired && onStepUpRequired) {
      onStepUpRequired(retry)
      return true
    }
    return false
  }

  // Email handlers for EmailManager — each saves in place, then refetches the
  // list so the UI reflects server state. All route a 403 { stepUpRequired }
  // through the platform step-up mechanism instead of failing silently.
  const handleAddEmail = async (email: string): Promise<boolean> => {
    const res = await fetch('/api/user/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) {
      await fetchData()
      return true
    }
    // 403 → step up and retry the ADD alone (never the delete); other errors just
    // stop. Returning false lets a rename keep the old address until the new one
    // is actually added, so a stale-session rename can't drop an address.
    await handledStepUp(res, () => { void handleAddEmail(email) })
    return false
  }

  const handleDeleteEmail = async (emailId: string) => {
    const res = await fetch(`/api/user/emails?emailId=${encodeURIComponent(emailId)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleDeleteEmail(emailId) })
  }

  // "Set as preferred" = move the address to index 0 and PUT the whole ordered
  // set (the replace-all model; first = preferred).
  const handleSetPreferred = async (emailId: string) => {
    const reordered = moveEmailToFront(emails, emailId)
    const res = await fetch('/api/user/emails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Role entries (e.g. the Recording Brother ecclesia email) are surfaced
        // read-only from the PersonRecord — they must NOT be written back into the
        // USER# email store, so exclude them from the replace-all payload.
        emails: reordered
          .filter(e => !e.roleLabel)
          .map(e => ({
            id: e.id,
            email: e.email,
            verified: e.verified,
            isPrimary: e.isPrimary,
          })),
      }),
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleSetPreferred(emailId) })
  }

  const handleSendVerification = async (emailId: string) => {
    const res = await fetch('/api/user/emails/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId }),
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleSendVerification(emailId) })
  }

  // Restore a retired (demoted former-primary) address to a permanent secondary.
  // Low-friction/session-gated on the server (no fresh step-up), but the 403 path
  // is still routed for symmetry with the other mutations.
  const handleUndoRetire = async (emailId: string) => {
    const res = await fetch('/api/user/email-change/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailId }),
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleUndoRetire(emailId) })
  }

  // Phone handlers for PhoneManager — each saves in place against the granular
  // phones endpoints, then refetches. A 403 { stepUpRequired } is routed through
  // the platform step-up mechanism (mirroring the email handlers) rather than
  // failing silently.
  const handleAddPhone = async (type: PhoneType, number: string) => {
    const res = await fetch('/api/user/phones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, number }),
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleAddPhone(type, number) })
  }

  const handleUpdatePhone = async (id: string, updates: { type?: PhoneType; number?: string }) => {
    const res = await fetch('/api/user/phones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneId: id, ...updates }),
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleUpdatePhone(id, updates) })
  }

  const handleDeletePhone = async (id: string) => {
    const res = await fetch(`/api/user/phones?phoneId=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleDeletePhone(id) })
  }

  // "Set as preferred" = move the number to index 0 and PUT the whole ordered
  // set (the replace-all model; first = preferred).
  const handleSetPreferredPhone = async (id: string) => {
    const reordered = movePhoneToFront(phones, id)
    const res = await fetch('/api/user/phones', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phones: reordered.map(p => ({
          id: p.id,
          type: p.type,
          number: p.number,
        })),
      }),
    })
    if (res.ok) {
      await fetchData()
      return
    }
    await handledStepUp(res, () => { void handleSetPreferredPhone(id) })
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

  const handleSearchPeople = async (query: string): Promise<Array<{ id: string; name: string; email: string; ecclesia?: string }>> => {
    try {
      const res = await fetch(`/api/people?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        return (data.members || []).map((m: { id: string; name: string; email: string; ecclesia?: string }) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          ecclesia: m.ecclesia,
        }))
      }
      return []
    } catch {
      return []
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
      return
    }
    await handledStepUp(res, () => { void handleSavePrivacy(updates) })
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

  // Name handlers
  const startEditingName = () => {
    setFirstNameInput(firstName)
    setLastNameInput(lastName)
    setEditingName(true)
    setNameError('')
  }

  const cancelEditingName = () => {
    setEditingName(false)
    setNameError('')
  }

  const saveName = async () => {
    if (!firstNameInput.trim() || !lastNameInput.trim()) {
      setNameError('Both first and last name are required')
      return
    }
    setSavingName(true)
    setNameError('')
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstNameInput.trim(),
          lastName: lastNameInput.trim(),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setFirstName(data.firstName)
        setLastName(data.lastName)
        setDisplayName(data.displayName)
        setEditingName(false)
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        setNameError(data.error || `Save failed (${res.status})`)
      }
    } catch {
      setNameError('Network error — please try again')
    } finally {
      setSavingName(false)
    }
  }

  // Ecclesia handlers
  const startEditingEcclesia = () => {
    setEcclesiaInput(ecclesia)
    setEditingEcclesia(true)
  }

  const cancelEditingEcclesia = () => {
    setEditingEcclesia(false)
    setEcclesiaSuggestions([])
    setShowEcclesiaDrop(false)
  }

  const handleEcclesiaInput = (text: string) => {
    setEcclesiaInput(text)
    setEcclesiaError('')
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

  const selectEcclesiaSuggestion = (name: string) => {
    setEcclesiaInput(name)
    setShowEcclesiaDrop(false)
    setEcclesiaSuggestions([])
  }

  const saveEcclesia = async () => {
    if (!ecclesiaInput.trim()) return
    setSavingEcclesia(true)
    setEcclesiaError('')
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ecclesia: ecclesiaInput.trim() }),
      })
      if (res.ok) {
        setEcclesia(ecclesiaInput.trim())
        setEditingEcclesia(false)
        setEcclesiaError('')
      } else {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        setEcclesiaError(data.error || `Save failed (${res.status})`)
      }
    } catch (err) {
      setEcclesiaError('Network error — please try again')
    } finally {
      setSavingEcclesia(false)
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
        {/* Cap the settings column so rows don't stretch edge-to-edge on wide
            viewports (the far-apart controls read as disconnected otherwise). */}
        <YStack gap="$4" width="100%" maxWidth={880} alignSelf="center">
          {/* Header */}
          <YStack gap="$2">
            <Heading size={5}>My Profile</Heading>
            <Text fontSize="$4">{displayName || userName || userEmail}</Text>
            <XStack gap="$4">
              <Text fontSize="$3" theme="alt2">Role: {userRole || 'Guest'}</Text>
              {ecclesia ? <Text fontSize="$3" theme="alt2">{ecclesia}</Text> : null}
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
              {/* Tight vertical rhythm — the sections were $6 (~24px) apart, which
                  read as miles of empty space between rows. */}
              <YStack gap="$3" paddingTop="$3" paddingBottom="$5">
                {/* Name + ecclesia grouped tight (they're one identity block). */}
                <YStack gap="$2">
                {/* Name */}
                <YStack gap="$3">
                  {editingName ? (
                    <Card padding="$3" backgroundColor="$backgroundHover">
                      <YStack gap="$3">
                        <YStack gap="$1">
                          <Text fontSize="$2" fontWeight="600">First name</Text>
                          <Input
                            value={firstNameInput}
                            onChangeText={(text) => { setFirstNameInput(text); setNameError('') }}
                            placeholder="e.g. Jane"
                            aria-label="First name"
                            autoFocus
                          />
                        </YStack>
                        <YStack gap="$1">
                          <Text fontSize="$2" fontWeight="600">Last name</Text>
                          <Input
                            value={lastNameInput}
                            onChangeText={(text) => { setLastNameInput(text); setNameError('') }}
                            placeholder="e.g. Smith"
                            aria-label="Last name"
                          />
                        </YStack>
                        {nameError ? (
                          <Text fontSize="$2" color="$red10">{nameError}</Text>
                        ) : null}
                        <XStack gap="$2" justifyContent="flex-end">
                          <Button size="$2" icon={X} onPress={cancelEditingName} disabled={savingName}>
                            Cancel
                          </Button>
                          <Button
                            size="$2"
                            icon={Check}
                            theme="blue"
                            onPress={saveName}
                            disabled={savingName || !firstNameInput.trim() || !lastNameInput.trim()}
                          >
                            {savingName ? 'Saving...' : 'Save'}
                          </Button>
                        </XStack>
                      </YStack>
                    </Card>
                  ) : (
                    <Card padding="$3" backgroundColor="$backgroundHover">
                      <XStack gap="$2" alignItems="center">
                        <XStack width={34} justifyContent="flex-start">
                          <Button size="$2" icon={Pencil} chromeless circular aria-label="Edit name" onPress={startEditingName} />
                        </XStack>
                        <Text fontSize="$4" fontWeight="500">
                          {displayName || 'No name set'}
                        </Text>
                      </XStack>
                    </Card>
                  )}
                </YStack>

                {/* Ecclesia */}
                <YStack gap="$3">
                  {editingEcclesia ? (
                    <Card padding="$3" backgroundColor="$backgroundHover">
                      <YStack gap="$2" position="relative">
                        <YStack gap="$1">
                          <Text fontSize="$2" fontWeight="600">Home ecclesia</Text>
                          <Text fontSize="$2" theme="alt2">Start typing to search the directory and select your ecclesia.</Text>
                        </YStack>
                        <XStack position="relative">
                          <Input
                            flex={1}
                            value={ecclesiaInput}
                            onChangeText={handleEcclesiaInput}
                            placeholder="e.g. Toronto East"
                            aria-label="Home ecclesia"
                            autoComplete="off"
                            autoFocus
                            onFocus={() => {
                              if (ecclesiaInput.length >= 3 && ecclesiaSuggestions.length > 0) {
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
                                onPress={() => selectEcclesiaSuggestion(s.name)}
                              >
                                <YStack alignItems="flex-start" gap="$0.5">
                                  <Text fontSize="$3" fontWeight="600">{s.name}</Text>
                                  <Text fontSize="$2" theme="alt2">{s.city}, {s.province}</Text>
                                </YStack>
                              </Button>
                            ))}
                          </YStack>
                        ) : null}
                        {ecclesiaError ? (
                          <Text fontSize="$2" color="$red10">{ecclesiaError}</Text>
                        ) : null}
                        <XStack gap="$2" justifyContent="flex-end">
                          <Button size="$2" icon={X} onPress={cancelEditingEcclesia} disabled={savingEcclesia}>
                            Cancel
                          </Button>
                          <Button size="$2" icon={Check} theme="blue" onPress={saveEcclesia} disabled={savingEcclesia || !ecclesiaInput.trim()}>
                            {savingEcclesia ? 'Saving...' : 'Save'}
                          </Button>
                        </XStack>
                      </YStack>
                    </Card>
                  ) : (
                    <Card padding="$3" backgroundColor="$backgroundHover">
                      <XStack gap="$2" alignItems="center">
                        <XStack width={34} justifyContent="flex-start">
                          <Button size="$2" icon={Pencil} chromeless circular aria-label="Edit ecclesia" onPress={startEditingEcclesia} />
                        </XStack>
                        <Text fontSize="$4" fontWeight="500">
                          {ecclesia || 'No ecclesia set'}
                        </Text>
                      </XStack>
                    </Card>
                  )}
                </YStack>
                </YStack>

                <Separator />
                <EmailManager
                  emails={emails}
                  onAddEmail={handleAddEmail}
                  onDeleteEmail={handleDeleteEmail}
                  onSendVerification={handleSendVerification}
                  onSetPreferred={handleSetPreferred}
                  onSetLogin={(email) => onSetLogin?.(email)}
                  onChangeLogin={() => onChangeLogin?.()}
                  onUndoRetire={handleUndoRetire}
                  canChangeLogin={canChangeLogin}
                />
                <Separator />
                <PhoneManager
                  phones={phones}
                  onAddPhone={handleAddPhone}
                  onUpdatePhone={handleUpdatePhone}
                  onDeletePhone={handleDeletePhone}
                  onSetPreferred={handleSetPreferredPhone}
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
              <YStack paddingTop="$4" paddingBottom="$8" gap="$4">
                {ecclesia ? (
                  <Card padding="$3" backgroundColor="$backgroundHover">
                    <XStack gap="$2" alignItems="center">
                      <Church size={16} color="$blue10" />
                      <Text fontSize="$3" theme="alt2">{ecclesia}</Text>
                    </XStack>
                  </Card>
                ) : null}
                <FamilyMembers
                  members={familyMembers}
                  editable
                  onAdd={handleAddFamilyMember}
                  onRemove={handleRemoveFamilyMember}
                  onSearchPeople={handleSearchPeople}
                  onMemberClick={onNavigateToPerson}
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
