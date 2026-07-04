'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useHydrated } from '@my/app/hooks/use-hydrated'
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

  const [data, setData] = useState<Data | null>(null)
  const [subs, setSubs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [signinSent, setSigninSent] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [linkSent, setLinkSent] = useState(false)

  useEffect(() => {
    if (!isHydrated || !token) {
      if (isHydrated) setLoading(false)
      return
    }
    let cancelled = false
    fetch(`/api/subscribe?token=${encodeURIComponent(token)}`)
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
  }, [isHydrated, token])

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
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })
    onDone() // always succeeds (anti-enumeration)
  }

  if (!isHydrated || loading) return <Loading />

  const brand = data?.tenant?.publicName ?? 'Email Preferences'
  const homeUrl = data?.tenant?.senderDomain ? `https://www.${data.tenant.senderDomain}` : undefined

  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
      <Card elevate bordered padding="$6" gap="$4" maxWidth={460} width="100%">
        {/* Brand header — the clear entrypoint into whichever site serves this */}
        <YStack gap="$1" alignItems="center">
          <Text fontSize="$2" color="$textSecondary" textTransform="uppercase" letterSpacing={1}>
            {brand}
          </Text>
          <H2 textAlign="center">Email preferences</H2>
        </YStack>

        {error ? <Paragraph color="$error" textAlign="center">{error}</Paragraph> : null}

        {/* No token → let them request a link */}
        {!token ? (
          linkSent ? (
            <Paragraph textAlign="center">
              If that email is on file, we’ve sent a link to manage your preferences. Check your inbox.
            </Paragraph>
          ) : (
            <YStack gap="$3">
              <Paragraph color="$textSecondary" textAlign="center">
                Enter your email and we’ll send you a secure link to manage your subscriptions.
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
                onPress={() => sendLink(emailInput, () => setLinkSent(true))}
              >
                Email me a link
              </Button>
            </YStack>
          )
        ) : data ? (
          <YStack gap="$4">
            <YStack gap="$1">
              <Paragraph fontWeight="700">
                {data.name ? `Hi ${data.name},` : 'Manage your subscriptions'}
              </Paragraph>
              <Paragraph fontSize="$2" color="$textSecondary">{data.email}</Paragraph>
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

            {/* Sign-in as a confirmation: emails a full-auth magic link */}
            <YStack gap="$2">
              <Paragraph fontSize="$3" color="$textSecondary">
                Want to view your profile and manage everything in one place?
              </Paragraph>
              {signinSent ? (
                <Paragraph color="$success" fontSize="$3">
                  ✓ Check your email — we’ve sent {data.email} a secure sign-in link.
                </Paragraph>
              ) : (
                <Button
                  variant="outlined"
                  borderColor="$primary"
                  color="$primary"
                  icon={Mail}
                  hoverStyle={{ backgroundColor: '$backgroundHover', borderColor: '$primary' }}
                  onPress={() => sendLink(data.email, () => setSigninSent(true))}
                >
                  Sign in (email me a link)
                </Button>
              )}
            </YStack>
          </YStack>
        ) : null}

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
