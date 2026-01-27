'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Button,
  Checkbox,
  Heading,
  Paragraph,
  Text,
  XStack,
  YStack,
  Card,
  Separator,
  Select,
} from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { Check, Send, AlertCircle, Users, Calendar, Filter } from '@tamagui/lucide-icons'
import { sendEmail } from '../../provider/get-data'
import { Event } from '@my/app/types/events'

// Confirmation dialog state type
interface ConfirmDialogState {
  isOpen: boolean
  eventName: string
  eventType: string
  isTest: boolean
  onConfirm: () => void
}

// Event type display names
const EVENT_TYPE_LABELS: Record<string, string> = {
  'study-weekend': 'Study Weekend',
  funeral: 'Funeral',
  baptism: 'Baptism',
  wedding: 'Wedding',
  engagement: 'Engagement',
  general: 'General Event',
}

export const InterEcclesiaEmailSender: React.FC = () => {
  const { data: session } = useSession()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendingEventId, setSendingEventId] = useState<string | null>(null)
  const [response, setResponse] = useState<any>(null)
  const [test, setTest] = useState(true) // Default to test mode
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    eventName: '',
    eventType: '',
    isTest: true,
    onConfirm: () => {},
  })

  // Load inter-ecclesia events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setLoading(true)
        const params = new URLSearchParams()
        if (typeFilter !== 'all') {
          params.set('types', typeFilter)
        }

        const res = await fetch(`/api/admin/email/inter-ecclesia?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setEvents(data.events || [])
        } else {
          console.error('Failed to fetch inter-ecclesia events:', res.status)
        }
      } catch (error) {
        console.error('Error loading inter-ecclesia events:', error)
      } finally {
        setLoading(false)
      }
    }
    loadEvents()
  }, [typeFilter])

  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Inter-Ecclesia Communications</Heading>
          <Paragraph>To access this section, please sign in.</Paragraph>
          <LogInUser />
        </Section>
      </Wrapper>
    )
  }

  const userRole = session.user.role
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Access Denied</Heading>
          <Paragraph>You need admin or owner permissions to access Inter-Ecclesia Communications.</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  // Get event name for display
  const getEventDisplayName = (event: Event): string => {
    switch (event.type) {
      case 'study-weekend':
        // For study weekends, show theme if available, otherwise title
        return (event as any).theme || event.title
      case 'funeral':
        const deceased = (event as any).deceased
        return deceased
          ? `${deceased.title || ''} ${deceased.firstName || ''} ${deceased.lastName || ''}`.trim()
          : event.title
      case 'baptism':
        const candidate = (event as any).candidate
        return candidate
          ? `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim()
          : event.title
      case 'wedding':
        const couple = (event as any).couple
        if (couple) {
          const bride = couple.bride
          const groom = couple.groom
          return `${bride?.firstName || ''} & ${groom?.firstName || ''}`
        }
        return event.title
      default:
        return event.title
    }
  }

  // Get event date for display
  const getEventDate = (event: Event): string => {
    let startDate: Date | undefined
    let endDate: Date | undefined

    switch (event.type) {
      case 'study-weekend':
        if ((event as any).dateRange) {
          startDate = new Date((event as any).dateRange.start)
          endDate = new Date((event as any).dateRange.end)
        }
        break
      case 'funeral':
        startDate = (event as any).serviceDate ? new Date((event as any).serviceDate) : undefined
        break
      case 'baptism':
        startDate = (event as any).baptismDate ? new Date((event as any).baptismDate) : undefined
        break
      case 'wedding':
        startDate = (event as any).ceremonyDate ? new Date((event as any).ceremonyDate) : undefined
        break
      default:
        startDate = (event as any).startDate ? new Date((event as any).startDate) : undefined
        endDate = (event as any).endDate ? new Date((event as any).endDate) : undefined
    }

    if (!startDate || isNaN(startDate.getTime())) return 'Date TBD'

    const formatOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }

    // For multi-day events, show date range
    if (endDate && !isNaN(endDate.getTime()) && endDate.getTime() !== startDate.getTime()) {
      return `${startDate.toLocaleDateString('en-US', formatOptions)} - ${endDate.toLocaleDateString('en-US', formatOptions)}`
    }

    return startDate.toLocaleDateString('en-US', formatOptions)
  }

  // Show confirmation dialog
  const showSendConfirmation = (event: Event) => {
    const eventName = getEventDisplayName(event)
    setConfirmDialog({
      isOpen: true,
      eventName,
      eventType: EVENT_TYPE_LABELS[event.type] || event.type,
      isTest: test,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        doSendEmail(event)
      },
    })
  }

  // Close confirmation dialog
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  // Send inter-ecclesia email
  const doSendEmail = async (event: Event) => {
    setSending(true)
    setSendingEventId(event.id)
    try {
      // Use the inter-ecclesia email type
      const result = await sendEmail('inter-ecclesia' as any, test, '', {
        eventId: event.id,
        eventType: event.type,
      })
      setResponse(result)
    } catch (error) {
      console.error('Error sending inter-ecclesia email:', error)
      setResponse({ error: 'Failed to send email', details: error })
    } finally {
      setSending(false)
      setSendingEventId(null)
    }
  }

  return (
    <Wrapper subHeader="Inter-Ecclesia Communications">
      <Section gap={'$4'}>
        {/* Header */}
        <YStack gap="$2">
          <XStack gap="$2" alignItems="center">
            <Users size={24} color="$purple10" />
            <Heading size={4}>Send to Recording Secretaries</Heading>
          </XStack>
          <Paragraph color="$gray11">
            Share event announcements with recording secretaries of other ecclesias.
            They will receive an email with details to share with their ecclesia.
          </Paragraph>
        </YStack>

        <Separator />

        {/* Test Mode Toggle */}
        <Card elevate bordered padding="$4" backgroundColor={test ? '$orange2' : '$red2'}>
          <XStack gap="$3" alignItems="center">
            {test ? (
              <AlertCircle size={20} color="$orange10" />
            ) : (
              <AlertCircle size={20} color="$red10" />
            )}
            <Text fontWeight="600" fontSize="$5">
              {test ? 'TEST MODE' : 'LIVE MODE'}
            </Text>
            <XStack flex={1} />
            <XStack gap="$2" alignItems="center">
              <Text>Send to test list:</Text>
              <Checkbox
                onCheckedChange={(checked) => setTest(!!checked)}
                checked={test}
                aria-label={'Toggle Test Mode'}
                size="$4"
              >
                <Checkbox.Indicator>
                  <Check />
                </Checkbox.Indicator>
              </Checkbox>
            </XStack>
          </XStack>
          {!test ? (
            <Text fontSize="$3" color="$red10" marginTop="$2">
              ⚠️ WARNING: Emails will be sent to ALL recording secretaries
            </Text>
          ) : null}
        </Card>

        {/* Filters */}
        <Card bordered padding="$4" backgroundColor="$backgroundHover">
          <XStack gap="$4" alignItems="center" flexWrap="wrap">
            <XStack gap="$2" alignItems="center">
              <Filter size={16} />
              <Text fontWeight="600">Filter by Type:</Text>
            </XStack>
            <Select
              value={typeFilter}
              onValueChange={setTypeFilter}
              size="$3"
            >
              <Select.Trigger width={180}>
                <Select.Value placeholder="Select type..." />
              </Select.Trigger>
              <Select.Content>
                <Select.ScrollUpButton />
                <Select.Viewport>
                  <Select.Item value="all" index={0}>
                    <Select.ItemText>All Types</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="study-weekend" index={1}>
                    <Select.ItemText>Study Weekend</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="funeral" index={2}>
                    <Select.ItemText>Funeral</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="baptism" index={3}>
                    <Select.ItemText>Baptism</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="wedding" index={4}>
                    <Select.ItemText>Wedding</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="engagement" index={5}>
                    <Select.ItemText>Engagement</Select.ItemText>
                  </Select.Item>
                  <Select.Item value="general" index={6}>
                    <Select.ItemText>General Event</Select.ItemText>
                  </Select.Item>
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
            <Text fontSize="$3" color="$gray10">
              Showing events from Toronto East
            </Text>
          </XStack>
        </Card>

        {/* Events List */}
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <Heading size={3}>Shareable Events</Heading>
            <Text fontSize="$3" color="$gray10">
              {events.length} event{events.length !== 1 ? 's' : ''} found
            </Text>
          </XStack>

          {loading ? (
            <Card bordered padding="$6" alignItems="center">
              <Text>Loading events...</Text>
            </Card>
          ) : events.length === 0 ? (
            <Card bordered padding="$6" alignItems="center">
              <Text color="$gray10">No shareable events found for the selected filters.</Text>
            </Card>
          ) : (
            <YStack gap="$2">
              {events.map((event) => (
                <Card
                  key={event.id}
                  bordered
                  padding="$4"
                  backgroundColor="$background"
                  hoverStyle={{ backgroundColor: '$backgroundHover' }}
                >
                  <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
                    <YStack gap="$1" flex={1} minWidth={200}>
                      <XStack gap="$2" alignItems="center">
                        <Card
                          padding="$1"
                          paddingHorizontal="$2"
                          backgroundColor={
                            event.type === 'funeral' ? '$gray4' :
                            event.type === 'baptism' ? '$blue4' :
                            event.type === 'wedding' ? '$pink4' :
                            '$purple4'
                          }
                          borderRadius="$2"
                        >
                          <Text fontSize="$2" fontWeight="600">
                            {EVENT_TYPE_LABELS[event.type] || event.type}
                          </Text>
                        </Card>
                        <Text fontWeight="600" fontSize="$4">
                          {getEventDisplayName(event)}
                        </Text>
                      </XStack>
                      <XStack gap="$2" alignItems="center">
                        <Calendar size={14} color="$gray10" />
                        <Text fontSize="$3" color="$gray10">
                          {getEventDate(event)}
                        </Text>
                      </XStack>
                    </YStack>
                    <Button
                      size="$3"
                      theme="active"
                      icon={Send}
                      onPress={() => showSendConfirmation(event)}
                      disabled={sending}
                      opacity={sending && sendingEventId !== event.id ? 0.5 : 1}
                    >
                      {sending && sendingEventId === event.id ? 'Sending...' : 'Send'}
                    </Button>
                  </XStack>
                </Card>
              ))}
            </YStack>
          )}
        </YStack>

        {/* Response Display */}
        {response ? (
          <Card elevate bordered padding="$4" backgroundColor="$background">
            <YStack gap="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Heading size={4}>Send Response</Heading>
                <Button size="$3" onPress={() => setResponse(null)}>
                  Clear
                </Button>
              </XStack>

              <Card padding="$3" backgroundColor="$gray2">
                {response.error || response.failed ? (
                  <YStack gap="$2">
                    <Text color="$red10" fontWeight="600">
                      ❌ Error: {
                        typeof response.error === 'string' ? response.error :
                        typeof response.failed === 'string' ? response.failed :
                        response.failed?.message ||
                        response.error?.message ||
                        'Unknown error'
                      }
                    </Text>
                    <Card padding="$2" backgroundColor="$gray3" borderRadius="$2">
                      <Text fontSize="$2" fontFamily="$mono" color="$gray11">
                        {JSON.stringify(response.failed || response.error || response, null, 2)}
                      </Text>
                    </Card>
                  </YStack>
                ) : response.sends ? (
                  <YStack gap="$2">
                    <Text color="$green10" fontWeight="600">
                      ✅ Successfully sent to {response.sends.length} recipient{response.sends.length !== 1 ? 's' : ''}
                    </Text>
                    {response.skips && response.skips.length > 0 ? (
                      <Text color="$orange10">
                        ⚠️ Skipped {response.skips.length} recipient{response.skips.length !== 1 ? 's' : ''}
                      </Text>
                    ) : null}
                    {/* Show recipient list for debugging */}
                    {response.sends.length > 0 ? (
                      <Card padding="$2" backgroundColor="$gray3" borderRadius="$2" marginTop="$2">
                        <Text fontSize="$2" color="$gray10" marginBottom="$1">Sent to:</Text>
                        <Text fontSize="$2" fontFamily="$mono" color="$gray11">
                          {response.sends.join(', ')}
                        </Text>
                      </Card>
                    ) : null}
                  </YStack>
                ) : (
                  <YStack gap="$2">
                    <Text color="$orange10" fontWeight="600">
                      ⚠️ Unexpected response format
                    </Text>
                    <Card padding="$2" backgroundColor="$gray3" borderRadius="$2">
                      <Text fontSize="$2" fontFamily="$mono" color="$gray11">
                        {JSON.stringify(response, null, 2)}
                      </Text>
                    </Card>
                  </YStack>
                )}
              </Card>
            </YStack>
          </Card>
        ) : null}
      </Section>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen ? (
        <Card
          elevate
          bordered
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={1000}
          backgroundColor="rgba(0,0,0,0.5)"
          alignItems="center"
          justifyContent="center"
        >
          <Card
            elevate
            bordered
            padding="$4"
            backgroundColor="$background"
            maxWidth={500}
            width="90%"
            gap="$4"
          >
            <Heading size={4}>Confirm Inter-Ecclesia Send</Heading>

            <YStack gap="$3">
              <Card padding="$3" backgroundColor={confirmDialog.isTest ? '$orange2' : '$red2'}>
                <YStack gap="$2">
                  <XStack gap="$2" alignItems="center">
                    <AlertCircle size={20} color={confirmDialog.isTest ? '$orange10' : '$red10'} />
                    <Text fontWeight="600" fontSize="$5" color={confirmDialog.isTest ? '$orange11' : '$red11'}>
                      {confirmDialog.isTest ? 'TEST MODE' : 'LIVE MODE'}
                    </Text>
                  </XStack>
                  {!confirmDialog.isTest ? (
                    <Text fontSize="$3" color="$red10">
                      This will send to ALL recording secretaries!
                    </Text>
                  ) : null}
                </YStack>
              </Card>

              <YStack gap="$2" padding="$3" backgroundColor="$gray2" borderRadius="$3">
                <XStack gap="$2">
                  <Text fontWeight="600" minWidth={80}>Event:</Text>
                  <Text flex={1}>{confirmDialog.eventName}</Text>
                </XStack>
                <XStack gap="$2">
                  <Text fontWeight="600" minWidth={80}>Type:</Text>
                  <Text flex={1}>{confirmDialog.eventType}</Text>
                </XStack>
                <XStack gap="$2">
                  <Text fontWeight="600" minWidth={80}>Send to:</Text>
                  <Text flex={1} color={confirmDialog.isTest ? '$gray11' : '$red10'}>
                    {confirmDialog.isTest ? 'Test List (internal only)' : 'All Recording Secretaries'}
                  </Text>
                </XStack>
              </YStack>
            </YStack>

            <XStack justifyContent="flex-end" gap="$3">
              <Button variant="outlined" onPress={closeConfirmDialog}>
                Cancel
              </Button>
              <Button
                theme="active"
                onPress={confirmDialog.onConfirm}
              >
                Confirm Send
              </Button>
            </XStack>
          </Card>
        </Card>
      ) : null}
    </Wrapper>
  )
}
