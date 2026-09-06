'use client'

import { useEffect, useState } from 'react'
import {
  Adapt,
  Button,
  Card,
  Heading,
  Select,
  Sheet,
  Spinner,
  Switch,
  Text,
  XStack,
  YStack,
} from '@my/ui'
import { Check, ChevronDown, ChevronUp } from '@tamagui/lucide-icons'
import { getContactsList, sendPostAnnouncement } from '../../provider/get-data'

type Audience = { key: string; label: string }

/**
 * PostSendPanel — the "Send announcement" action for the unified Post editor
 * (Consolidated CMS send bridge, epic #131 §4-E).
 *
 * Sends the current Post as an announcement email via
 * `POST /api/admin/posts/[id]/send` — the ONE occasion-agnostic path (funeral /
 * baptism / wedding / general all send with no per-type code).
 *
 * Safety UX (backed by server-side enforcement):
 *   - Enabled only when the post is `ready` (a draft can't be sent).
 *   - TEST MODE IS THE DEFAULT — the Live toggle is off until the author flips it,
 *     and a live send requires an explicit confirmation naming the audience.
 *   - The server hard-routes test sends to the test list and re-checks the gate,
 *     status, and tenant — this panel is the convenience layer, not the guard.
 *
 * Cross-platform (ADR-0003). Two platform couplings were lifted out:
 *   - the send call goes through `sendPostAnnouncement` in the shared data
 *     provider, so the API origin is decided in one place rather than by a
 *     relative-URL `fetch` that only resolves in a browser;
 *   - confirmation arrives as the `confirmSend` prop. `window.confirm` blocks
 *     the whole page on web and does not exist on native, so the platform
 *     supplies its own affirmative-confirmation step.
 *
 * No hand-rolled button colors — @my/ui Button variants only. No `&&` in JSX.
 */
export interface PostSendPanelProps {
  postId: string
  /** Only a published (`ready`) post can be sent — the server re-checks this. */
  ready: boolean
  /**
   * Platform confirmation. Returns true to proceed. Passed in because a blocking
   * `window.confirm` is web-only (and freezes the page); native supplies its own.
   */
  confirmSend: (message: string) => boolean | Promise<boolean>
}

export function PostSendPanel({ postId, ready, confirmSend }: PostSendPanelProps) {
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [audience, setAudience] = useState<string>('newsletter')
  const [live, setLive] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Same audience source as the News alert sender and Email Sender. The test
    // list is excluded — the Live toggle (off) already means "send to test list".
    getContactsList()
      .then((d) => {
        if (cancelled) return
        const lists = (d.lists ?? [])
          .filter((l) => l.key !== 'testList')
          .map((l) => ({ key: l.key, label: l.displayName }))
        setAudiences(lists)
        if (lists.length > 0 && !lists.some((l) => l.key === 'newsletter')) {
          setAudience(lists[0].key)
        }
      })
      .catch(() => {
        if (!cancelled) setAudiences([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const audienceLabel = audiences.find((a) => a.key === audience)?.label || audience

  const handleSend = async () => {
    const confirmMsg = live
      ? `Send this announcement LIVE to "${audienceLabel}"? This emails the whole audience.`
      : `Send a TEST announcement to the test list? (Live target would be: ${audienceLabel})`
    if (!(await confirmSend(confirmMsg))) return

    setSending(true)
    setMessage(null)
    setIsError(false)
    try {
      const data = await sendPostAnnouncement(postId, { test: !live, list: audience })
      setIsError(false)
      setMessage(
        `Sent ${data.test ? '(TEST — test list)' : `to ${audienceLabel}`}: ${data.sentCount} sent, ${data.skippedCount} skipped.`
      )
    } catch (err) {
      setIsError(true)
      setMessage(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card bordered padding="$4" gap="$3">
      <Heading size="$5">Send announcement</Heading>
      {ready ? null : (
        <Text fontSize="$3" color="$color10">
          Publish this post (status “ready”) to enable sending.
        </Text>
      )}

      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <YStack gap="$1">
          <Text fontSize="$2" color="$color10">
            Audience
          </Text>
          <Select
            value={audience}
            onValueChange={setAudience}
            disablePreventBodyScroll
          >
            <Select.Trigger width={220} iconAfter={ChevronDown} disabled={!ready || sending}>
              <Select.Value placeholder="Select audience" />
            </Select.Trigger>

            <Adapt when="sm" platform="touch">
              <Sheet modal dismissOnSnapToBottom snapPoints={[40]}>
                <Sheet.Frame>
                  <Sheet.ScrollView>
                    <Adapt.Contents />
                  </Sheet.ScrollView>
                </Sheet.Frame>
                <Sheet.Overlay />
              </Sheet>
            </Adapt>

            <Select.Content zIndex={200000}>
              <Select.ScrollUpButton alignItems="center" justifyContent="center" height="$3">
                <ChevronUp size={20} />
              </Select.ScrollUpButton>
              <Select.Viewport>
                <Select.Group>
                  {audiences.map((a, index) => (
                    <Select.Item key={a.key} index={index} value={a.key}>
                      <Select.ItemText>{a.label}</Select.ItemText>
                      <Select.ItemIndicator marginLeft="auto">
                        <Check size={16} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Viewport>
              <Select.ScrollDownButton alignItems="center" justifyContent="center" height="$3">
                <ChevronDown size={20} />
              </Select.ScrollDownButton>
            </Select.Content>
          </Select>
        </YStack>

        <YStack gap="$1">
          <Text fontSize="$2" color="$color10">
            {live ? 'Live send' : 'Test send (default)'}
          </Text>
          <XStack gap="$2" alignItems="center">
            <Switch
              size="$3"
              checked={live}
              onCheckedChange={(v) => setLive(!!v)}
              disabled={!ready || sending}
            >
              <Switch.Thumb animation="quick" />
            </Switch>
            <Text fontSize="$3">{live ? 'Live' : 'Test'}</Text>
          </XStack>
        </YStack>

        <Button
          variant={live ? 'danger' : 'action'}
          onPress={handleSend}
          disabled={!ready || sending || !audience}
          alignSelf="flex-end"
          icon={sending ? <Spinner size="small" /> : undefined}
        >
          {sending ? 'Sending…' : live ? 'Send LIVE' : 'Send test'}
        </Button>
      </XStack>

      {message ? (
        <Text fontSize="$3" color={isError ? '$red10' : '$green10'}>
          {message}
        </Text>
      ) : null}
    </Card>
  )
}
