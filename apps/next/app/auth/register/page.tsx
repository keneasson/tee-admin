'use client'

import React, { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import type { GestureResponderEvent } from 'react-native'

import {
  YStack,
  XStack,
  Text,
  Heading,
  Button,
  Separator,
  Paragraph,
  Input,
} from '@my/ui'

import { useHydrated } from '../../../utils/hooks'

type Step = 'email' | 'otp'

function RegisterPageContent() {
  const router = useRouter()
  const isHydrated = useHydrated()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', ''])
  const [resendCooldown, setResendCooldown] = useState(0)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleSendOtp = async () => {
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
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
        setStep('otp')
        setResendCooldown(60)
        setOtpDigits(['', '', '', '', '', ''])
      } else {
        setError('Failed to send verification code. Please try again.')
      }
    } catch (err) {
      console.error('Send OTP error:', err)
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpChange = useCallback((index: number, value: string) => {
    // Handle paste of full code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('')
      const newOtp = [...otpDigits]
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit
        }
      })
      setOtpDigits(newOtp)
      // Focus the next empty input or the last one
      const nextIndex = Math.min(index + digits.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    // Single digit input
    if (value && !/^\d$/.test(value)) return

    const newOtp = [...otpDigits]
    newOtp[index] = value
    setOtpDigits(newOtp)

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }, [otpDigits])

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [otpDigits])

  const handleVerifyOtp = async () => {
    const code = otpDigits.join('')
    if (code.length !== 6) {
      setError('Please enter all 6 digits.')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Verify the OTP code
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
      })

      const verifyResult = await verifyResponse.json()

      if (!verifyResponse.ok) {
        setError(verifyResult.error || 'Verification failed.')
        setLoading(false)
        return
      }

      // Sign in via NextAuth OTP provider
      const signInResult = await signIn('otp', {
        email: email.trim().toLowerCase(),
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
    await handleSendOtp()
  }

  const handleGoogleSignIn = (e: GestureResponderEvent) => {
    e.preventDefault()
    e.stopPropagation()
    signIn('google', { callbackUrl: '/profile' })
  }

  if (!isHydrated) return null

  return (
    <YStack maxWidth={450} margin="auto" padding="$4" gap="$4">
      {step === 'email' ? (
        <>
          <YStack gap="$2" alignItems="center">
            <Heading size="$8">Create Account</Heading>
            <Paragraph color="$gray11" textAlign="center">
              Getting started is simple. Enter your email address and we'll send you a verification code.
              Once verified, you can set up your profile.
            </Paragraph>
          </YStack>

          <YStack gap="$4">
            <YStack gap="$2">
              <Text fontWeight="600">Email Address</Text>
              <Input
                value={email}
                onChangeText={(val: string) => { setEmail(val); setError('') }}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                size="$4"
              />
            </YStack>

            <YStack
              padding="$3"
              backgroundColor="$blue2"
              borderRadius="$3"
              borderWidth={1}
              borderColor="$blue6"
            >
              <Text fontSize="$2" color="$blue11">
                If you receive any correspondence from tee-admin.com, please use the email address
                we already send email to. You can add or update your email later.
              </Text>
            </YStack>

            {error ? (
              <Paragraph color="$red10" textAlign="center">
                {error}
              </Paragraph>
            ) : null}

            <Button
              onPress={handleSendOtp}
              size="$4"
              disabled={loading}
              theme="blue"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
            </Button>

            <XStack alignItems="center" gap="$3">
              <Separator flex={1} />
              <Text fontSize="$3" color="$gray11">or</Text>
              <Separator flex={1} />
            </XStack>

            <Button
              onPress={handleGoogleSignIn}
              size="$4"
              variant="outlined"
            >
              Continue with Google
            </Button>

            <XStack justifyContent="center" gap="$2">
              <Text fontSize="$3" color="$gray11">
                Already have an account?
              </Text>
              <Link
                href="/auth/signin"
                style={{
                  fontSize: '14px',
                  color: '#0066CC',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Sign in
              </Link>
            </XStack>
          </YStack>
        </>
      ) : (
        <>
          <YStack gap="$2" alignItems="center">
            <Heading size="$8">Check Your Email</Heading>
            <Paragraph color="$gray11" textAlign="center">
              We sent a verification code to{' '}
              <Text fontWeight="bold">{email}</Text>
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
              <Paragraph color="$red10" textAlign="center">
                {error}
              </Paragraph>
            ) : null}

            <Button
              onPress={handleVerifyOtp}
              size="$4"
              disabled={loading}
              theme="blue"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </Button>

            <XStack justifyContent="center" gap="$2">
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
                onPress={() => {
                  setStep('email')
                  setError('')
                  setOtpDigits(['', '', '', '', '', ''])
                }}
              >
                Use a different email
              </Text>
            </XStack>
          </YStack>
        </>
      )}
    </YStack>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RegisterPageContent />
    </Suspense>
  )
}
