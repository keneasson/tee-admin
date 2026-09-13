'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Section, YStack, XStack, Text, Heading, Button, Card, Spinner } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Send, AlertTriangle, CheckCircle2 } from '@tamagui/lucide-icons'

/**
 * Review an exhorter heads-up, then send it.
 *
 * The email we send the Recording Brother on a Saturday contains ONLY a link to
 * this page. Loading it sends nothing. The exhorter is written to when somebody
 * presses the button below — a POST from a deliberate press.
 *
 * That shape matters: mail clients prefetch and scan links, so a link that did
 * the sending could fire before anyone read a word of it.
 */

interface ReviewData {
  date: string
  recipientName?: string
  recipientEmail: string
  expiresAt: string
  changed: boolean
  subject: string
  html: string
}

export default function ExhorterHeadsUpReviewPage() {
  const isHydrated = useHydrated()
  const params = useSearchParams()
  const token = params?.get('token') ?? ''

  const [data, setData] = useState<ReviewData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) {
      setLoadError('This link is incomplete.')
      setLoading(false)
      return
    }
    try {
      const res = await fetch(
        `/api/admin/exhorter-heads-up/review?token=${encodeURIComponent(token)}`,
        { cache: 'no-store' }
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not load this heads-up.')
      setData(body as ReviewData)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load this heads-up.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const send = async () => {
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/admin/exhorter-heads-up/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not send this heads-up.')
      setSentTo(body.sentTo || data?.recipientEmail || null)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send this heads-up.')
    } finally {
      setSending(false)
    }
  }

  if (!isHydrated || loading) {
    return (
      <Wrapper>
        <Section>
          <Spinner />
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper>
      <Section>
        <YStack gap="$4" maxWidth={820} width="100%" alignSelf="center">
          <Heading>Exhortation heads-up</Heading>

          {loadError ? (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack gap="$2" alignItems="center">
                <AlertTriangle size={16} color="$warning" />
                <Text fontSize="$4">{loadError}</Text>
              </XStack>
            </Card>
          ) : null}

          {sentTo ? (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <XStack gap="$2" alignItems="center">
                <CheckCircle2 size={18} color="$success" />
                <Text fontSize="$4">{`Sent to ${sentTo}.`}</Text>
              </XStack>
            </Card>
          ) : null}

          {data && !sentTo ? (
            <YStack gap="$3">
              <Text fontSize="$4">
                {'This will be sent to '}
                <Text fontWeight="700">{data.recipientName || data.recipientEmail}</Text>
                {` (${data.recipientEmail}) for the exhortation on `}
                <Text fontWeight="700">{data.date}</Text>
                {'.'}
              </Text>

              {/* The schedule can be edited after the review email goes out.
                  Approving an email for one brother must never send it to
                  another, so the send is blocked rather than silently retargeted. */}
              {data.changed ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <AlertTriangle size={16} color="$warning" />
                    <Text fontSize="$3">
                      The schedule now shows a different exhorter for this Sunday. Nothing will be
                      sent — check the schedule and trigger a fresh heads-up.
                    </Text>
                  </XStack>
                </Card>
              ) : null}

              <Text fontSize="$2" theme="alt2">
                {`Subject: ${data.subject}`}
              </Text>

              {/* Exactly what they will receive, rendered fresh. */}
              <Card padding="$0" overflow="hidden">
                <iframe
                  title="The email as it will be received"
                  srcDoc={data.html}
                  style={{ width: '100%', height: 620, border: 'none', background: '#fff' }}
                />
              </Card>

              {sendError ? (
                <Text fontSize="$3" color="$error">
                  {sendError}
                </Text>
              ) : null}

              <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
                <Button
                  theme="green"
                  icon={Send}
                  disabled={sending || data.changed}
                  onPress={send}
                >
                  {sending
                    ? 'Sending…'
                    : `Send to ${data.recipientName || data.recipientEmail}`}
                </Button>
              </XStack>

              <Text fontSize="$2" theme="alt2">
                Nothing has been sent yet. It goes only when you press the button.
              </Text>
            </YStack>
          ) : null}
        </YStack>
      </Section>
    </Wrapper>
  )
}
