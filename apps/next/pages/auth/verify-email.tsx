import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

import {
  YStack,
  Text,
  Heading,
  Button,
  Paragraph,
  Spinner,
} from '@my/ui'


export default function VerifyEmailPage() {
  const router = useRouter()
  const { token } = router.query
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) return

      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setStatus('success')
          setMessage(data.message)
        } else {
          setStatus('error')
          setMessage(data.error || 'Verification failed')
        }
      } catch (error) {
        console.error('Verification error:', error)
        setStatus('error')
        setMessage('An unexpected error occurred')
      }
    }

    if (token) {
      verifyEmail()
    }
  }, [token])

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <YStack alignItems="center" gap="$4">
            <Spinner size="large" color="$blue10" />
            <Heading size="$6">Verifying your email...</Heading>
            <Paragraph theme="alt2" textAlign="center">
              Please wait while we verify your email address.
            </Paragraph>
          </YStack>
        )

      case 'success':
        return (
          <YStack alignItems="center" gap="$4">
            <Text fontSize="$10" color="$green10">✓</Text>
            <Heading size="$6" color="$green10">Email Verified!</Heading>
            <Paragraph theme="alt2" textAlign="center">
              {message}
            </Paragraph>
            <Link href="/auth/signin" passHref>
              <Button theme="green" size="$4">
                Sign In Now
              </Button>
            </Link>
          </YStack>
        )

      case 'error':
        return (
          <YStack alignItems="center" gap="$4">
            <Text fontSize="$10" color="$red10">✗</Text>
            <Heading size="$6" color="$red10">Verification Failed</Heading>
            <Paragraph theme="alt2" textAlign="center">
              {message}
            </Paragraph>
            <YStack gap="$3" alignItems="center">
              <Link href="/auth/resend-verification" passHref>
                <Button variant="outlined" size="$4">
                  Resend Verification Email
                </Button>
              </Link>
              <Link href="/auth/register" passHref>
                <Button theme="blue" size="$4">
                  Create New Account
                </Button>
              </Link>
            </YStack>
          </YStack>
        )

      default:
        return null
    }
  }

  return (
    
      <YStack maxWidth={500} margin="auto" padding="$4" gap="$4" alignItems="center">
        {renderContent()}
      </YStack>
    
  )
}