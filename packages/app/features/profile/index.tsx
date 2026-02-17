'use client'

import {
  Section,
  Text,
  XStack,
  YStack,
  Heading,
  Button,
  FormInput,
  Separator,
  Select,
  Input,
} from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useEffect, useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { AuthSession, AuthStatus } from '@my/app/types'
import { TIMEZONE_OPTIONS, DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
// User profile type from DynamoDB
type UserProfile = {
  id?: string
  email?: string
  name?: string
  role?: string
  ecclesia?: string
  profile?: {
    fname?: string
    lname?: string
    phone?: string
    address?: string
    children?: string
  }
}
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { useHydrated } from '@my/app/hooks/use-hydrated'

interface InvitationFormData {
  firstName: string
  lastName: string
  ecclesia: string
  role: string
}

/**
 * Props for Profile component
 * Session must be passed from platform-specific wrapper
 */
export interface ProfileProps {
  session: AuthSession | null
  status: AuthStatus
}

// User preferences type
type UserPreferences = {
  timezone?: string
  useAutoTimezone?: boolean
  dateFormat?: 'long' | 'short'
  timeFormat?: '12h' | '24h'
}

export const Profile: React.FC<ProfileProps> = ({ session, status }) => {
  const isHydrated = useHydrated()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [invitationLoading, setInvitationLoading] = useState(false)
  const [invitationMessage, setInvitationMessage] = useState('')
  const [invitationError, setInvitationError] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')

  // Timezone preferences state
  const [preferences, setPreferences] = useState<UserPreferences>({
    timezone: DEFAULT_TIMEZONE,
    useAutoTimezone: false,
  })
  const [preferencesLoading, setPreferencesLoading] = useState(false)
  const [preferencesSaved, setPreferencesSaved] = useState(false)

  // Ecclesia selection state
  const [ecclesiaInput, setEcclesiaInput] = useState('')
  const [ecclesiaSaving, setEcclesiaSaving] = useState(false)
  const [ecclesiaSaved, setEcclesiaSaved] = useState(false)
  const [ecclesiaError, setEcclesiaError] = useState('')

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvitationFormData>()

  // Note: Server-side redirect handles unauthenticated users
  // This is just for additional client-side protection

  useEffect(() => {
    async function getUser() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/profile')
          if (response.ok) {
            const data = await response.json()
            setUser(data.user)
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error)
        }
      }
    }
    getUser()
  }, [session])

  // Load user preferences
  useEffect(() => {
    async function loadPreferences() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/preferences')
          if (response.ok) {
            const data = await response.json()
            setPreferences(data.preferences || { timezone: DEFAULT_TIMEZONE })
          }
        } catch (error) {
          console.error('Failed to fetch user preferences:', error)
        }
      }
    }
    loadPreferences()
  }, [session])

  // Save timezone preference
  const saveTimezonePreference = async (newTimezone: string) => {
    setPreferencesLoading(true)
    setPreferencesSaved(false)
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: newTimezone }),
      })
      if (response.ok) {
        setPreferences((prev) => ({ ...prev, timezone: newTimezone }))
        setPreferencesSaved(true)
        setTimeout(() => setPreferencesSaved(false), 3000)
      }
    } catch (error) {
      console.error('Failed to save timezone preference:', error)
    } finally {
      setPreferencesLoading(false)
    }
  }

  // Save ecclesia selection
  const saveEcclesia = async () => {
    const trimmed = ecclesiaInput.trim()
    if (!trimmed) {
      setEcclesiaError('Please enter an ecclesia name.')
      return
    }
    setEcclesiaSaving(true)
    setEcclesiaError('')
    setEcclesiaSaved(false)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ecclesia: trimmed }),
      })
      if (response.ok) {
        setUser((prev) => prev ? { ...prev, ecclesia: trimmed } : prev)
        setEcclesiaSaved(true)
        setTimeout(() => setEcclesiaSaved(false), 3000)
      } else {
        const data = await response.json()
        setEcclesiaError(data.error || 'Failed to save ecclesia.')
      }
    } catch (error) {
      console.error('Failed to save ecclesia:', error)
      setEcclesiaError('An unexpected error occurred.')
    } finally {
      setEcclesiaSaving(false)
    }
  }

  // Check if user can create invitation codes
  const canCreateInvitations =
    session?.user?.role && [ROLES.MEMBER, ROLES.ADMIN, ROLES.OWNER].includes(session.user.role)

  const onSubmitInvitation: SubmitHandler<InvitationFormData> = async (data) => {
    setInvitationLoading(true)
    setInvitationError('')
    setInvitationMessage('')
    setGeneratedCode('')

    try {
      const response = await fetch('/api/auth/create-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (response.ok) {
        setInvitationMessage(result.message)
        setGeneratedCode(result.code)
        reset() // Clear the form
      } else {
        setInvitationError(result.error || 'Failed to create invitation')
      }
    } catch (err) {
      console.error('Create invitation error:', err)
      setInvitationError('An unexpected error occurred')
    } finally {
      setInvitationLoading(false)
    }
  }

  // Don't render anything until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center">
            <Text fontSize="$4" theme="alt2">
              Loading...
            </Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center">
            <Text fontSize="$4" theme="alt2">
              Loading...
            </Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  // Don't render anything if unauthenticated (redirect will happen)
  if (status === 'unauthenticated' || !session) {
    return null
  }

  return (
    <Wrapper>
      <Section gap={'$4'}>
        <YStack gap="$6">
          {/* User Profile Section */}
          <YStack gap="$4">
            <Heading size={5}>Profile</Heading>
            <Text fontSize="$4" theme="alt2">
              Welcome, {session.user?.name || 'User'}
            </Text>
            <Text fontSize="$3" theme="alt2">
              Role: {session.user?.role || 'Guest'}
            </Text>
            {user ? <YStack gap="$2">
                {user.ecclesia ? <XStack gap="$2">
                    <Text fontWeight="bold">Ecclesia:</Text>
                    <Text>{user.ecclesia}</Text>
                  </XStack> : null}
                {user.profile?.fname ? <XStack gap="$2">
                    <Text fontWeight="bold">First Name:</Text>
                    <Text>{user.profile.fname}</Text>
                  </XStack> : null}
                {user.profile?.lname ? <XStack gap="$2">
                    <Text fontWeight="bold">Last Name:</Text>
                    <Text>{user.profile.lname}</Text>
                  </XStack> : null}
                {user.profile?.phone ? <XStack gap="$2">
                    <Text fontWeight="bold">Phone:</Text>
                    <Text>{user.profile.phone}</Text>
                  </XStack> : null}
              </YStack> : null}
          </YStack>

          {/* Ecclesia Selection Prompt */}
          {user && (!user.ecclesia || user.ecclesia === 'Unknown') ? (
            <>
              <Separator />
              <YStack
                gap="$3"
                padding="$4"
                backgroundColor="$blue2"
                borderRadius="$4"
                borderWidth={1}
                borderColor="$blue6"
              >
                <Heading size={4} color="$blue11">
                  Please select your ecclesia
                </Heading>
                <Text fontSize="$3" color="$blue11">
                  To complete your profile, please enter the name of your ecclesia below.
                </Text>
                <XStack gap="$3" alignItems="flex-end">
                  <YStack flex={1} gap="$1">
                    <Text fontWeight="600" fontSize="$2">Ecclesia Name</Text>
                    <Input
                      value={ecclesiaInput}
                      onChangeText={(val: string) => { setEcclesiaInput(val); setEcclesiaError('') }}
                      placeholder="e.g., Toronto East, Peterborough"
                      size="$4"
                    />
                  </YStack>
                  <Button
                    onPress={saveEcclesia}
                    disabled={ecclesiaSaving}
                    theme="blue"
                    size="$4"
                  >
                    {ecclesiaSaving ? 'Saving...' : 'Save'}
                  </Button>
                </XStack>
                {ecclesiaError ? (
                  <Text fontSize="$2" color="$red10">{ecclesiaError}</Text>
                ) : null}
                {ecclesiaSaved ? (
                  <Text fontSize="$2" color="$green10">Ecclesia saved!</Text>
                ) : null}
              </YStack>
            </>
          ) : null}

          {/* Timezone Preferences Section */}
          <Separator />
          <YStack gap="$4">
            <Heading size={4}>Display Preferences</Heading>
            <Text fontSize="$3" theme="alt2">
              Choose your timezone for event times in newsletters and schedules.
            </Text>

            <YStack gap="$2">
              <Text fontWeight="bold">Timezone</Text>
              <Select
                value={preferences.timezone || DEFAULT_TIMEZONE}
                onValueChange={(value) => saveTimezonePreference(value)}
                disablePreventBodyScroll
              >
                <Select.Trigger width="100%" maxWidth={350}>
                  <Select.Value placeholder="Select timezone" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Viewport>
                    {TIMEZONE_OPTIONS.map((tz, index) => (
                      <Select.Item key={tz.value} index={index} value={tz.value}>
                        <Select.ItemText>{tz.label}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select>
              {preferencesLoading ? (
                <Text fontSize="$2" theme="alt2">
                  Saving...
                </Text>
              ) : null}
              {preferencesSaved ? (
                <Text fontSize="$2" color="$green10">
                  Timezone saved!
                </Text>
              ) : null}
            </YStack>
          </YStack>

          {/* Invitation Code Creation Section */}
          {canCreateInvitations ? <>
              <Separator />
              <YStack gap="$4">
                <Heading size={4}>Invite New Users</Heading>
                <Text fontSize="$3" theme="alt2">
                  Create invitation codes for new users to join the system.
                </Text>

                <YStack gap="$4" asChild={false}>
                  <XStack gap="$3">
                    <FormInput
                      control={control}
                      name="firstName"
                      label="First Name"
                      placeholder="First Name"
                      rules={{ required: 'First name is required' }}
                      flex={1}
                    />
                    <FormInput
                      control={control}
                      name="lastName"
                      label="Last Name"
                      placeholder="Last Name"
                      rules={{ required: 'Last name is required' }}
                      flex={1}
                    />
                  </XStack>

                  <FormInput
                    control={control}
                    name="ecclesia"
                    label="Ecclesia"
                    placeholder="e.g., TEE, Peterborough"
                    rules={{ required: 'Ecclesia is required' }}
                  />

                  <FormInput
                    control={control}
                    name="role"
                    label="Role"
                    placeholder="Select role"
                    rules={{ required: 'Role is required' }}
                    defaultValue={ROLES.GUEST}
                  />

                  {/* Error and Success Messages */}
                  {invitationError ? (
                    <Text fontSize="$3" color="$red10">
                      {invitationError}
                    </Text>
                  ) : null}

                  {invitationMessage ? <Text fontSize="$3" color="$green10">
                      {invitationMessage}
                    </Text> : null}

                  {generatedCode ? <YStack gap="$2" padding="$4" backgroundColor="$green2" borderRadius="$4">
                      <Text fontSize="$4" fontWeight="bold" color="$green11">
                        Invitation Code Created!
                      </Text>
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize="$6" fontWeight="bold" fontFamily="monospace">
                          {generatedCode}
                        </Text>
                        <Button
                          size="$2"
                          onPress={() => {
                            navigator.clipboard.writeText(generatedCode)
                          }}
                        >
                          Copy
                        </Button>
                      </XStack>
                      <Text fontSize="$2" theme="alt2">
                        Share this code with the person you want to invite. It expires in 7 days.
                      </Text>
                    </YStack> : null}

                  <Button {...({ type: 'submit' } as any)} size="$4" disabled={invitationLoading} theme="blue">
                    {invitationLoading ? 'Creating...' : 'Create Invitation Code'}
                  </Button>
                </YStack>
              </YStack>
            </> : null}
        </YStack>
      </Section>
    </Wrapper>
  )
}
