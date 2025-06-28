import React, { useState, useEffect } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { useRouter } from 'next/router'
// import { useSearchParams } from 'next/navigation' // Not available in pages router
import Link from 'next/link'
import { signIn, getSession } from 'next-auth/react'

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

export default function SignInPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormData>()

  // Check for URL error parameters only after router is ready
  useEffect(() => {
    if (!router.isReady) return
    
    const urlError = router.query.error
    if (urlError === 'CredentialsSignin') {
      setError('Invalid email or password')
    } else if (urlError === 'AccessDenied') {
      setError('Email not verified. Please check your email for verification instructions.')
    }
  }, [router.isReady, router.query.error])

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const session = await getSession()
      if (session) {
        router.push('/profile')
      }
    }
    checkAuth()
  }, [router])

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
        redirect: true,
      })

      console.log('📊 SignIn result:', result)

      // With redirect: true, NextAuth handles the redirect automatically
      // If we get here, there was likely an error
      if (result?.error) {
        console.log('❌ SignIn error:', result.error)
        if (result.error === 'CredentialsSignin') {
          setError('Invalid email or password')
        } else {
          setError('Sign in failed. Please try again.')
        }
      } else {
        console.log('⚠️ Unexpected signIn result (should have redirected):', result)
        // Fallback manual redirect
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
          <Paragraph theme="alt2" textAlign="center">
            Sign in to your TEE Admin account
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
                <Text
                  fontSize="$3"
                  color="$blue10"
                  textDecorationLine="underline"
                  cursor="pointer"
                >
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
            <Button
              size="$4"
              disabled={loading}
              theme="blue"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>

            {/* Divider */}
            <XStack alignItems="center" gap="$3">
              <Separator flex={1} />
              <Text fontSize="$3" theme="alt2">or</Text>
              <Separator flex={1} />
            </XStack>

            {/* Google Sign In */}
            <Button
              onPress={handleGoogleSignIn}
              size="$4"
              variant="outlined"
            >
              Continue with Google
            </Button>

            {/* Link to Register */}
            <XStack justifyContent="center" gap="$2">
              <Text fontSize="$3" theme="alt2">
                Don't have an account?
              </Text>
              <Link href="/auth/register" passHref>
                <Text
                  fontSize="$3"
                  color="$blue10"
                  textDecorationLine="underline"
                  cursor="pointer"
                >
                  Create account
                </Text>
              </Link>
            </XStack>

            {/* Resend Verification Link */}
            <XStack justifyContent="center">
              <Link href="/auth/resend-verification" passHref>
                <Text
                  fontSize="$2"
                  theme="alt2"
                  textDecorationLine="underline"
                  cursor="pointer"
                >
                  Resend email verification
                </Text>
              </Link>
            </XStack>
          </YStack>
        </form>
    </YStack>
  )
}