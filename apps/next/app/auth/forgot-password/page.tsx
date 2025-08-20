'use client'

import React, { useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import Link from 'next/link'

import { YStack, Text, Heading, Button, Paragraph, FormInput } from '@my/ui'
import { useHydrated } from '../../../utils/hooks'

interface ForgotPasswordFormData {
  email: string
}

export default function ForgotPasswordPage() {
  const isHydrated = useHydrated()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>()

  const onSubmit: SubmitHandler<ForgotPasswordFormData> = async (data) => {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(result.message)
        setEmailSent(true)
      } else {
        setError(result.error || 'Failed to send reset email')
      }
    } catch (err) {
      console.error('Password reset error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated) return null

  if (emailSent) {
    return (
      <YStack maxWidth={500} margin="auto" padding="$4" gap="$4" alignItems="center">
        <Text fontSize="$10" color="$blue10">
          📧
        </Text>
        <Heading size="$8" textAlign="center">
          Check Your Email
        </Heading>
        <Paragraph color="$gray11" textAlign="center">
          {message}
        </Paragraph>
        <Paragraph fontSize="$3" color="$gray11" textAlign="center">
          If you don't see the email in a few minutes, check your spam folder.
        </Paragraph>
        <YStack gap="$3" alignItems="center" width="100%">
          <Link href="/auth/signin" passHref legacyBehavior>
            <Button theme="blue" size="$4">
              Back to Sign In
            </Button>
          </Link>

          <Button
            variant="outlined"
            size="$4"
            onPress={() => {
              setEmailSent(false)
              setMessage('')
            }}
          >
            Try Different Email
          </Button>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack maxWidth={400} margin="auto" padding="$4" gap="$4">
      <YStack gap="$2" alignItems="center">
        <Heading size="$8">Reset Password</Heading>
        <Paragraph color="$gray11" textAlign="center">
          Enter your email address and we'll send you a link to reset your password.
        </Paragraph>
      </YStack>
      <form onSubmit={handleSubmit(onSubmit)}>
        <YStack gap="$4">
          {/* Email Field */}
          <FormInput
            control={control}
            name="email"
            label="Email Address"
            type="email"
            placeholder="your@email.com"
            autoComplete="email"
            rules={{
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format',
              },
            }}
          />

          {/* Error Message */}
          {error && (
            <Text fontSize="$3" color="$red10" textAlign="center">
              {error}
            </Text>
          )}

          {/* Submit Button */}
          <Button size="$4" disabled={loading} theme="blue">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>

          {/* Back to Sign In */}
          <YStack alignItems="center">
            <Link href="/auth/signin" passHref legacyBehavior>
              <Text fontSize="$3" color="$blue10" textDecorationLine="underline" cursor="pointer">
                Back to Sign In
              </Text>
            </Link>
          </YStack>
        </YStack>
      </form>
    </YStack>
  )
}
