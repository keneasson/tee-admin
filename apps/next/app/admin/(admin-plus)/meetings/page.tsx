'use client'

import { useAdminAccess } from '@/hooks/use-admin-access'
import { YStack, XStack, Text, Spinner, Heading, Card, Button, Separator } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useState, useEffect } from 'react'
import { Calendar, MapPin, Video, Eye, Send, Plus, Users } from '@tamagui/lucide-icons'
import { useFeatureFlag } from '@my/app/features/feature-flags/use-feature-flag'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import type { MeetingRecord } from '@my/app/types/meetings'
import { MEETING_TYPE_LABELS } from '@my/app/types/meetings'

export default function AdminMeetingsPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const multiTenantEnabled = useFeatureFlag(FEATURE_FLAGS.MULTI_TENANT_INIT)
  const [meetings, setMeetings] = useState<MeetingRecord[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (hasAccess) {
      loadMeetings()
    }
  }, [hasAccess])

  const loadMeetings = async () => {
    try {
      setLoadingMeetings(true)
      const response = await fetch('/api/admin/meetings')
      if (!response.ok) {
        throw new Error('Failed to fetch meetings')
      }
      const data = await response.json()
      setMeetings(data.meetings || data || [])
    } catch (error) {
      console.error('Failed to load meetings:', error)
      setStatusMessage({ type: 'error', text: 'Failed to load meetings' })
    } finally {
      setLoadingMeetings(false)
    }
  }

  const handlePreview = (meetingId: string) => {
    window.open(`/api/admin/meetings/${meetingId}/preview`, '_blank')
  }

  const handleSend = async (meetingId: string, test: boolean) => {
    const confirmMsg = test
      ? 'Send test email to yourself?'
      : 'Send this meeting email to the full audience now?'
    if (!window.confirm(confirmMsg)) return

    setSendingId(meetingId)
    setStatusMessage(null)
    try {
      const url = `/api/admin/meetings/${meetingId}/send${test ? '?test=true' : ''}`
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        setStatusMessage({
          type: 'success',
          text: test ? 'Test email sent' : `Sent to ${data.recipientCount ?? '?'} recipients`,
        })
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to send' })
      }
    } catch (error) {
      setStatusMessage({ type: 'error', text: 'An error occurred while sending' })
    } finally {
      setSendingId(null)
    }
  }

  if (!isHydrated || isLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!hasAccess) {
    return (
      <YStack flex={1} padding="$4">
        <Text>Access denied. Admin access required.</Text>
      </YStack>
    )
  }

  if (!multiTenantEnabled) {
    return (
      <YStack flex={1} padding="$4">
        <Heading size="$8">Meeting Manager</Heading>
        <Text marginTop="$3" color="$textSecondary">
          The Meeting Manager requires the MULTI_TENANT_INIT feature flag to be enabled.
        </Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" space="$4">
      <YStack space="$2">
        <Heading size="$8">Meeting Manager</Heading>
        <Text color="$textSecondary">
          Manage member-facing meeting reminders (business meetings, committee meetings). Meetings
          are distinct from Events — they're expected reminders for selected audiences.
        </Text>
      </YStack>

      {statusMessage ? (
        <Card
          padding="$3"
          backgroundColor={statusMessage.type === 'success' ? '$green2' : '$red2'}
          borderWidth={1}
          borderColor={statusMessage.type === 'success' ? '$green6' : '$red6'}
        >
          <Text color={statusMessage.type === 'success' ? '$green11' : '$red11'}>
            {statusMessage.text}
          </Text>
        </Card>
      ) : null}

      <Card padding="$3" backgroundColor="$blue2" borderWidth={1} borderColor="$blue6">
        <Text fontSize="$3" color="$blue11">
          The full editor UI is coming in a future phase. For now, create and edit meetings via the
          REST API at <Text fontFamily="$mono">/api/admin/meetings</Text>. You can preview and send
          existing meetings from the list below.
        </Text>
      </Card>

      <XStack space="$3">
        <Button size="$3" icon={Plus} disabled theme="blue">
          Create Meeting (coming soon)
        </Button>
        <Button size="$3" onPress={loadMeetings} variant="outlined">
          Refresh
        </Button>
      </XStack>

      {loadingMeetings ? (
        <YStack justifyContent="center" alignItems="center" padding="$6">
          <Spinner size="large" />
          <Text marginTop="$3">Loading meetings...</Text>
        </YStack>
      ) : meetings.length === 0 ? (
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <Text color="$textSecondary">
            No meetings yet. Create one via <Text fontFamily="$mono">POST /api/admin/meetings</Text>.
          </Text>
        </Card>
      ) : (
        <YStack space="$3">
          {meetings.map((meeting) => (
            <Card key={meeting.meetingId} padding="$4" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3">
                <XStack justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap="$2">
                  <YStack flex={1} minWidth={200} space="$1">
                    <Text fontSize="$5" fontWeight="600">{meeting.title}</Text>
                    <XStack space="$2" alignItems="center" flexWrap="wrap">
                      <Text fontSize="$2" color="$textSecondary">
                        {MEETING_TYPE_LABELS[meeting.meetingType]}
                      </Text>
                      <Text fontSize="$2" color="$textSecondary">•</Text>
                      <Text fontSize="$2" color="$textSecondary">
                        {meeting.ownerType === 'ecclesia' ? '🏛' : '🤝'} {meeting.ownerName}
                      </Text>
                      {meeting.active ? null : (
                        <>
                          <Text fontSize="$2" color="$textSecondary">•</Text>
                          <Text fontSize="$2" color="$red10">Inactive</Text>
                        </>
                      )}
                    </XStack>
                  </YStack>
                </XStack>

                <Separator />

                <XStack space="$4" flexWrap="wrap">
                  <XStack space="$2" alignItems="center">
                    <Calendar size={14} color="$gray10" />
                    <Text fontSize="$3">
                      {meeting.nextOccurrence || meeting.oneOffDate || 'No date set'} at {meeting.startTime}
                    </Text>
                  </XStack>
                  <XStack space="$2" alignItems="center">
                    {meeting.platform === 'online' ? <Video size={14} color="$gray10" /> : null}
                    {meeting.platform === 'in_person' ? <MapPin size={14} color="$gray10" /> : null}
                    {meeting.platform === 'hybrid' ? (
                      <>
                        <Video size={14} color="$gray10" />
                        <MapPin size={14} color="$gray10" />
                      </>
                    ) : null}
                    <Text fontSize="$3" textTransform="capitalize">
                      {meeting.platform.replace('_', ' ')}
                    </Text>
                  </XStack>
                  <XStack space="$2" alignItems="center">
                    <Users size={14} color="$gray10" />
                    <Text fontSize="$3">
                      {meeting.audience.type === 'ses_topic'
                        ? `Topic: ${meeting.audience.topic}`
                        : meeting.audience.type === 'ecclesia_members'
                        ? `Members of ${meeting.audience.ecclesia}`
                        : meeting.audience.type === 'organization_members'
                        ? `Members of ${meeting.audience.organizationName}`
                        : `Custom list (${meeting.audience.emails.length})`}
                    </Text>
                  </XStack>
                </XStack>

                {meeting.supersedes ? (
                  <Text fontSize="$2" color="$orange11">
                    Supersedes regular {meeting.supersedes.scheduleType} email
                  </Text>
                ) : null}

                <XStack space="$2" flexWrap="wrap">
                  <Button
                    size="$3"
                    icon={Eye}
                    variant="outlined"
                    onPress={() => handlePreview(meeting.meetingId)}
                  >
                    Preview
                  </Button>
                  <Button
                    size="$3"
                    icon={Send}
                    variant="outlined"
                    onPress={() => handleSend(meeting.meetingId, true)}
                    disabled={sendingId === meeting.meetingId}
                  >
                    Send Test
                  </Button>
                  <Button
                    size="$3"
                    icon={sendingId === meeting.meetingId ? <Spinner size="small" width={16} height={16} /> : Send}
                    theme="blue"
                    onPress={() => handleSend(meeting.meetingId, false)}
                    disabled={sendingId === meeting.meetingId}
                  >
                    {sendingId === meeting.meetingId ? 'Sending...' : 'Send to Audience'}
                  </Button>
                </XStack>
              </YStack>
            </Card>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
