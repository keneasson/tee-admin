'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { YStack, XStack, Text, Heading, Button, Paragraph, Input, Separator, Label } from '@my/ui'
import { maskEmail } from '@/utils/mask-email'

/**
 * <Verify> — the reusable step-up challenge (Epic #84, slice B).
 *
 * Elevates a `recognized` (or stale `authenticated`) viewer to a freshly-proven
 * `authenticated` session at the moment a sensitive action or page demands it.
 * Every method confirms the ONE on-file address (shown masked) — never a new
 * address — so it's unambiguous which inbox/credentials are being proven.
 * Offers, in order presented:
 *   1. OTP              — "Email me a code" to the ON-FILE address only, FIRST.
 *      This is the forward-safety anchor: a forwarder holding the email link can
 *      VIEW, but only the true addressee receives the code, so only they can ACT.
 *   2. Password         — re-enter the on-file password (no redirect).
 *   3. Social re-auth   — Google / Facebook, one tap (redirects out and back;
 *      the return re-stamps `authTime`). Facebook only appears once configured
 *      (`NEXT_PUBLIC_FACEBOOK_ENABLED === 'true'`).
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
  // Facebook is client-gated on a public flag so no dead button ships before the
  // Meta app + Vercel env vars are configured (see EXTERNAL_CHANGES.md).
  const showFacebook =
    showGoogle && process.env.NEXT_PUBLIC_FACEBOOK_ENABLED === 'true'
  const showSocial = showGoogle || showFacebook
  const maskedEmail = targetEmail ? maskEmail(targetEmail) : ''

  // --- Social re-auth: redirects out; the return re-stamps authTime. ---
  const socialCallbackUrl = () =>
    returnTo ?? (typeof window !== 'undefined' ? window.location.href : '/')

  const handleGoogle = useCallback(() => {
    signIn('google', { callbackUrl: socialCallbackUrl() })
  }, [returnTo])

  const handleFacebook = useCallback(() => {
    signIn('facebook', { callbackUrl: socialCallbackUrl() })
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
            We sent a code to <Text fontWeight="bold" color="$color12">{maskedEmail}</Text>.
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
            variant="action"
            disabled={loading || otp.length !== 6}
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
          To protect you, we need to confirm the email address we have on file
          {reason ? ` ${reason}` : ''}.
        </Paragraph>
        {maskedEmail ? (
          <Text fontWeight="700" fontSize="$5" color="$color12">
            {maskedEmail}
          </Text>
        ) : null}
      </YStack>

      <YStack gap="$4">
        <Text fontSize="$2" color="$color11" textTransform="uppercase" letterSpacing={1}>
          Pick one
        </Text>

        {/* Three distinct, equally-valid choices, each separated by an OR divider.
            Copy stays first-person throughout ("me"/"my") so the voice is consistent. */}

        {/* 1 — Email me a code (OTP). A clear primary action; advances to the code view. */}
        {showOtp ? (
          <YStack gap="$2">
            <Button onPress={sendOtp} size="$4" variant="action" disabled={loading}>
              {loading ? 'Sending…' : 'Email me a code'}
            </Button>
            {maskedEmail ? (
              <Text fontSize="$2" color="$color11" textAlign="center">
                We’ll send it to {maskedEmail}
              </Text>
            ) : null}
          </YStack>
        ) : null}

        {/* OR — between "email me a code" and "re-enter my password" */}
        {showOtp && showPassword ? (
          <XStack alignItems="center" gap="$3">
            <Separator flex={1} />
            <Text fontSize="$2" color="$color11" fontWeight="600">OR</Text>
            <Separator flex={1} />
          </XStack>
        ) : null}

        {/* 2 — Re-enter my password (shown only if this account has one set). Real
            <Label> (not a placeholder), compact one-row input + a primary Verify. */}
        {showPassword ? (
          <YStack gap="$2">
            <Label htmlFor="verify-password" fontWeight="600" color="$color12">
              Re-enter my password
            </Label>
            <XStack gap="$2" alignItems="center">
              <Input
                {...INPUT_STYLE}
                flex={1}
                id="verify-password"
                value={password}
                onChangeText={(val: string) => {
                  setPassword(val)
                  clearError()
                }}
                autoComplete="current-password"
                secureTextEntry
                size="$4"
                onSubmitEditing={handlePassword}
              />
              <Button onPress={handlePassword} size="$4" variant="action" disabled={loading}>
                {loading ? '…' : 'Verify'}
              </Button>
            </XStack>
          </YStack>
        ) : null}

        {/* OR — between the on-file methods and social login */}
        {(showOtp || showPassword) && showSocial ? (
          <XStack alignItems="center" gap="$3">
            <Separator flex={1} />
            <Text fontSize="$2" color="$color11" fontWeight="600">OR</Text>
            <Separator flex={1} />
          </XStack>
        ) : null}

        {/* 3 — Social login. Quiet bordered choices. */}
        {showSocial ? (
          <YStack gap="$3">
            {showGoogle ? (
              <Button onPress={handleGoogle} size="$4" variant="outlined">
                Continue with Google
              </Button>
            ) : null}
            {showFacebook ? (
              <Button onPress={handleFacebook} size="$4" variant="outlined">
                Continue with Facebook
              </Button>
            ) : null}
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
