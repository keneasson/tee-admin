'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { Button, Card, H2, Paragraph, Spinner, YStack } from 'tamagui'

type TokenState =
  | { status: 'loading' }
  | { status: 'valid'; email: string }
  | { status: 'expired' }
  | { status: 'invalid' }

/**
 * One-click login landing page.
 *
 * Deliberately does NOT auto-sign-in: these links live in emails for years and
 * get forwarded, so the recipient must press a button to sign in. An existing
 * session is left untouched — we never silently switch identity.
 */
export default function SigninTokenPage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()

  const token = searchParams?.get('token') ?? null
  const redirectTo = searchParams?.get('redirect') || '/'

  const [tokenState, setTokenState] = useState<TokenState>({ status: 'loading' })
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Resolve the token to an email + validity for display. Read-only — this does
  // not sign anyone in.
  useEffect(() => {
    if (!isHydrated || !token) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/auth/resolve-signin-token?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (cancelled) return
        if (data.valid && data.email) setTokenState({ status: 'valid', email: data.email })
        else setTokenState({ status: data.expired ? 'expired' : 'invalid' })
      } catch {
        if (!cancelled) setTokenState({ status: 'invalid' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isHydrated, token])

  const handleSignIn = async () => {
    if (tokenState.status !== 'valid' || !token) return
    setSigningIn(true)
    setError(null)
    try {
      const result = await signIn('otp', {
        email: tokenState.email,
        ecclesiaToken: token,
        redirect: false,
      })
      if (result?.error) {
        setError('That login link could not be used. Please request a fresh one.')
        setSigningIn(false)
        return
      }
      router.push(redirectTo)
    } catch {
      setError('Something went wrong signing you in. Please try again.')
      setSigningIn(false)
    }
  }

  if (!isHydrated || sessionStatus === 'loading') {
    return <Loading />
  }

  // Already signed in — keep this session, never switch identity from a link.
  if (sessionStatus === 'authenticated') {
    return (
      <Centered>
        <H2>You're signed in</H2>
        <Paragraph>
          You're already signed in{session?.user?.email ? ` as ${session.user.email}` : ''}.
        </Paragraph>
        <Button
          backgroundColor="$primary"
          color="white"
          hoverStyle={{ backgroundColor: '$primaryHover' }}
          onPress={() => router.push(redirectTo)}
        >
          Continue →
        </Button>
      </Centered>
    )
  }

  if (!token) {
    return (
      <Centered>
        <H2>Missing login link</H2>
        <Paragraph>This page needs the link from your email.</Paragraph>
        <SignInLink router={router} />
      </Centered>
    )
  }

  if (tokenState.status === 'loading') {
    return <Loading />
  }

  if (tokenState.status === 'expired' || tokenState.status === 'invalid') {
    return (
      <Centered>
        <H2>{tokenState.status === 'expired' ? 'This link has expired' : 'This link isn’t valid'}</H2>
        <Paragraph>
          For your security, one-click login links don’t last forever. Sign in normally and we’ll get
          you right back in.
        </Paragraph>
        <SignInLink router={router} />
      </Centered>
    )
  }

  // Valid token — explicit one-click sign-in.
  return (
    <Centered>
      <H2>One-click login</H2>
      <Paragraph>Sign in as {tokenState.email} to continue.</Paragraph>
      {error ? <Paragraph color="$error">{error}</Paragraph> : null}
      <Button
        backgroundColor="$primary"
        color="white"
        hoverStyle={{ backgroundColor: '$primaryHover' }}
        disabled={signingIn}
        icon={signingIn ? <Spinner size="small" width={16} height={16} color="white" /> : undefined}
        onPress={handleSignIn}
      >
        {signingIn ? 'Signing you in…' : 'Sign in'}
      </Button>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
      <Card elevate bordered padding="$6" gap="$3" maxWidth={420} width="100%" alignItems="center">
        {children}
      </Card>
    </YStack>
  )
}

function SignInLink({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Button
      variant="outlined"
      borderColor="$borderColor"
      hoverStyle={{ borderColor: '$textSecondary' }}
      onPress={() => router.push('/auth/signin')}
    >
      Go to sign in
    </Button>
  )
}
