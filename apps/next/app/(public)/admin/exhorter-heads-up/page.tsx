'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Section, YStack, XStack, Text, Heading, Button, Card, Spinner } from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Send, AlertTriangle, CheckCircle2, Ban, RefreshCw } from '@tamagui/lucide-icons'

/**
 * Confirm and send an exhorter heads-up that was redirected for QA.
 *
 * **This page is not the review.** The review happened in an inbox: the actual
 * email was redirected to the Recording Brother, who read it in a real mail
 * client. This is only the button at the end of that — a confirmation of who it
 * goes to, and the press that sends it.
 *
 * It deliberately does NOT re-render the email. Showing it here would invite
 * checking it here, and an iframe is a simulation, not a mail client. The
 * content fingerprint recorded when the QA copy was sent is what guarantees the
 * email despatched is the one that was read.
 *
 * Three things can happen here:
 *   - **Looks good, send it** — the exhorter gets the email that was read.
 *   - **Stop, there's a problem** — the copy is invalidated on the spot, so the
 *     wrong email cannot be sent while the data is being corrected.
 *   - **Re-send the verification email** — after the fix, a fresh copy with a
 *     fresh link, rendered from the corrected schedule.
 *
 * Every one is a POST. Mail clients prefetch links, so the footer link must
 * never do anything by itself.
 */

interface Suppression {
  suppressed: boolean
  reason?: string
  since?: string
  unknown?: boolean
}

interface Delivery {
  status?: string
  deliveredAt?: string
  opens?: number
  bouncedAt?: string
  bounceType?: string
}

interface ConfirmData {
  date: string
  recipientName?: string
  recipientEmail: string
  subject: string
  /** The schedule now names a different brother — do not send. */
  changed: boolean
  suppression?: Suppression
}

