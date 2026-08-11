'use client'

import { useEffect, useState } from 'react'
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
  // function value isn't mistaken for a state updater. `reason` tailors the
  // <Verify> prompt (defaults to the generic account-changes copy).
  const [stepUp, setStepUp] = useState<{ retry: () => void; reason?: string } | null>(null)

  // Is the secure change-login flow (SECURE_EMAIL_CHANGE) available to this
  // session? Probed once server-side; drives whether the "Set as login" menu item
  // and the login-row change pencil are shown at all.
  const [canChangeLogin, setCanChangeLogin] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/user/email-change/available')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCanChangeLogin(!!d?.available) })
      .catch(() => { if (!cancelled) setCanChangeLogin(false) })
    return () => { cancelled = true }
  }, [])

  // Launch state for the secure change-login flow (full, code-based) — used only
  // for the login-row pencil (changing to a brand-NEW address).
  const [changeLogin, setChangeLogin] = useState<{ open: boolean; email?: string }>({ open: false })

  // Bumped after a successful promote to make UserProfile re-fetch its lists so the
  // newly-promoted address shows as "Login" and the old one as "Retired".
  const [reloadSignal, setReloadSignal] = useState(0)

  // Brief, auto-dismissing confirmation/error banner for the verified-address
  // fast-path ("Set as login" on an already-verified secondary).
  const [promoteNotice, setPromoteNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!promoteNotice) return
    const t = setTimeout(() => setPromoteNotice(null), 5000)
    return () => clearTimeout(t)
  }, [promoteNotice])

  // Fast-path: promote an ALREADY-VERIFIED secondary address straight to the login
  // identity — no confirmation code. On a 403 step-up we mount <Verify> and re-run
  // the same POST on success. The user is NOT signed out (the old address stays a
  // valid secondary, so the session keeps resolving).
  const promoteToLogin = (email: string) => {
    const run = async () => {
      try {
        const res = await fetch('/api/user/email-change/promote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        if (res.ok) {
          setReloadSignal((n) => n + 1)
          setPromoteNotice(`${email} is now your login email.`)
          return
        }
        if (res.status === 403) {
          const body = await res.clone().json().catch(() => ({} as any))
          if (body?.stepUpRequired) {
            setStepUp({ retry: run, reason: 'to change your login email' })
            return
          }
        }
        const body = await res.json().catch(() => ({} as any))
        setPromoteNotice(body?.error || 'Could not change your login email.')
      } catch {
        setPromoteNotice('Network error — please try again.')
      }
    }
    void run()
  }

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
        canChangeLogin={canChangeLogin}
        onChangeLogin={() => setChangeLogin({ open: true })}
        onSetLogin={(email) => promoteToLogin(email)}
        reloadSignal={reloadSignal}
      />

      {/* Fast-path confirmation / error banner (auto-dismisses). */}
      {promoteNotice ? (
        <YStack
          position="absolute"
          top="$4"
          left={0}
          right={0}
          zIndex={1100}
          alignItems="center"
          pointerEvents="none"
        >
          <Card elevate bordered padding="$3" backgroundColor="$background" maxWidth={480}>
            <Text fontSize="$3">{promoteNotice}</Text>
          </Card>
        </YStack>
      ) : null}

      {/* Secure login-email change (full, code-based) — launched from the login-row
          pencil to move to a brand-NEW address; rendered as a modal overlay.
          (Promoting an already-verified secondary uses the no-code fast-path above.)
          Self-hides internally unless SECURE_EMAIL_CHANGE is on. */}
      {changeLogin.open ? (
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
          <YStack maxWidth={480} width="100%">
            <ChangeEmailFlow
              initialEmail={changeLogin.email}
              onClose={() => setChangeLogin({ open: false })}
            />
          </YStack>
        </YStack>
      ) : null}

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
              reason={stepUp.reason ?? 'to make account changes'}
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
