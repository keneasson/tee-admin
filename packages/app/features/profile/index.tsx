'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { getUserFromLegacyDirectory } from '@my/app/provider/auth/get-user-from-legacy'
import { Wrapper } from '@my/app/provider/wrapper'
import { User } from '@my/app/types/auth'
import { Button, FormInput, Heading, Section, Separator, Text, XStack, YStack } from '@my/ui'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

interface InvitationFormData {
  firstName: string
  lastName: string
  ecclesia: string
  role: string
}

type ProfileType = {}
export const Profile: React.FC<ProfileType> = ({}) => {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isHydrated = useHydrated()

  const [user, setUser] = useState<User>()
  const [invitationLoading, setInvitationLoading] = useState(false)
  const [invitationMessage, setInvitationMessage] = useState('')
  const [invitationError, setInvitationError] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvitationFormData>()

  // Note: Server-side redirect handles unauthenticated users
  // This is just for additional client-side protection
  // @todo - this shouldn't need this as we should have the user from Dynamodb at this point.
  useEffect(() => {
    async function getUser() {
      if (session?.user?.email) {
        const user = await getUserFromLegacyDirectory({ email: session.user.email })
        if (user?.user) {
          setUser(user.user)
        }
      }
    }
    getUser()
  }, [session])

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
  if (!isHydrated || status === 'loading') {
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
            {user &&
              Object.keys(user).map((key, index) => {
                return (
                  <XStack key={index} gap="$2">
                    <Text fontWeight="bold">{key}:</Text>
                    <Text>{user[key]}</Text>
                  </XStack>
                )
              })}
          </YStack>

          {/* Invitation Code Creation Section */}
          {canCreateInvitations && (
            <>
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
                  <>
                    {/* Fixes the Text in View error in React Native */}
                    {invitationError && (
                      <Text fontSize="$3" color="$red10">
                        {invitationError}
                      </Text>
                    )}

                    {invitationMessage && (
                      <Text fontSize="$3" color="$green10">
                        {invitationMessage}
                      </Text>
                    )}

                    {generatedCode && (
                      <YStack gap="$2" padding="$4" backgroundColor="$green2" borderRadius="$4">
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
                      </YStack>
                    )}
                  </>
                  <Button type="submit" size="$4" disabled={invitationLoading} theme="blue">
                    {invitationLoading ? 'Creating...' : 'Create Invitation Code'}
                  </Button>
                </YStack>
              </YStack>
            </>
          )}
        </YStack>
      </Section>
    </Wrapper>
  )
}
