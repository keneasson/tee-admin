'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { UserProfile } from '@my/app/features/profile/user-profile'
import { Section, Text, YStack, Spinner, Card } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Verify } from '@/components/verify/verify'
import { ChangeEmailFlow } from '@/features/account/change-email-flow'

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const isHydrated = useHydrated()

  // Holds the mutation to re-run once a fresh-auth step-up (403 stepUpRequired
  // from require-fresh-auth) is satisfied via <Verify>. Wrapped in an object so a
  // function value isn't mistaken for a state updater.
  const [stepUp, setStepUp] = useState<{ retry: () => void } | null>(null)

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
    <>
      <UserProfile
        userEmail={session.user.email}
        userName={session.user.name || undefined}
        userRole={session.user.role || undefined}
        userEcclesia={(session.user as any).ecclesia || undefined}
        onNavigateToPerson={(personId) => router.push(`/people/${encodeURIComponent(personId)}`)}
        onStepUpRequired={(retry) => setStepUp({ retry })}
      />

      {/* Self-serve login-email change — self-hides unless SECURE_EMAIL_CHANGE is on. */}
      <Wrapper>
        <Section gap={'$4'}>
          <ChangeEmailFlow />
        </Section>
      </Wrapper>

      {/* Step-up overlay: shown when a profile mutation is refused with
          403 stepUpRequired. On success we re-run the challenged mutation. */}
      {stepUp ? (
        <YStack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1000}
          justifyContent="center"
          alignItems="center"
          padding="$4"
          backgroundColor="rgba(0,0,0,0.5)"
        >
          <Card elevate bordered padding="$4" maxWidth={440} width="100%" backgroundColor="$background">
            <Verify
              reason="to make account changes"
              onVerified={() => {
                const { retry } = stepUp
                setStepUp(null)
                retry()
              }}
              onCancel={() => setStepUp(null)}
            />
          </Card>
        </YStack>
      ) : null}
    </>
  )
}
