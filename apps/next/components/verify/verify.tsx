'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { YStack, XStack, Text, Heading, Button, Paragraph, Input, Separator } from '@my/ui'

/**
 * <Verify> — the reusable step-up challenge (Epic #84, slice B).
 *
 * Elevates a `recognized` (or stale `authenticated`) viewer to a freshly-proven
 * `authenticated` session at the moment a sensitive action or page demands it.
 * Offers, in order of convenience:
 *   1. Google re-auth   — one tap if they're a Google account (redirects out and
 *      back; the return re-stamps `authTime`).
 *   2. Password         — re-enter the on-file password (no redirect).
 *   3. OTP              — a 6-digit code to the ON-FILE address only. This is the
 *      forward-safety anchor: a forwarder holding the email link can VIEW, but
 *      only the true addressee receives the code, so only they can ACT.
 *
 * On success the caller's `onVerified` fires — the caller then retries whatever
 * triggered the challenge. The server is the real boundary (`requireFreshAuth`);
 * this component only drives the re-auth. Mount it in response to a
 * `403 { stepUpRequired: true }`.
 */
export interface VerifyProps {
  /**
   * The on-file address the OTP is sent to. Defaults to the current session's
   * email (the recognized identity). Pass explicitly when challenging for a
   * specific address (e.g. from a token flow).
   */
  email?: string
  /** Short reason shown under the heading — e.g. "to change your login email". */
  reason?: string
  /** Fired once the session has been raised to a fresh `authenticated`. */
  onVerified: () => void
  /** Optional cancel affordance (e.g. close the modal). */
  onCancel?: () => void
  /** Restrict the offered methods. Default: all three, availability-aware. */
  methods?: Array<'google' | 'password' | 'otp'>
  /** Where Google re-auth returns to. Default: the current URL. */
  returnTo?: string
}

type View = 'main' | 'otp'

// Theme-aware input styling that reads as a real field in BOTH light and dark:
// a strong surface fill, a full-contrast border, and full-contrast text.
const INPUT_STYLE = {
  backgroundColor: '$backgroundStrong',
  borderColor: '$borderColor',
  borderWidth: 1,
  color: '$color12',
} as const

