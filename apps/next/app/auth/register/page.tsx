'use client'

import React, { useState, Suspense } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'

import {
  YStack,
  XStack,
  Text,
  Heading,
  Button,
  Separator,
  Paragraph,
  FormInput,
  PasswordInput,
} from '@my/ui'

import { validatePassword, getPasswordStrengthTip } from '../../../utils/password'
import { useHydrated } from '../../../utils/hooks'

interface RegisterFormData {
  email: string
  password: string
  confirmPassword: string
  firstName: string
  lastName: string
  ecclesia: string
  invitationCode?: string
}

function RegisterPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isHydrated = useHydrated()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [codeDetails, setCodeDetails] = useState<{
    firstName: string
    lastName: string
    ecclesia: string
    role: string
  } | null>(null)

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>()

  const watchedCode = watch('invitationCode')
  const watchedPassword = watch('password')

  // Validate invitation code when entered
  React.useEffect(() => {
    const validateCode = async () => {
      if (watchedCode && watchedCode.length === 8) {
        try {
          const response = await fetch('/api/auth/validate-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: watchedCode }),
          })

          if (response.ok) {
            const data = await response.json()
            setCodeDetails(data.invitation)
            setValue('firstName', data.invitation.firstName)
            setValue('lastName', data.invitation.lastName)
            setValue('ecclesia', data.invitation.ecclesia)
            setError('')
          } else {
            setCodeDetails(null)
            setError('Invalid invitation code')
          }
        } catch (err) {
          console.error('Code validation error:', err)
          setCodeDetails(null)
        }
      } else {
        setCodeDetails(null)
      }
    }

    if (watchedCode) {
      validateCode()
    }
  }, [watchedCode, setValue])

  const onSubmit: SubmitHandler<RegisterFormData> = async (data) => {
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          ecclesia: data.ecclesia,
          invitationCode: data.invitationCode,
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setMessage(result.message)
        // Redirect to email verification notice page after a delay
        setTimeout(() => {
          router.push('/auth/verify-email-sent')
        }, 2000)
      } else {
        setError(result.error || 'Registration failed')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!isHydrated) return null

  return (
    <YStack maxWidth={500} margin="auto" padding="$4" gap="$4">
      <YStack gap="$2" alignItems="center">
        <Heading size="$8">Create Account</Heading>
        <Paragraph color="$gray11" textAlign="center">
          Join the Toronto East Christadelphian Ecclesia admin system
        </Paragraph>
      </YStack>
      <form onSubmit={handleSubmit(onSubmit)}>
        <YStack gap="$4">
          {/* Invitation Code Field */}
          <YStack gap="$2">
            <FormInput
              control={control}
              name="invitationCode"
              label="Invitation Code (Optional)"
              placeholder="Enter 8-character code"
              maxLength={8}
              style={{ textTransform: 'uppercase' }}
            />
            {codeDetails && (
              <Text fontSize="$3" color="$green10">
                ✓ Valid code for {codeDetails.firstName} {codeDetails.lastName} ({codeDetails.role})
              </Text>
            )}
          </YStack>

          {/* Email Field */}
          <FormInput
            control={control}
            name="email"
            label="Email Address"
            type="email"
            placeholder="your@email.com"
            rules={{
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format',
              },
            }}
          />

          {/* Name Fields */}
          <XStack gap="$3">
            <YStack flex={1}>
              <FormInput
                control={control}
                name="firstName"
                label="First Name"
                placeholder="First Name"
                disabled={!!codeDetails}
                rules={{ required: 'First name is required' }}
              />
            </YStack>

            <YStack flex={1}>
              <FormInput
                control={control}
                name="lastName"
                label="Last Name"
                placeholder="Last Name"
                disabled={!!codeDetails}
                rules={{ required: 'Last name is required' }}
              />
            </YStack>
          </XStack>

          {/* Ecclesia Field */}
          <FormInput
            control={control}
            name="ecclesia"
            label="Ecclesia"
            placeholder="e.g., TEE, Peterborough"
            disabled={!!codeDetails}
            rules={{ required: 'Ecclesia is required' }}
          />

          {/* Password Fields */}
          <YStack gap="$2">
            <PasswordInput
              control={control}
              name="password"
              label="Password"
              placeholder="Choose a strong password"
              autoComplete="new-password"
              rules={{ required: 'Password is required' }}
            />
            {watchedPassword && (
              <Text fontSize="$2" color="$gray11">
                {getPasswordStrengthTip()}
              </Text>
            )}
          </YStack>

          <PasswordInput
            control={control}
            name="confirmPassword"
            label="Confirm Password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            rules={{ required: 'Please confirm your password' }}
          />

          {/* Error and Success Messages */}
          {error && (
            <Text fontSize="$3" color="$red10" textAlign="center">
              {error}
            </Text>
          )}

          {message && (
            <Text fontSize="$3" color="$green10" textAlign="center">
              {message}
            </Text>
          )}

          {/* Submit Button */}
          <Button
            size="$4"
            disabled={loading}
            theme="blue"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </Button>

          {/* Divider */}
          <XStack alignItems="center" gap="$3">
            <Separator flex={1} />
            <Text fontSize="$3" color="$gray11">or</Text>
            <Separator flex={1} />
          </XStack>

          {/* Google Sign In */}
          <Button
            onPress={() => signIn('google', { callbackUrl: '/profile' })}
            size="$4"
            variant="outlined"
          >
            Continue with Google
          </Button>

          {/* Link to Sign In */}
          <XStack justifyContent="center" gap="$2">
            <Text fontSize="$3" color="$gray11">
              Already have an account?
            </Text>
            <Link href="/auth/signin" passHref legacyBehavior>
              <Text
                fontSize="$3"
                color="$blue10"
                textDecorationLine="underline"
                cursor="pointer"
              >
                Sign in
              </Text>
            </Link>
          </XStack>
        </YStack>
      </form>
    </YStack>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  )
}