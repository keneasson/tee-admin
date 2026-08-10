'use client'

import React, { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Verify } from '@/components/verify/verify'
import {
  YStack,
  XStack,
  Text,
  Heading,
  Paragraph,
  Input,
  Button,
  Card,
  Separator,
} from '@my/ui'

const SUPPORT_CONTACT = 'teerecbro@gmail.com'

// Theme-aware field styling that reads as a real input in both light and dark.
const INPUT_STYLE = {
  backgroundColor: '$backgroundStrong',
  borderColor: '$borderColor',
  borderWidth: 1,
  color: '$color12',
} as const

type Step = 'email' | 'code' | 'done'

/**
 * <ChangeEmailFlow> — self-serve login-email change (flag-gated, launch-dark).
 *
 * Two proofs guard the change: the server's fresh-auth gate (origin — the
 * operator has just re-proven control of the account, surfaced here as a
 * `403 { stepUpRequired }` → <Verify>) and a 6-char code emailed to the NEW
 * address (destination — they can receive there). Only when both hold does the
 * server transfer the login identity.
 *
 * The whole component self-hides unless the `SECURE_EMAIL_CHANGE` flag is on.
 */
interface ChangeEmailFlowProps {
  /** Pre-fill the "new email" field (e.g. "Set as login" on an already-verified address). */
  initialEmail?: string
  /** Optional dismiss affordance (e.g. when launched in a modal). */
  onClose?: () => void
}

