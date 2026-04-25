'use client'

import { useEffect, useState, Suspense } from 'react'
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

function OtpCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isHydrated = useHydrated()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isHydrated) return

    const token = searchParams?.get('token')
    if (!token) {
      setStatus('error')
      setError('No verification token found.')
      return
    }

    const verify = async () => {
      try {
        // Verify the magic link token
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

        // Sign in via NextAuth OTP provider
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
          router.push('/profile')
        }
      } catch (err) {
        console.error('OTP callback error:', err)
        setStatus('error')
        setError('An unexpected error occurred.')
      }
    }

    verify()
  }, [isHydrated, searchParams, router])

  if (!isHydrated) return null

  return (
    <YStack maxWidth={450} margin="auto" padding="$4" gap="$4" alignItems="center">
      {status === 'verifying' ? (
        <>
          <Heading size="$7">Verifying...</Heading>
          <Paragraph color="$gray11" textAlign="center">
            Please wait while we verify your email.
          </Paragraph>
        </>
      ) : null}

      {status === 'success' ? (
        <>
          <Heading size="$7">Verified!</Heading>
          <Paragraph color="$green10" textAlign="center">
            Your email has been verified. Redirecting to your profile...
          </Paragraph>
        </>
      ) : null}

      {status === 'error' ? (
        <>
          <Heading size="$7">Verification Failed</Heading>
          <Text color="$red10" textAlign="center">
            {error}
          </Text>
          <YStack gap="$3" width="100%">
            <Link href="/auth/register">
              <Button size="$4" theme="blue" width="100%">
                Try Again
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button size="$4" variant="outlined" width="100%">
                Go to Sign In
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
    <Suspense fallback={<div>Verifying...</div>}>
      <OtpCallbackContent />
    </Suspense>
  )
}
