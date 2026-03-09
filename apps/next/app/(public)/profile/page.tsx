'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserProfile } from '@my/app/features/profile/user-profile'
import { Section, Text, YStack, Spinner } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isHydrated = useHydrated()

  if (!isHydrated || status === 'loading') {
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

  if (status === 'unauthenticated' || !session?.user?.email) {
    return (
      <Wrapper>
        <Section gap={'$4'}>
          <YStack gap="$4" alignItems="center" padding="$6">
            <Text fontSize="$4">Please sign in to view your profile.</Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  return (
    <UserProfile
      userEmail={session.user.email}
      userName={session.user.name || undefined}
      userRole={session.user.role || undefined}
      userEcclesia={(session.user as any).ecclesia || undefined}
      onNavigateToPerson={(personId) => router.push(`/people/${encodeURIComponent(personId)}`)}
    />
  )
}
