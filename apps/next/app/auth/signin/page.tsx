'use client'

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { signIn, getSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import type { GestureResponderEvent } from 'react-native'

import {
  YStack,
  XStack,
  Text,
  Heading,
  Button,
  Paragraph,
  Input,
} from '@my/ui'

type View = 'main' | 'otp'

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isHydrated = useHydrated()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Shared email for both flows
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // OTP state
  const [view, setView] = useState<View>('main')
  const [otpEmail, setOtpEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  // Check for URL error parameters
  useEffect(() => {
    if (!isHydrated) return
    const urlError = searchParams?.get('error')
    if (urlError === 'CredentialsSignin') {
      setError('Invalid email or password')
    } else if (urlError === 'AccessDenied') {
      setError('Email not verified. Please check your email for verification instructions.')
    }
  }, [isHydrated, searchParams])

  // Redirect if already authenticated
  useEffect(() => {
    if (!isHydrated) return
    const checkAuth = async () => {
      const session = await getSession()
      if (session) {
        const callbackUrl = searchParams?.get('callbackUrl') || '/profile'
        router.push(callbackUrl)
      }
    }
    checkAuth()
  }, [isHydrated, router, searchParams])

  // --- OTP handlers (must be before any early returns - rules of hooks) ---
  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newOtp = [...otpDigits]
      digits.forEach((digit, i) => {
        if (index + i < 6) newOtp[index + i] = digit
      })
      setOtpDigits(newOtp)
      inputRefs.current[Math.min(index + digits.length, 5)]?.focus()
      return
    }
    if (value && !/^\d$/.test(value)) return
    const newOtp = [...otpDigits]
    newOtp[index] = value
    setOtpDigits(newOtp)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }, [otpDigits])

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [otpDigits])

  if (!isHydrated) return null

  const clearError = () => { if (error) setError('') }

  // --- Password sign-in ---
  const handlePasswordSignIn = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email: trimmedEmail,
        password,
        callbackUrl: '/profile',
        redirect: false,
      })

      if (result?.error) {
        setError(result.error === 'CredentialsSignin'
          ? 'Invalid email or password'
          : 'Sign in failed. Please try again.')
      } else if (result?.ok) {
        router.push('/profile')
      }
    } catch (err) {
      console.error('Sign in error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // --- Send OTP ---
  const handleSendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address first.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      })

      if (response.ok) {
        setOtpEmail(trimmedEmail)
        setView('otp')
        setResendCooldown(60)
        setOtpDigits(['', '', '', '', '', ''])
      } else {
        setError('Failed to send sign-in link. Please try again.')
      }
    } catch (err) {
      console.error('Send OTP error:', err)
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    const code = otpDigits.join('')
    if (code.length !== 6) { setError('Please enter all 6 digits.'); return }

    setLoading(true)
    setError('')

    try {
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, code }),
      })
      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok) {
        setError(verifyResult.error || 'Verification failed.')
        setLoading(false)
        return
      }

      const signInResult = await signIn('otp', {
        email: otpEmail,
        otpToken: code,
        redirect: false,
      })

      if (signInResult?.error) {
        setError('Sign in failed. Please try again.')
      } else if (signInResult?.ok) {
        router.push('/profile')
      }
    } catch (err) {
      console.error('Verify OTP error:', err)
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setLoading(true)
    setError('')
    try {
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail }),
      })
      setResendCooldown(60)
      setOtpDigits(['', '', '', '', '', ''])
    } catch (err) {
      console.error('Resend error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = (e: GestureResponderEvent) => {
    e.preventDefault()
    e.stopPropagation()
    signIn('google', { callbackUrl: '/profile' })
  }

  // ============ OTP VIEW ============
  if (view === 'otp') {
    return (
      <YStack maxWidth={400} margin="auto" padding="$4" gap="$4">
        <YStack gap="$2" alignItems="center">
          <Heading size="$7">Check Your Email</Heading>
          <Paragraph color="$gray11" textAlign="center">
            We sent a verification code to{' '}
            <Text fontWeight="bold">{otpEmail}</Text>
          </Paragraph>
        </YStack>

        <YStack gap="$4">
          <XStack justifyContent="center" gap="$2">
            {otpDigits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={index === 0 ? 6 : 1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                autoFocus={index === 0}
                style={{
                  width: '48px',
                  height: '56px',
                  textAlign: 'center',
                  fontSize: '24px',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  border: '2px solid #ccc',
                  borderRadius: '8px',
                  outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#007bff' }}
                onBlur={(e) => { e.target.style.borderColor = '#ccc' }}
              />
            ))}
          </XStack>

          {error ? (
            <Paragraph color="$red10" textAlign="center">{error}</Paragraph>
          ) : null}

          <Button onPress={handleVerifyOtp} size="$4" disabled={loading} theme="blue">
            {loading ? 'Verifying...' : 'Verify'}
          </Button>

          <XStack justifyContent="center">
            {resendCooldown > 0 ? (
              <Text fontSize="$3" color="$gray11">
                Resend code in {resendCooldown}s
              </Text>
            ) : (
              <Text
                fontSize="$3"
                color="$blue10"
                textDecorationLine="underline"
                cursor="pointer"
                onPress={handleResend}
              >
                Didn't receive the code? Resend
              </Text>
            )}
          </XStack>

          <XStack justifyContent="center">
            <Text
              fontSize="$3"
              color="$blue10"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={() => { setView('main'); setError(''); setOtpDigits(['', '', '', '', '', '']) }}
            >
              Back to sign in
            </Text>
          </XStack>
        </YStack>
      </YStack>
    )
  }

  // ============ MAIN VIEW ============
  return (
    <YStack maxWidth={400} margin="auto" padding="$4" gap="$4">
      <YStack gap="$2" alignItems="center">
        <Heading size="$8">Welcome Back</Heading>
        <Paragraph color="$gray11" textAlign="center">
          Sign in to the TEE Portal
        </Paragraph>
      </YStack>

      <YStack gap="$4">
        {/* Google - top */}
        <Button onPress={handleGoogleSignIn} size="$4" variant="outlined">
          Continue with Google
        </Button>

        {/* Email + OTP link */}
        <YStack gap="$2">
          <Text fontWeight="600">Email Address</Text>
          <Input
            value={email}
            onChangeText={(val: string) => { setEmail(val); clearError() }}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            size="$4"
          />
        </YStack>

        <Button onPress={handleSendOtp} size="$4" disabled={loading} theme="blue">
          {loading ? 'Sending...' : 'Email my Sign-in Link'}
        </Button>

        {/* OR divider - just text, no borders */}
        <XStack justifyContent="center" paddingVertical="$1">
          <Text fontSize="$3" color="$gray11">--- OR ---</Text>
        </XStack>

        {/* Password */}
        <YStack gap="$2">
          <Text fontWeight="600">Password</Text>
          <Input
            value={password}
            onChangeText={(val: string) => { setPassword(val); clearError() }}
            placeholder="Enter your password"
            autoComplete="current-password"
            secureTextEntry={!showPassword}
            size="$4"
          />
        </YStack>

        <Button onPress={handlePasswordSignIn} size="$4" disabled={loading} variant="outlined">
          {loading ? 'Signing In...' : 'Sign in with password'}
        </Button>

        {/* Error */}
        {error ? (
          <Paragraph color="$red10" textAlign="center">{error}</Paragraph>
        ) : null}

        {/* Footer links */}
        <XStack justifyContent="center" gap="$2">
          <Text fontSize="$3" color="$gray11">
            Don't have an account?
          </Text>
          <Link
            href="/auth/register"
            style={{ fontSize: '14px', color: '#0066CC', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Create account
          </Link>
        </XStack>
      </YStack>
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
