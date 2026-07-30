'use client'

import React, { useState, useEffect } from 'react'
import {
  Adapt,
  Button,
  Card,
  Checkbox,
  Heading,
  Input,
  Paragraph,
  Select,
  Separator,
  Sheet,
  Spinner,
  Text,
  XStack,
  YStack,
} from '@my/ui'
import { Check, Search, Send, X, UserCheck } from '@tamagui/lucide-icons'
import {
  searchPeople,
  sendToOneRecipient,
  getPendingNote,
  type DirectSendPerson,
} from '../../provider/get-data'
import { EmailReasonType, AuthSession } from '@my/app/types'

/**
 * Direct-recipient send (Issue #127). A permission-gated, 1:1 send for honouring
 * a SPECIFIC request — someone who opted out of the standing list but asked for
 * this one email, or a visitor who wants a specific bulletin.
 *
 * It deliberately IGNORES test mode (real content → the requesting person) and so
 * requires an explicit permission attestation. It NEVER subscribes the recipient
 * or touches the contact list — the server route (`/api/email/send-one`) does the
 * actual 1:1 send and re-checks the attestation.
 *
 * Shared-package rule: no next-auth/next imports — `session` arrives as a prop.
 */

const REASON_OPTIONS: { id: EmailReasonType; label: string }[] = [
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'recap', label: 'Memorial recap' },
  { id: 'bible-class', label: 'Bible Class' },
  { id: 'sunday-school', label: 'Sunday School' },
]

function reasonLabel(reason: string): string {
  return REASON_OPTIONS.find((r) => r.id === reason)?.label ?? reason
}

export interface DirectRecipientSendProps {
  session: AuthSession | null
}