export default function ExhorterHeadsUpReviewPage() {
  const isHydrated = useHydrated()
  const params = useSearchParams()
  /**
   * The token is a convenience, not a requirement.
   *
   * Arriving from the link in the QA email carries one, which is what lets the
   * Recording Brother act from a phone without signing in. Opening this page
   * directly carries none, and it finds whatever is awaiting verification —
   * because a page you can only reach from an email is a page you cannot find.
   */
  const linkToken = params?.get('token') ?? ''
  const [token, setToken] = useState(linkToken)

  const [data, setData] = useState<ConfirmData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [alreadySent, setAlreadySent] = useState<{
    recipientName?: string
    recipientEmail?: string
    sentAt?: string
    delivery?: Delivery
  } | null>(null)
  /**
   * Stopped: the email was wrong and it has been invalidated.
   *
   * The link stays usable afterwards, because fixing the Program happens
   * elsewhere and in between — the same link in the same email is how you get
   * back here to re-send once the data is right.
   */
  const [stopped, setStopped] = useState<{ date?: string; recipientName?: string } | null>(null)
  const [busyAction, setBusyAction] = useState<'invalidate' | 'resend' | null>(null)
  const [resentTo, setResentTo] = useState<string | null>(null)
  const [nothingWaiting, setNothingWaiting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        linkToken
          ? `/api/admin/exhorter-heads-up/review?token=${encodeURIComponent(linkToken)}`
          : '/api/admin/exhorter-heads-up/review',
        { cache: 'no-store' }
      )
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Already sent is not a failure — it is the answer to "did this go
        // out?", and now also "did it arrive?".
        if (body.alreadySent) {
          setAlreadySent({
            recipientName: body.recipientName,
            recipientEmail: body.recipientEmail,
            sentAt: body.sentAt,
            delivery: body.delivery,
          })
          return
        }
        if (body.superseded) {
          setStopped({ date: body.date, recipientName: body.recipientName })
          return
        }
        throw new Error(body.error || 'Could not load this heads-up.')
      }
      if (body.nothingWaiting) {
        setNothingWaiting(true)
        return
      }
      // Opened without a token: the server tells us which copy this is, so the
      // buttons have something to act on.
      if (body.token) setToken(String(body.token))
      setData(body as ConfirmData)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load this heads-up.')
    } finally {
      setLoading(false)
    }
  }, [linkToken])

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

  const act = async (action: 'invalidate' | 'resend') => {
    setBusyAction(action)
    setSendError(null)
    try {
      const res = await fetch('/api/admin/exhorter-heads-up/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token, action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'That did not work.')
      if (action === 'invalidate') {
        setStopped({ date: body.date, recipientName: body.recipientName })
        setData(null)
      } else {
        setResentTo(body.redirectedTo ?? null)
      }
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setBusyAction(null)
    }
  }

  if (!isHydrated || loading) {
    return (
      <Wrapper>
        <Section>
          <Spinner size="large" width={32} height={32} />
        </Section>
      </Wrapper>
    )
  }

  const name = data?.recipientName || data?.recipientEmail || 'the exhorter'

  return (
    <Wrapper>
      <Section>
        <YStack gap="$4" maxWidth={640} width="100%" alignSelf="center">
          <Heading>Send the exhortation heads-up</Heading>

          {/* The ordinary case: nothing is waiting on a decision. Said plainly,
              because most visits to a findable page will look like this. */}
          {nothingWaiting ? (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <YStack gap="$1">
                <Text fontSize="$4">No email waiting to be verified.</Text>
                <Text fontSize="$3" theme="alt2">
                  A copy is sent here on the Saturday two weeks before each exhortation. When one
                  is waiting, this page is where you check it and send it on.
                </Text>
              </YStack>
            </Card>
          ) : null}

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

          {alreadySent ? (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <YStack gap="$2">
                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                  <CheckCircle2 size={18} color="$success" />
                  <Text fontSize="$4">
                    {`Already sent to ${alreadySent.recipientName || alreadySent.recipientEmail}.`}
                  </Text>
                </XStack>
                {alreadySent.delivery?.bouncedAt ? (
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <AlertTriangle size={16} color="$error" />
                    <Text fontSize="$3" color="$error">
                      {`It BOUNCED${alreadySent.delivery.bounceType ? ` (${alreadySent.delivery.bounceType})` : ''} — they have not been told. Reach them another way.`}
                    </Text>
                  </XStack>
                ) : alreadySent.delivery?.deliveredAt ? (
                  <Text fontSize="$3" theme="alt2">
                    {`Delivered${
                      alreadySent.delivery.opens
                        ? `, and opened ${alreadySent.delivery.opens}×`
                        : ' — not opened yet'
                    }.`}
                  </Text>
                ) : (
                  <Text fontSize="$3" theme="alt2">
                    Delivery not confirmed yet — events can take a few minutes.
                  </Text>
                )}
              </YStack>
            </Card>
          ) : null}

          {data && !sentTo ? (
            <YStack gap="$3">
              <Text fontSize="$4">
                {'Send the email you just read to '}
                <Text fontWeight="700">{name}</Text>
                {` (${data.recipientEmail}), for the exhortation on `}
                <Text fontWeight="700">{data.date}</Text>
                {'.'}
              </Text>
              <Text fontSize="$2" theme="alt2">
                {`Subject: ${data.subject}`}
              </Text>

              {/* The schedule can be edited after the QA copy goes out.
                  Approving an email for one brother must never send it to
                  another, so this blocks rather than silently retargeting. */}
              {data.changed ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <AlertTriangle size={16} color="$warning" />
                    <Text fontSize="$3">
                      The schedule now shows a different exhorter for this Sunday. Nothing will be
                      sent — check the schedule and run a fresh heads-up.
                    </Text>
                  </XStack>
                </Card>
              ) : null}

              {/* An address on the SES suppression list is dropped silently —
                  no bounce, no error, the brother simply never hears. Said
                  before the press, because that is when it can be acted on. */}
              {data.suppression?.suppressed ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <YStack gap="$1">
                    <XStack gap="$2" alignItems="center" flexWrap="wrap">
                      <AlertTriangle size={16} color="$error" />
                      <Text fontSize="$3" fontWeight="700" color="$error">
                        This address is on the suppression list — sending will go nowhere.
                      </Text>
                    </XStack>
                    <Text fontSize="$3">
                      {`AWS is refusing mail to ${data.recipientEmail}${
                        data.suppression.reason
                          ? ` after a ${data.suppression.reason.toLowerCase()}`
                          : ''
                      }. They will not receive this, and there will be no bounce to tell you.`}
                    </Text>
                  </YStack>
                </Card>
              ) : data.suppression?.unknown ? (
                <Text fontSize="$2" theme="alt2">
                  Could not check the suppression list — send anyway, but confirm they received it.
                </Text>
              ) : null}

              {sendError ? (
                <Text fontSize="$3" color="$error">
                  {sendError}
                </Text>
              ) : null}

              {/* Two answers to "is this email right?". Stopping is the one
                  that has to be quick and obvious — it is pressed when
                  something is wrong, and it closes the door immediately rather
                  than after the correction has been made. */}
              <XStack gap="$2" justifyContent="flex-end" flexWrap="wrap">
                <Button
                  theme="red"
                  icon={Ban}
                  disabled={sending || busyAction !== null}
                  onPress={() => act('invalidate')}
                >
                  {busyAction === 'invalidate' ? 'Stopping…' : "Stop! there's a problem"}
                </Button>
                <Button
                  theme="green"
                  icon={Send}
                  disabled={sending || data.changed || busyAction !== null}
                  onPress={send}
                >
                  {sending ? 'Sending…' : `Looks good, send to ${name}`}
                </Button>
              </XStack>
            </YStack>
          ) : null}

          {/* Stopped. Nothing can be sent from the old copy now; fixing the
              Program happens elsewhere, then a fresh copy comes from here. */}
          {stopped && !sentTo ? (
            <YStack gap="$3">
              <Card padding="$3" backgroundColor="$backgroundHover">
                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                  <Ban size={18} color="$error" />
                  <Text fontSize="$4">
                    {`Stopped. Nothing has been sent${
                      stopped.recipientName ? ` to ${stopped.recipientName}` : ''
                    }, and that copy can no longer be sent.`}
                  </Text>
                </XStack>
              </Card>

              <Text fontSize="$3">
                Correct the Program, give the schedule a moment to sync, then re-send the
                verification email. You will get a fresh copy with a fresh link.
              </Text>

              {resentTo ? (
                <Card padding="$3" backgroundColor="$backgroundHover">
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <CheckCircle2 size={18} color="$success" />
                    <Text fontSize="$4">
                      {`A new copy is on its way to ${resentTo}. Check it, then send from the link in that email.`}
                    </Text>
                  </XStack>
                </Card>
              ) : null}

              {sendError ? (
                <Text fontSize="$3" color="$error">
                  {sendError}
                </Text>
              ) : null}

              {!resentTo ? (
                <XStack gap="$2" justifyContent="flex-end">
                  <Button
                    theme="blue"
                    icon={RefreshCw}
                    disabled={busyAction !== null}
                    onPress={() => act('resend')}
                  >
                    {busyAction === 'resend' ? 'Re-sending…' : 'Re-send verification email'}
                  </Button>
                </XStack>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
      </Section>
    </Wrapper>
  )
}
