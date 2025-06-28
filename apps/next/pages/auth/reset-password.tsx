import React, { useState, useEffect } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useRouter } from 'next/router'
import Link from 'next/link'

import { YStack, Text, Heading, Button, Paragraph, FormInput, PasswordInput } from '@my/ui'

import { validatePassword, getPasswordStrengthTip } from '../../utils/password'

interface ResetPasswordFormData {
  password: string
  confirmPassword: string
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = router.query
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordReset, setPasswordReset] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>()

  const watchedPassword = watch('password')

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
    }
  }, [token])

  const onSubmit: SubmitHandler<ResetPasswordFormData> = async (data) => {
    if (!token) return

    setLoading(true)
    setError('')
    setMessage('')

    // Validate password
    const passwordValidation = validatePassword(data.password)
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join(', '))
      setLoading(false)
      return
    }

    // Check password confirmation
    if (data.password !== data.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(result.message)
        setPasswordReset(true)
      } else {
        setError(result.error || 'Failed to reset password')
      }
    } catch (err) {
      console.error('Password reset error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (passwordReset) {
    return (
      <YStack maxWidth={500} margin="auto" padding="$4" gap="$4" alignItems="center">
        <Text fontSize="$10" color="$green10">
          ✓
        </Text>

        <Heading size="$6" color="$green10" textAlign="center">
          Password Reset Complete
        </Heading>

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
  }

  if (!token || error.includes('Invalid reset link')) {
    return (
      <YStack maxWidth={500} margin="auto" padding="$4" gap="$4" alignItems="center">
        <Text fontSize="$10" color="$red10">
          ✗
        </Text>

        <Heading size="$6" color="$red10" textAlign="center">
          Invalid Reset Link
        </Heading>

        <Paragraph theme="alt2" textAlign="center">
          This password reset link is invalid or has expired.
        </Paragraph>

        <YStack gap="$3" alignItems="center">
          <Link href="/auth/forgot-password" passHref>
            <Button theme="blue" size="$4">
              Request New Reset Link
            </Button>
          </Link>

          <Link href="/auth/signin" passHref>
            <Button variant="outlined" size="$4">
              Back to Sign In
            </Button>
          </Link>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack maxWidth={400} margin="auto" padding="$4" gap="$4">
      <YStack gap="$2" alignItems="center">
        <Heading size="$8">Reset Password</Heading>
        <Paragraph theme="alt2" textAlign="center">
          Choose a new password for your account.
        </Paragraph>
      </YStack>

      <form onSubmit={handleSubmit(onSubmit)}>
        <YStack gap="$4">
          {/* Password Field */}
          <YStack gap="$2">
            <PasswordInput
              control={control}
              name="password"
              label="New Password"
              placeholder="Enter your new password"
              autoComplete="new-password"
              rules={{ required: 'Password is required' }}
            />
            {watchedPassword && (
              <Text fontSize="$2" theme="alt2">
                {getPasswordStrengthTip()}
              </Text>
            )}
          </YStack>

          {/* Confirm Password Field */}
          <PasswordInput
            control={control}
            name="confirmPassword"
            label="Confirm New Password"
            placeholder="Confirm your new password"
            autoComplete="new-password"
            rules={{ required: 'Please confirm your password' }}
          />

          {/* Error Message */}
          {error && !error.includes('Invalid reset link') && (
            <Text fontSize="$3" color="$red10" textAlign="center">
              {error}
            </Text>
          )}

          {/* Submit Button */}
          <Button size="$4" disabled={loading} theme="blue">
            {loading ? 'Resetting...' : 'Reset Password'}
          </Button>

          {/* Back to Sign In */}
          <YStack alignItems="center">
            <Link href="/auth/signin" passHref>
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
