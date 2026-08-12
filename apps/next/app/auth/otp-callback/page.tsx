'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useHydrated } from '@my/app/hooks/use-hydrated'

import {
  YStack,
  Text,
  Heading,
  Paragraph,
  Button,
} from '@my/ui'

type Status = 'confirm' | 'verifying' | 'success' | 'error'

/**
 * Magic-link sign-in confirmation.
 *
 * The magic link is a SINGLE-USE token. Email security scanners (Gmail,
 * corporate gateways, antivirus) pre-fetch links with a GET before the human
 * ever clicks — so if this page consumed the token on load, the scanner would
 * burn it and the real click would get "already used" (the reported
 * "took two tries" bug).
 *
 * The fix is to make consumption require an explicit human action: page load
 * only renders a "Confirm sign-in" button; the token is consumed
 * (verify-otp -> signIn) exclusively on button press. Scanners issue GET and
 * don't click, so they can never consume the token.
 */
function OtpCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isHydrated = useHydrated()
  const [status, setStatus] = useState<Status>('confirm')
  const [error, setError] = useState('')

  const token = searchParams?.get('token') ?? ''

  // IMPORTANT: no auto-submit on load. Consumption happens only in this
  // handler, which fires from the Confirm button's onPress (a human click).
  const handleConfirm = async () => {
    if (!token) {
      setStatus('error')
      setError('No verification token found.')
      return
    }

    setStatus('verifying')
    setError('')

    try {
      // Consume the single-use magic link token (verifyAndConsume server-side).
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ magicLinkToken: token }),
      })

      const data = await response.json()

      if (!response.ok) {
        setStatus('error')
        setError(data.error || 'Verification failed.')
        return
      }

      // Sign in via NextAuth OTP provider.
      const signInResult = await signIn('otp', {
        email: data.email,
        otpToken: token,
        redirect: false,
      })

      if (signInResult?.error) {
        setStatus('error')
        setError('Sign in failed. Please try again.')
      } else if (signInResult?.ok) {
        setStatus('success')
        // Honor a return path if one was carried through the magic link, but
        // only a safe same-site path (no open redirects). Default: /profile.
        const requested = searchParams?.get('redirect')
        const dest = requested && requested.startsWith('/') && !requested.startsWith('//')
          ? requested
          : '/profile'
        router.push(dest)
      } else {
        setStatus('error')
        setError('Sign in failed. Please try again.')
      }
    } catch (err) {
      console.error('OTP callback error:', err)
      setStatus('error')
      setError('An unexpected error occurred.')
    }
  }

  if (!isHydrated) return null

  return (
    <YStack maxWidth={450} margin="auto" padding="$4" gap="$4" alignItems="center">
      {status === 'confirm' || status === 'verifying' ? (
        <>
          <Heading size="$7" color="$color12" textAlign="center">
            Confirm sign-in
          </Heading>
          <Paragraph color="$color11" textAlign="center">
            Click the button below to finish signing in.
          </Paragraph>
          <Button
            onPress={handleConfirm}
            size="$4"
            variant="action"
            width="100%"
            disabled={status === 'verifying'}
            aria-label="Confirm sign-in"
          >
            {status === 'verifying' ? 'Signing in…' : 'Confirm sign-in'}
          </Button>
          <Paragraph color="$color10" fontSize="$2" textAlign="center">
            For your security, this link only signs you in when you click the
            button above.
          </Paragraph>
        </>
      ) : null}

      {status === 'success' ? (
        <>
          <Heading size="$7" color="$color12">Signed in!</Heading>
          <Paragraph color="$green10" textAlign="center">
            You're signed in. Redirecting to your profile…
          </Paragraph>
        </>
      ) : null}

      {status === 'error' ? (
        <>
          <Heading size="$7" color="$color12">Sign-in Failed</Heading>
          <Text color="$red10" textAlign="center">
            {error}
          </Text>
          <YStack gap="$3" width="100%">
            <Link href="/auth/signin">
              <Button size="$4" variant="action" width="100%">
                Request a new link
              </Button>
            </Link>
            <Link href="/auth/register">
              <Button size="$4" variant="outlined" width="100%">
                Create account
              </Button>
            </Link>
          </YStack>
        </>
      ) : null}
    </YStack>
  )
}

export default function OtpCallbackPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <OtpCallbackContent />
    </Suspense>
  )
}