export const DirectRecipientSend: React.FC<DirectRecipientSendProps> = ({ session }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DirectSendPerson[]>([])
  const [searching, setSearching] = useState(false)

  const [selected, setSelected] = useState<DirectSendPerson | null>(null)
  const [toEmail, setToEmail] = useState<string>('')

  const [reason, setReason] = useState<EmailReasonType | ''>('')
  const [noteHasNote, setNoteHasNote] = useState<boolean | null>(null)

  const [permission, setPermission] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Debounced people search (name OR email). Skips while a person is selected.
  useEffect(() => {
    if (selected) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    const handle = setTimeout(async () => {
      const people = await searchPeople(q)
      if (!cancelled) {
        setResults(people)
        setSearching(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [query, selected])

  // When a type is chosen, fetch whether a note is attached (for the confirm).
  useEffect(() => {
    if (!reason) {
      setNoteHasNote(null)
      return
    }
    let cancelled = false
    getPendingNote(reason).then((res) => {
      if (!cancelled) setNoteHasNote(!!res.note)
    })
    return () => {
      cancelled = true
    }
  }, [reason])

  const selectPerson = (person: DirectSendPerson) => {
    setSelected(person)
    setToEmail(person.email)
    setResults([])
    setQuery(person.name)
    setResult(null)
  }

  const clearPerson = () => {
    setSelected(null)
    setToEmail('')
    setQuery('')
    setConfirming(false)
  }

  const resetAll = () => {
    setSelected(null)
    setToEmail('')
    setQuery('')
    setReason('')
    setPermission(false)
    setConfirming(false)
    setNoteHasNote(null)
  }

  const canReview = !!selected && !!toEmail && !!reason && permission && !sending

  const doSend = async () => {
    if (!selected || !toEmail || !reason) return
    setSending(true)
    setResult(null)
    const res = await sendToOneRecipient({
      reason,
      to: toEmail,
      recipientName: selected.name,
      permission: true,
    })
    setSending(false)
    setConfirming(false)
    if (res.ok) {
      setResult({
        type: 'success',
        text: `Sent ${reasonLabel(reason)} to ${selected.name} <${toEmail}>.`,
      })
      resetAll()
    } else {
      setResult({ type: 'error', text: res.error || 'Send failed.' })
    }
  }

  return (
    <Card elevate bordered padding="$4" backgroundColor="$blue2" borderColor="$blue6">
      <YStack gap="$3">
        <XStack gap="$2" alignItems="center">
          <UserCheck size={18} color="$blue10" />
          <Heading size={4} color="$blue11">
            Send to a specific requester
          </Heading>
        </XStack>
        <Text fontSize="$3" color="$blue10">
          One-off send to a single person who has explicitly asked for an email — even if they’re not
          on the mailing list. This ignores Test Mode and sends the real email to the address below.
          It does not subscribe them or change any list.
        </Text>

        {/* 1. Recipient search */}
        {selected ? (
          <Card bordered padding="$3" backgroundColor="$background">
            <XStack gap="$3" alignItems="center">
              <YStack flex={1}>
                <Text fontWeight="700">{selected.name}</Text>
                <Text fontSize="$2" color="$color10">
                  {selected.ecclesia ?? ''}
                </Text>
              </YStack>
              <Button size="$2" chromeless icon={X} onPress={clearPerson}>
                Change
              </Button>
            </XStack>

            {/* Which address (when the person has more than one) */}
            {selected.emails.length > 1 ? (
              <YStack gap="$1" marginTop="$3">
                <Text fontSize="$2" fontWeight="600">
                  Send to which address
                </Text>
                <Select value={toEmail} onValueChange={setToEmail}>
                  <Select.Trigger minWidth={260} iconAfter={null} backgroundColor="$background">
                    <Select.Value placeholder="Choose an address…" />
                  </Select.Trigger>
                  <Adapt when="sm" platform="touch">
                    <Sheet native modal dismissOnSnapToBottom>
                      <Sheet.Frame>
                        <Sheet.ScrollView>
                          <Adapt.Contents />
                        </Sheet.ScrollView>
                      </Sheet.Frame>
                      <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
                    </Sheet>
                  </Adapt>
                  <Select.Content zIndex={200000 as any}>
                    <Select.Viewport>
                      <Select.Group>
                        {selected.emails.map((addr, idx) => (
                          <Select.Item key={addr} index={idx} value={addr}>
                            <Select.ItemText>{addr}</Select.ItemText>
                            <Select.ItemIndicator>
                              <Check size={16} />
                            </Select.ItemIndicator>
                          </Select.Item>
                        ))}
                      </Select.Group>
                    </Select.Viewport>
                  </Select.Content>
                </Select>
              </YStack>
            ) : (
              <Text fontSize="$2" color="$color10" marginTop="$2">
                {toEmail}
              </Text>
            )}
          </Card>
        ) : (
          <YStack gap="$2">
            <XStack gap="$2" alignItems="center">
              <Search size={16} color="$blue10" />
              <Text fontSize="$3" fontWeight="600">
                Find the person (name or email)
              </Text>
            </XStack>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Start typing a name or email…"
              backgroundColor="$background"
            />
            {searching ? (
              <XStack gap="$2" alignItems="center" padding="$2">
                <Spinner size="small" width={16} height={16} />
                <Text fontSize="$2" color="$color10">
                  Searching…
                </Text>
              </XStack>
            ) : null}
            {!searching && results.length > 0 ? (
              <YStack gap="$1" borderWidth={1} borderColor="$borderColor" borderRadius="$3" padding="$2">
                {results.slice(0, 8).map((person) => (
                  <Button
                    key={person.id}
                    size="$3"
                    chromeless
                    justifyContent="flex-start"
                    onPress={() => selectPerson(person)}
                  >
                    <YStack alignItems="flex-start">
                      <Text fontWeight="600">{person.name}</Text>
                      <Text fontSize="$2" color="$color10">
                        {person.email}
                        {person.ecclesia ? ` · ${person.ecclesia}` : ''}
                      </Text>
                    </YStack>
                  </Button>
                ))}
              </YStack>
            ) : null}
            {!searching && query.trim().length >= 2 && results.length === 0 ? (
              <Text fontSize="$2" color="$color10">
                No matches — check the spelling, or try their email.
              </Text>
            ) : null}
          </YStack>
        )}

        {/* 2. Email type */}
        <YStack gap="$1">
          <Text fontSize="$3" fontWeight="600">
            Which email did they request?
          </Text>
          <Select value={reason} onValueChange={(v) => setReason(v as EmailReasonType)}>
            <Select.Trigger minWidth={260} iconAfter={null} backgroundColor="$background">
              <Select.Value placeholder="Select an email type…" />
            </Select.Trigger>
            <Adapt when="sm" platform="touch">
              <Sheet native modal dismissOnSnapToBottom>
                <Sheet.Frame>
                  <Sheet.ScrollView>
                    <Adapt.Contents />
                  </Sheet.ScrollView>
                </Sheet.Frame>
                <Sheet.Overlay animation="lazy" enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
              </Sheet>
            </Adapt>
            <Select.Content zIndex={200000 as any}>
              <Select.Viewport>
                <Select.Group>
                  {REASON_OPTIONS.map((opt, idx) => (
                    <Select.Item key={opt.id} index={idx} value={opt.id}>
                      <Select.ItemText>{opt.label}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check size={16} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Group>
              </Select.Viewport>
            </Select.Content>
          </Select>
        </YStack>

        {/* 3. Permission attestation (required) */}
        <XStack gap="$3" alignItems="center">
          <Checkbox
            checked={permission}
            onCheckedChange={(c) => setPermission(!!c)}
            aria-label="Permission attestation"
            size="$4"
          >
            <Checkbox.Indicator>
              <Check />
            </Checkbox.Indicator>
          </Checkbox>
          <Text flex={1} fontSize="$3">
            I have received permission from the owner of this email address to send this email to them.
          </Text>
        </XStack>

        <Separator />

        {/* 4. Review → confirm → send */}
        {confirming ? (
          <Card bordered padding="$4" backgroundColor="$background" borderColor="$blue7">
            <YStack gap="$2">
              <Text fontSize="$3" color="$color10">
                Please confirm:
              </Text>
              <Text>
                <Text fontWeight="700">Sending to: </Text>
                {selected?.name} &lt;{toEmail}&gt;
              </Text>
              <Text>
                <Text fontWeight="700">Email Type: </Text>
                {reasonLabel(reason)}
              </Text>
              <Text color="$color10">
                {noteHasNote ? 'Includes the saved note for this email.' : 'No note attached.'}
              </Text>
              <XStack gap="$3" marginTop="$2">
                <Button
                  theme="blue"
                  icon={sending ? undefined : Send}
                  disabled={sending}
                  onPress={doSend}
                >
                  {sending ? 'Sending…' : 'Send Now'}
                </Button>
                <Button chromeless disabled={sending} onPress={() => setConfirming(false)}>
                  Cancel
                </Button>
              </XStack>
            </YStack>
          </Card>
        ) : (
          <Button
            theme="blue"
            icon={Send}
            disabled={!canReview}
            onPress={() => {
              setResult(null)
              setConfirming(true)
            }}
          >
            Review &amp; Send
          </Button>
        )}

        {result ? (
          <Card
            bordered
            padding="$3"
            backgroundColor={result.type === 'success' ? '$green2' : '$red2'}
            borderColor={result.type === 'success' ? '$green7' : '$red7'}
          >
            <Text color={result.type === 'success' ? '$green11' : '$red11'}>{result.text}</Text>
          </Card>
        ) : null}
      </YStack>
    </Card>
  )
}