export function ChangeEmailFlow({ initialEmail, onClose }: ChangeEmailFlowProps = {}) {
  const isHydrated = useHydrated()

  // Launch-dark visibility resolved per session server-side (the client flag hook
  // is presence-based and can't gate this). Null = not yet known → render nothing.
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/user/email-change/available')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setAvailable(!!d?.available) })
      .catch(() => { if (!cancelled) setAvailable(false) })
    return () => { cancelled = true }
  }, [])

  const [step, setStep] = useState<Step>('email')
  const [newEmail, setNewEmail] = useState(initialEmail ?? '')
  const [newEmailMasked, setNewEmailMasked] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState<{ permanent: boolean; lockedUntil: number | null } | null>(null)
  const [doneMessage, setDoneMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // When the server demands a fresh step-up, we mount <Verify>; on success it
  // fires `stepUp` (the retry that re-runs the mutation that was challenged).
  const [stepUp, setStepUp] = useState<null | (() => void)>(null)

  // ---- Step 1: request a code to the new address ----
  const startChange = async () => {
    setLoading(true)
    setError('')
    setLocked(null)
    try {
      const res = await fetch('/api/user/email-change/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase() }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 403 && data?.stepUpRequired) {
        // Re-prove control, then retry this same request.
        setStepUp(() => () => {
          setStepUp(null)
          void startChange()
        })
        return
      }
      if (!res.ok) {
        setError(data?.error || 'Something went wrong. Please try again.')
        return
      }
      setNewEmailMasked(data.newEmailMasked || newEmail.trim().toLowerCase())
      setCode('')
      setStep('code')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ---- Step 2: confirm the emailed code ----
  const confirmChange = async () => {
    setLoading(true)
    setError('')
    setLocked(null)
    try {
      const res = await fetch('/api/user/email-change/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 403 && data?.stepUpRequired) {
        setStepUp(() => () => {
          setStepUp(null)
          void confirmChange()
        })
        return
      }
      if (res.status === 429 && data?.locked) {
        setLocked({ permanent: !!data.permanent, lockedUntil: data.lockedUntil ?? null })
        setError(data?.error || 'Too many incorrect codes.')
        return
      }
      if (!res.ok) {
        setError(data?.error || 'That code has expired or was already used. Start again to get a new one.')
        return
      }
      setDoneMessage(data.message || 'Your login email has been changed. Please sign in again with your new address.')
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut({ redirect: false })
    } finally {
      window.location.href = '/auth/signin'
    }
  }

  const resetToEmail = () => {
    setStep('email')
    setCode('')
    setError('')
    setLocked(null)
  }

  if (!isHydrated || available !== true) return null

  // A step-up challenge takes over the whole card until it resolves or cancels.
  if (stepUp) {
    return (
      <Card elevate bordered padding="$4" gap="$3">
        <Verify
          reason="to change your login email"
          onVerified={stepUp}
          onCancel={() => setStepUp(null)}
        />
      </Card>
    )
  }

  const lockedRetryText = (): string => {
    if (!locked || locked.permanent || !locked.lockedUntil) return ''
    const when = new Date(locked.lockedUntil)
    return `You can try again after ${when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  }

  return (
    <Card elevate bordered padding="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$2">
        <YStack gap="$2" flex={1}>
          <Heading size="$6" color="$color12">Change your login email</Heading>
          <Paragraph color="$color11">
            Changing your email is simple if you can receive one more email — at your new address.
          </Paragraph>
        </YStack>
        {onClose ? (
          <Button
            size="$2"
            chromeless
            circular
            aria-label="Close"
            onPress={onClose}
            disabled={loading || signingOut}
          >
            ✕
          </Button>
        ) : null}
      </XStack>

      {step === 'email' ? (
        <YStack gap="$3">
          <Text fontWeight="600" color="$color12">New email address</Text>
          <Input
            {...INPUT_STYLE}
            value={newEmail}
            onChangeText={(t: string) => {
              setNewEmail(t)
              setError('')
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            size="$4"
          />
          {error ? <Paragraph color="$red10">{error}</Paragraph> : null}
          <Button
            onPress={startChange}
            size="$4"
            disabled={loading || !newEmail.includes('@')}
            backgroundColor="$blue10"
            color="white"
            hoverStyle={{ backgroundColor: '$blue11' }}
          >
            {loading ? 'Sending…' : 'Send confirmation code'}
          </Button>
        </YStack>
      ) : null}

      {step === 'code' ? (
        <YStack gap="$3">
          <Paragraph color="$color11">
            We sent a 6-character code to{' '}
            <Text fontWeight="bold" color="$color12">{newEmailMasked}</Text>. Enter it below to
            finish the change.
          </Paragraph>
          <Input
            {...INPUT_STYLE}
            value={code}
            onChangeText={(t: string) => {
              setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
              setError('')
            }}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            maxLength={6}
            textAlign="center"
            fontFamily="$mono"
            fontSize="$8"
            letterSpacing={8}
            size="$5"
          />
          {error ? <Paragraph color="$red10">{error}</Paragraph> : null}
          {locked?.permanent ? (
            <Paragraph color="$red10">
              For your security this change is locked. Please contact {SUPPORT_CONTACT} to continue.
            </Paragraph>
          ) : locked ? (
            <Paragraph color="$color11">{lockedRetryText()}</Paragraph>
          ) : null}
          <Button
            onPress={confirmChange}
            size="$4"
            disabled={loading || code.length !== 6 || !!locked}
            backgroundColor="$blue10"
            color="white"
            hoverStyle={{ backgroundColor: '$blue11' }}
          >
            {loading ? 'Confirming…' : 'Confirm change'}
          </Button>
          <Separator />
          <XStack justifyContent="center">
            <Text
              fontSize="$3"
              color="$color11"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={resetToEmail}
            >
              Use a different email
            </Text>
          </XStack>
        </YStack>
      ) : null}

      {step === 'done' ? (
        <YStack gap="$3">
          <Paragraph color="$color12">{doneMessage}</Paragraph>
          <Button
            onPress={handleSignOut}
            size="$4"
            disabled={signingOut}
            backgroundColor="$blue10"
            color="white"
            hoverStyle={{ backgroundColor: '$blue11' }}
          >
            {signingOut ? 'Signing out…' : 'Sign out and sign in again'}
          </Button>
        </YStack>
      ) : null}
    </Card>
  )
}
