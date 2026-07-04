'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { maskEmail } from '@/utils/mask-email'
import { Loading } from '@my/app/provider/loading'
import {
  YStack,
  XStack,
  Text,
  H2,
  Paragraph,
  Spinner,
  Card,
  Checkbox,
  Input,
  Separator,
  Anchor,
} from 'tamagui'
import { Button } from '@my/ui'
import { Check, Mail } from '@tamagui/lucide-icons'

type Sub = { topic: string; label: string; subscribed: boolean }
type Tenant = { id: string; publicName: string; senderDomain: string }
type Data = { email: string; name: string | null; subscriptions: Sub[]; unsubscribedAll: boolean; tenant: Tenant }

/**
 * Public self-serve subscription page (#75). Replaces SES's hosted preference
 * page (which exposed every topic). Shows ONLY the public topics, greets the
 * person by name (resolved from the email token), offers a "Sign in" magic
 * link, and brands to whichever tenant serves it (tee-admin.com / echadhub.org).
 */
export default function SubscribePage() {
  const isHydrated = useHydrated()
  const token = useSearchParams()?.get('token') ?? null
  const { status } = useSession() // 'loading' | 'authenticated' | 'unauthenticated'

  const [data, setData] = useState<Data | null>(null)
  const [subs, setSubs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [emailInput, setEmailInput] = useState('')

  // Sign-in (step-up) flow: idle → 'code' once the OTP email is sent. The email
  // carries both a magic link and a 6-digit code; this lets them type the code.
  // Shared by the no-token "email me a link" path and the token "Sign in" path.
  const [signinPhase, setSigninPhase] = useState<'idle' | 'code'>('idle')
  const [signinEmail, setSigninEmail] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [signinError, setSigninError] = useState<string | null>(null)

  // Load preferences for whoever we can identify: a ?token= (from an email) OR
  // a live session (e.g. arriving signed-in from the profile page). With
  // neither we fall through to the "email me a code" form.
  useEffect(() => {
    if (!isHydrated || status === 'loading') return
    if (!token && status !== 'authenticated') {
      setLoading(false)
      return
    }
    let cancelled = false
    const url = token ? `/api/subscribe?token=${encodeURIComponent(token)}` : '/api/subscribe'
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('This link is invalid or has expired.'))))
      .then((d: Data) => {
        if (cancelled) return
        setData(d)
        setSubs(Object.fromEntries(d.subscriptions.map((s) => [s.topic, s.subscribed])))
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [isHydrated, token, status])

  const save = async () => {
    if (!token) return
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, subscriptions: subs }),
      })
      if (!res.ok) throw new Error('Could not save your preferences. Please try again.')
      setSaved(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const sendLink = async (email: string, onDone: () => void) => {
    await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Return here after the magic link verifies (not the default /profile).
      body: JSON.stringify({ email: email.trim().toLowerCase(), redirectPath: '/email-preferences' }),
    })
    onDone() // always succeeds (anti-enumeration)
  }

  // Step-up: send the OTP to `targetEmail`, then let them either click the
  // emailed link or type the 6-digit code here. Shared by both entry points —
  // the no-token "email me a link" flow and the token view's "Sign in".
  const startSignin = async (targetEmail: string) => {
    const em = (targetEmail || '').trim().toLowerCase()
    if (!em.includes('@')) return
    setSigninEmail(em)
    setSigninError(null)
    setCode('')
    setSigninPhase('code')
    await sendLink(em, () => {})
  }

  const verifyCode = async () => {
    if (!signinEmail || code.length !== 6) {
      setSigninError('Enter the 6-digit code from your email.')
      return
    }
    setVerifying(true)
    setSigninError(null)
    try {
      const vr = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signinEmail, code }),
      })
      if (!vr.ok) {
        const j = await vr.json().catch(() => ({}))
        setSigninError(j.error || 'That code didn’t work — check it and try again.')
        return
      }
      const res = await signIn('otp', { email: signinEmail, otpToken: code, redirect: false })
      if (res?.error) {
        setSigninError('Sign in failed. Please try again.')
        return
      }
      // Return to this page — now signed in, it loads their preferences via the
      // session (rather than dropping them on /profile).
      window.location.href = '/email-preferences'
    } catch {
      setSigninError('Something went wrong. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  if (!isHydrated || loading) return <Loading />

  const brand = data?.tenant?.publicName ?? 'Email Preferences'
  const homeUrl = data?.tenant?.senderDomain ? `https://www.${data.tenant.senderDomain}` : undefined
  // Eyebrow above the heading. With a token we show the tenant brand; without
  // one we don't know the tenant, so show a purposeful prompt instead of
  // repeating the "Email preferences" heading.
  const eyebrow = data?.tenant?.publicName ?? 'Please confirm your email'

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
      <Card elevate bordered padding="$6" gap="$4" maxWidth={460} width="100%">
        {/* Brand header — the clear entrypoint into whichever site serves this */}
        <YStack gap="$1" alignItems="center">
          <Text fontSize="$2" color="$textSecondary" textTransform="uppercase" letterSpacing={1}>
            {eyebrow}
          </Text>
          <H2 textAlign="center">Email preferences</H2>
        </YStack>

        {error ? <Paragraph color="$error" textAlign="center">{error}</Paragraph> : null}

        {/* Shared code-entry step — both the no-token "email me a link" flow and
            the token "Sign in" flow funnel here so there's always a place to
            type the 6-digit code (or click the emailed link). */}
        {signinPhase === 'code' ? (
          <YStack gap="$3">
            <Paragraph fontSize="$3" textAlign="center">
              We emailed a 6-digit code to{' '}
              <Text fontWeight="700">{maskEmail(signinEmail)}</Text>. Enter it below, or
              click the link in that email.
            </Paragraph>
            <Input
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textAlign="center"
              fontSize="$8"
              letterSpacing={10}
              maxLength={6}
            />
            {signinError ? (
              <Paragraph color="$error" fontSize="$2" textAlign="center">{signinError}</Paragraph>
            ) : null}
            <Button
              backgroundColor="$primary"
              color="white"
              hoverStyle={{ backgroundColor: '$primaryHover' }}
              disabled={verifying || code.length !== 6}
              icon={verifying ? <Spinner size="small" color="white" /> : undefined}
              onPress={verifyCode}
            >
              {verifying ? 'Verifying…' : 'Verify & sign in'}
            </Button>
            <XStack justifyContent="center" gap="$4">
              <Text color="$textSecondary" fontSize="$2" cursor="pointer" onPress={() => startSignin(signinEmail)}>
                Resend code
              </Text>
              <Text color="$textSecondary" fontSize="$2" cursor="pointer" onPress={() => { setSigninPhase('idle'); setCode(''); setSigninError(null) }}>
                Use a different email
              </Text>
            </XStack>
          </YStack>
        ) : !data ? (
          /* No identity yet (no token, not signed in) → collect an email, send a code */
          <YStack gap="$3">
            <Paragraph color="$textSecondary" textAlign="center">
              Enter your email address and we’ll send you a secure code to manage your subscriptions.
            </Paragraph>
            <Input
              placeholder="you@example.com"
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Button
              backgroundColor="$primary"
              color="white"
              icon={Mail}
              hoverStyle={{ backgroundColor: '$primaryHover' }}
              disabled={!emailInput.includes('@')}
              onPress={() => startSignin(emailInput)}
            >
              Email My Link
            </Button>
          </YStack>
        ) : (
          <YStack gap="$4">
            <YStack gap="$1">
              <Paragraph fontWeight="700">
                {data.name ? `Hi ${data.name},` : 'Manage your subscriptions'}
              </Paragraph>
              <Paragraph fontSize="$2" color="$textSecondary">{maskEmail(data.email)}</Paragraph>
            </YStack>

            <YStack gap="$3">
              {data.subscriptions.map((s) => (
                <XStack key={s.topic} gap="$3" alignItems="center">
                  <Checkbox
                    id={s.topic}
                    checked={!!subs[s.topic]}
                    onCheckedChange={(v) => setSubs((cur) => ({ ...cur, [s.topic]: !!v }))}
                    size="$5"
                  >
                    <Checkbox.Indicator>
                      <Check />
                    </Checkbox.Indicator>
                  </Checkbox>
                  <Text flex={1} onPress={() => setSubs((cur) => ({ ...cur, [s.topic]: !cur[s.topic] }))}>
                    {s.label}
                  </Text>
                </XStack>
              ))}
            </YStack>

            <Button
              backgroundColor="$primary"
              color="white"
              hoverStyle={{ backgroundColor: '$primaryHover' }}
              disabled={saving}
              icon={saving ? <Spinner size="small" color="white" /> : saved ? Check : undefined}
              onPress={save}
            >
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save preferences'}
            </Button>

            <Separator />

            {/* Already signed in → point at the full profile. Otherwise offer
                step-up: the shared code-entry step (above) does the work. */}
            {status === 'authenticated' ? (
              <XStack justifyContent="center">
                <Anchor href="/profile" color="$textSecondary" fontSize="$3">
                  Manage everything in your profile →
                </Anchor>
              </XStack>
            ) : (
              <YStack gap="$2">
                <Paragraph fontSize="$3" color="$textSecondary">
                  Want to view your profile and manage everything in one place?
                </Paragraph>
                <Button
                  variant="outlined"
                  borderColor="$primary"
                  color="$primary"
                  icon={Mail}
                  hoverStyle={{ backgroundColor: '$backgroundHover', borderColor: '$primary' }}
                  onPress={() => startSignin(data.email)}
                >
                  Sign in
                </Button>
              </YStack>
            )}
          </YStack>
        )}

        {homeUrl ? (
          <XStack justifyContent="center">
            <Anchor href={homeUrl} color="$textSecondary" fontSize="$2">
              ← Back to {brand}
            </Anchor>
          </XStack>
        ) : null}
      </Card>
    </YStack>
  )
}
