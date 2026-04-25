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

type ConnectionCallbackStatus = 'verifying' | 'accepting' | 'accepted' | 'declined' | 'error'

function ConnectionCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isHydrated = useHydrated()
  const [status, setStatus] = useState<ConnectionCallbackStatus>('verifying')
  const [error, setError] = useState('')
  const [requesterName, setRequesterName] = useState('')

  useEffect(() => {
    if (!isHydrated) return

    const token = searchParams?.get('token')
    const action = searchParams?.get('action') as 'accept' | 'decline' | null

    if (!token) {
      setStatus('error')
      setError('No verification token found.')
      return
    }

    if (!action || (action !== 'accept' && action !== 'decline')) {
      setStatus('error')
      setError('Invalid action. Expected "accept" or "decline".')
      return
    }

    const processCallback = async () => {
      try {
        // Step 1: Verify the magic link token (this also validates the user)
        const verifyRes = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ magicLinkToken: token }),
        })

        const verifyData = await verifyRes.json()

        if (!verifyRes.ok) {
          setStatus('error')
          setError(verifyData.error || 'Token verification failed. It may have expired.')
          return
        }

        // Step 2: Sign in via NextAuth OTP provider
        const signInResult = await signIn('otp', {
          email: verifyData.email,
          otpToken: token,
          redirect: false,
        })

        if (signInResult?.error) {
          setStatus('error')
          setError('Sign in failed. Please try again.')
          return
        }

        // Step 3: Find the pending connection request to get the requester email
        // The token was created for us (the target), and we need to find
        // which connection request is associated with this token
        setStatus(action === 'accept' ? 'accepting' : 'verifying')

        const connectionsRes = await fetch('/api/connections')
        const connectionsData = await connectionsRes.json()

        if (!connectionsRes.ok || !connectionsData.success) {
          setStatus('error')
          setError('Failed to load connection requests.')
          return
        }

        // Look through pending requests to find the one matching this token
        const pendingRequests = connectionsData.pendingRequests || []
        if (pendingRequests.length === 0) {
          // Could be already handled
          setStatus('error')
          setError('No pending connection request found. It may have already been handled.')
          return
        }

        // Use the most recent pending request (the one we just received email about)
        const pendingRequest = pendingRequests[0]
        const requesterEmail = pendingRequest.initiatedBy || pendingRequest.email

        // Step 4: Accept or decline the connection
        const patchRes = await fetch('/api/connections', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requesterEmail, action }),
        })

        const patchData = await patchRes.json()

        if (!patchRes.ok) {
          setStatus('error')
          setError(patchData.error || `Failed to ${action} connection request.`)
          return
        }

        setRequesterName(requesterEmail)
        setStatus(action === 'accept' ? 'accepted' : 'declined')
      } catch (err) {
        console.error('Connection callback error:', err)
        setStatus('error')
        setError('An unexpected error occurred.')
      }
    }

    processCallback()
  }, [isHydrated, searchParams, router])

  if (!isHydrated) return null

  return (
    <YStack maxWidth={450} margin="auto" padding="$4" gap="$4" alignItems="center">
      {status === 'verifying' ? (
        <>
          <Heading size="$7">Verifying...</Heading>
          <Paragraph color="$gray11" textAlign="center">
            Please wait while we verify your identity.
          </Paragraph>
        </>
      ) : null}

      {status === 'accepting' ? (
        <>
          <Heading size="$7">Connecting...</Heading>
          <Paragraph color="$gray11" textAlign="center">
            Setting up your connection...
          </Paragraph>
        </>
      ) : null}

      {status === 'accepted' ? (
        <>
          <Heading size="$7">Connected!</Heading>
          <Paragraph color="$green10" textAlign="center">
            You are now connected{requesterName ? ` with ${requesterName}` : ''}. You can now see each other's shared contact information.
          </Paragraph>
          <YStack gap="$3" width="100%">
            <Button size="$4" theme="blue" width="100%" onPress={() => router.push('/directory/people')}>
              Go to Contacts
            </Button>
          </YStack>
        </>
      ) : null}

      {status === 'declined' ? (
        <>
          <Heading size="$7">Connection Declined</Heading>
          <Paragraph color="$gray11" textAlign="center">
            The connection request has been declined.
          </Paragraph>
          <YStack gap="$3" width="100%">
            <Button size="$4" theme="blue" width="100%" onPress={() => router.push('/directory/people')}>
              Go to Contacts
            </Button>
          </YStack>
        </>
      ) : null}

      {status === 'error' ? (
        <>
          <Heading size="$7">Something Went Wrong</Heading>
          <Text color="$red10" textAlign="center">
            {error}
          </Text>
          <YStack gap="$3" width="100%">
            <Link href="/directory/people">
              <Button size="$4" theme="blue" width="100%">
                Go to Contacts
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

export default function ConnectionCallbackPage() {
  return (
    <Suspense fallback={<div>Verifying...</div>}>
      <ConnectionCallbackContent />
    </Suspense>
  )
}