export function Verify({
  email,
  reason,
  onVerified,
  onCancel,
  methods = ['google', 'password', 'otp'],
  returnTo,
}: VerifyProps) {
  const isHydrated = useHydrated()
  const { data: session } = useSession()
  // The address we challenge: explicit prop → session email. Lower-cased so the
  // OTP lookup matches how addresses are stored.
  const targetEmail = (email ?? session?.user?.email ?? '').trim().toLowerCase()

  const [view, setView] = useState<View>('main')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const otpRef = useRef<any>(null)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const clearError = () => {
    if (error) setError('')
  }

  const showGoogle = methods.includes('google')
  const showPassword = methods.includes('password')
  const showOtp = methods.includes('otp')

  // --- Google re-auth: redirects out; the return re-stamps authTime. ---
  const handleGoogle = useCallback(() => {
    const callbackUrl =
      returnTo ?? (typeof window !== 'undefined' ? window.location.href : '/')
    signIn('google', { callbackUrl })
  }, [returnTo])

  // --- Password re-entry: no redirect; onVerified on success. ---
  const handlePassword = async () => {
    if (!targetEmail) {
      setError('We could not determine your account email.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await signIn('credentials', {
        email: targetEmail,
        password,
        redirect: false,
      })
      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? 'Incorrect password.' : 'Verification failed.')
        return
      }
      if (res?.ok) onVerified()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // --- OTP to the on-file address. ---
  const sendOtp = async () => {
    if (!targetEmail) {
      setError('We could not determine your account email.')
      return
    }
    setLoading(true)
    setError('')
    try {
      // Anti-enumeration: the endpoint always 200s. We surface a generic success
      // by advancing to the code view regardless.
      await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      setView('otp')
      setOtp('')
      setResendCooldown(60)
    } catch {
      setError('Could not send a code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Enter all 6 digits.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const vr = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, code: otp }),
      })
      if (!vr.ok) {
        const j = await vr.json().catch(() => ({}))
        setError(j.error || 'That code didn’t work — check it and try again.')
        return
      }
      // Mint the fresh authenticated session (re-stamps authTime).
      const res = await signIn('otp', { email: targetEmail, otpToken: otp, redirect: false })
      if (res?.error) {
        setError('Verification failed. Please try again.')
        return
      }
      onVerified()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resend = async () => {
    if (resendCooldown > 0) return
    await sendOtp()
  }

  // Avoid an SSR/CSR mismatch — the challenge depends on the client session.
  if (!isHydrated) return null

  // ============ OTP VIEW ============
  if (view === 'otp') {
    return (
      <YStack maxWidth={400} marginHorizontal="auto" padding="$4" gap="$4">
        <YStack gap="$2" alignItems="center">
          <Heading size="$7" color="$color12">Enter your code</Heading>
          <Paragraph color="$color11" textAlign="center">
            We sent a 6-digit code to <Text fontWeight="bold" color="$color12">{targetEmail}</Text>.
          </Paragraph>
        </YStack>

        <YStack gap="$4">
          <Input
            {...INPUT_STYLE}
            ref={otpRef}
            value={otp}
            onChangeText={(t: string) => {
              setOtp(t.replace(/\D/g, '').slice(0, 6))
              clearError()
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            textAlign="center"
            fontFamily="$mono"
            fontSize="$9"
            letterSpacing={12}
            size="$5"
            placeholder="------"
          />

          {error ? (
            <Paragraph color="$red10" textAlign="center">
              {error}
            </Paragraph>
          ) : null}

          <Button
            onPress={verifyOtp}
            size="$4"
            disabled={loading || otp.length !== 6}
            backgroundColor="$blue10"
            color="white"
            hoverStyle={{ backgroundColor: '$blue11' }}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </Button>

          <XStack justifyContent="center">
            {resendCooldown > 0 ? (
              <Text fontSize="$3" color="$color11">
                Resend code in {resendCooldown}s
              </Text>
            ) : (
              <Text
                fontSize="$3"
                color="$blue10"
                textDecorationLine="underline"
                cursor="pointer"
                onPress={resend}
              >
                Didn’t receive it? Resend
              </Text>
            )}
          </XStack>

          <XStack justifyContent="center">
            <Text
              fontSize="$3"
              color="$color11"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={() => {
                setView('main')
                setError('')
                setOtp('')
              }}
            >
              Use another method
            </Text>
          </XStack>
        </YStack>
      </YStack>
    )
  }

  // ============ MAIN VIEW ============
  return (
    <YStack maxWidth={400} marginHorizontal="auto" padding="$4" gap="$4">
      <YStack gap="$2" alignItems="center">
        <Heading size="$7" color="$color12">Confirm it’s you</Heading>
        <Paragraph color="$color11" textAlign="center">
          {reason ? `Please confirm your identity ${reason}.` : 'Please confirm your identity to continue.'}
        </Paragraph>
      </YStack>

      <YStack gap="$4">
        {showGoogle ? (
          <Button
            onPress={handleGoogle}
            size="$4"
            variant="outlined"
            borderColor="$borderColor"
            hoverStyle={{ backgroundColor: '$backgroundHover', borderColor: '$borderColor' }}
          >
            Continue with Google
          </Button>
        ) : null}

        {showPassword ? (
          <YStack gap="$2">
            <Text fontWeight="600" color="$color12">Password</Text>
            <Input
              {...INPUT_STYLE}
              value={password}
              onChangeText={(val: string) => {
                setPassword(val)
                clearError()
              }}
              placeholder="Enter your password"
              autoComplete="current-password"
              secureTextEntry
              size="$4"
            />
            <Button
              onPress={handlePassword}
              size="$4"
              disabled={loading}
              backgroundColor="$blue10"
              color="white"
              hoverStyle={{ backgroundColor: '$blue11' }}
            >
              {loading ? 'Confirming…' : 'Confirm with password'}
            </Button>
          </YStack>
        ) : null}

        {showOtp ? (
          <YStack gap="$4">
            {showGoogle || showPassword ? (
              <XStack alignItems="center" gap="$3">
                <Separator flex={1} />
                <Text fontSize="$2" color="$color11">OR</Text>
                <Separator flex={1} />
              </XStack>
            ) : null}
            <Button
              onPress={sendOtp}
              size="$4"
              disabled={loading}
              variant="outlined"
              borderColor="$borderColor"
              hoverStyle={{ backgroundColor: '$backgroundHover', borderColor: '$borderColor' }}
            >
              {loading ? 'Sending…' : 'Email me a 6-digit code'}
            </Button>
          </YStack>
        ) : null}

        {error ? (
          <Paragraph color="$red10" textAlign="center">
            {error}
          </Paragraph>
        ) : null}

        {onCancel ? (
          <XStack justifyContent="center">
            <Text
              fontSize="$3"
              color="$color11"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={onCancel}
            >
              Cancel
            </Text>
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
