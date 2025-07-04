'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, getSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'

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

interface SignInFormData {
  email: string
  password: string
}

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isHydrated = useHydrated()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>()

  // Check for URL error parameters after hydration
  useEffect(() => {
    if (!isHydrated) return

    const urlError = searchParams?.get('error')
    if (urlError === 'CredentialsSignin') {
      setError('Invalid email or password')
    } else if (urlError === 'AccessDenied') {
      setError('Email not verified. Please check your email for verification instructions.')
    }
  }, [isHydrated, searchParams])

  // Check if user is already authenticated
  useEffect(() => {
    if (!isHydrated) return

    const checkAuth = async () => {
      const session = await getSession()
      if (session) {
        router.push('/profile')
      }
    }
    checkAuth()
  }, [isHydrated, router])

  // Don't render until hydrated
  if (!isHydrated) {
    return null
  }

  // Clear error when user starts interacting with form
  const clearError = () => {
    if (error) setError('')
  }

  const onSubmit: SubmitHandler<SignInFormData> = async (data) => {
    console.log('🔐 Form submission started for:', data.email)
    setLoading(true)
    setError('')

    try {
      console.log('🔑 Calling signIn with credentials...')
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        callbackUrl: '/profile',
        redirect: false,
      })

      console.log('📊 SignIn result:', result)

      // Handle the result manually
      if (result?.error) {
        console.log('❌ SignIn error:', result.error)
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password')
        } else {
          setError('Sign in failed. Please try again.')
        }
      } else if (result?.ok) {
        console.log('✅ SignIn successful, redirecting...')
        router.push('/profile')
      }
    } catch (err) {
      console.error('💥 Sign in error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
      console.log('🏁 Form submission completed')
    }
  }

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/profile' })
  }

  return (
    <YStack maxWidth={400} margin="auto" padding="$4" gap="$4">
      <YStack gap="$2" alignItems="center">
        <Heading size="$8">Welcome Back</Heading>
        <Paragraph color="$gray11" textAlign="center">
          Sign in to the TEE Portal
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
            onChangeText={clearError}
            rules={{
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email format',
              },
            }}
          />

          {/* Password Field */}
          <PasswordInput
            control={control}
            name="password"
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            onChangeText={clearError}
            rules={{ required: 'Password is required' }}
          />

          {/* Forgot Password Link */}
          <XStack justifyContent="flex-end">
            <Link href="/auth/forgot-password" passHref>
              <Text fontSize="$3" color="$blue10" textDecorationLine="underline" cursor="pointer">
                Forgot password?
              </Text>
            </Link>
          </XStack>

          {/* Error Message */}
          {error && (
            <Text fontSize="$3" color="$red10" textAlign="center">
              {error}
            </Text>
          )}

          {/* Submit Button */}
          <Button size="$4" disabled={loading} theme="blue">
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>

          {/* Divider */}
          <XStack alignItems="center" gap="$3">
            <Separator flex={1} />
            <Text fontSize="$3" color="$gray11">
              or
            </Text>
            <Separator flex={1} />
          </XStack>

          {/* Google Sign In */}
          <Button onPress={handleGoogleSignIn} size="$4" variant="outlined">
            Continue with Google
          </Button>

          {/* Link to Register */}
          <XStack justifyContent="center" gap="$2">
            <Text fontSize="$3" color="$gray11">
              Don't have an account?
            </Text>
            <Link href="/auth/register" passHref>
              <Text fontSize="$3" color="$blue10" textDecorationLine="underline" cursor="pointer">
                Create account
              </Text>
            </Link>
          </XStack>

          {/* Resend Verification Link */}
          <XStack justifyContent="center">
            <Link href="/auth/resend-verification" passHref>
              <Text fontSize="$2" color="$gray11" textDecorationLine="underline" cursor="pointer">
                Resend email verification
              </Text>
            </Link>
          </XStack>
        </YStack>
      </form>
    </YStack>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInPageContent />
    </Suspense>
  )
}
