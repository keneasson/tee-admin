'use client'

import React, { useState, useEffect } from 'react'
import {
  Button,
  Checkbox,
  Heading,
  Paragraph,
  Text,
  TextArea,
  XStack,
  YStack,
  Card,
  Separator,
  Tabs,
} from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { Check, Send, Mail, AlertCircle, Edit3 } from '@tamagui/lucide-icons'
import { sendEmail, getContactsList } from '../../provider/get-data'
import { CustomEmailCreator } from '../custom-email-creator'
import { EmailListTypeKeys, EmailReasonType, AuthSession, AuthStatus } from '@my/app/types'
import { Event } from '@my/app/types/events'

// Confirmation dialog state type
interface ConfirmDialogState {
  isOpen: boolean
  emailName: string
  emailType: string
  listName: string
  isTest: boolean
  onConfirm: () => void
}

/**
 * Props for EmailSender component
 * Session must be passed from platform-specific wrapper (not using next-auth hooks directly)
 */
export interface EmailSenderProps {
  session: AuthSession | null
  status?: AuthStatus
}

export const EmailSender: React.FC<EmailSenderProps> = ({ session, status = 'authenticated' }) => {
  const [email, setEmail] = useState<any>(null)
  const [reason, setReason] = useState<string | null>(null)
  const [test, setTest] = useState<boolean>(true) // Default to test mode for safety
  const [sending, setSending] = useState<boolean>(false)
  const [note, setNote] = useState<string>('')
  const [availableLists, setAvailableLists] = useState<{ key: EmailListTypeKeys; label: string }[]>([])
  const [activeTab, setActiveTab] = useState<string>('templates')
  const [recentEvents, setRecentEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true)
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    emailName: '',
    emailType: '',
    listName: '',
    isTest: true,
    onConfirm: () => {},
  })

  const MAX_NOTE_LENGTH = 500

  // Load available email lists
  useEffect(() => {
    const loadLists = async () => {
      try {
        const lists = await getContactsList()
        setAvailableLists(
          lists.lists.map((list) => ({
            key: list.key,
            label: list.displayName,
          }))
        )
      } catch (error) {
        console.error('Failed to load email lists:', error)
      }
    }
    loadLists()
  }, [])

  // Load recent funeral/baptism events (created within 2 weeks)
  useEffect(() => {
    const loadRecentEvents = async () => {
      try {
        setLoadingEvents(true)
        const response = await fetch('/api/admin/events')
        if (response.ok) {
          const data = await response.json()
          const twoWeeksAgo = new Date()
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

          // API returns array directly, not { events: [...] }
          const events = Array.isArray(data) ? data : (data.events || [])

          // Filter for funerals and baptisms created within 2 weeks
          const recent = events.filter((event: Event) => {
            const isRecentType = event.type === 'funeral' || event.type === 'baptism'
            const createdAt = new Date(event.createdAt)
            const isRecent = createdAt >= twoWeeksAgo
            return isRecentType && isRecent
          })

          setRecentEvents(recent)
        } else {
          console.error('[EmailSender] Failed to fetch events:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('[EmailSender] Failed to load recent events:', error)
      } finally {
        setLoadingEvents(false)
      }
    }
    loadRecentEvents()
  }, [])

  // Define all hooks before conditional returns
  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Email Sender</Heading>
          <Paragraph>To access this section of our site, please sign in.</Paragraph>
          <LogInUser />
        </Section>
      </Wrapper>
    )
  }

  // Check if user has admin or owner role
  const userRole = session.user.role
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Access Denied</Heading>
          <Paragraph>You need admin or owner permissions to access the Email Sender.</Paragraph>
          <Paragraph>Current role: {userRole || 'None'}</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  // Helper to get list name for display
  const getListDisplayName = (isTest: boolean): string => {
    if (isTest) return 'Test List (internal testing only)'
    return 'Full Subscriber List (100+ recipients)'
  }

  // Show confirmation dialog before sending
  const showSendConfirmation = (emailName: string, emailType: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      emailName,
      emailType,
      listName: getListDisplayName(test),
      isTest: test,
      onConfirm,
    })
  }

  // Close confirmation dialog
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  // Actually send the email (called after confirmation)
  const doSendEmail = async (reason: EmailReasonType) => {
    setSending(true)
    setReason(reason)
    try {
      const response = await sendEmail(reason, test, note)
      setEmail(response)
    } catch (error) {
      console.error('Error sending email:', error)
      setEmail({ error: 'Failed to send email', details: error })
    } finally {
      setSending(false)
      setReason(null)
    }
  }

  // Request to send email - shows confirmation first
  const getEmail = async (reason: EmailReasonType, emailLabel: string) => {
    showSendConfirmation(emailLabel, reason, () => {
      closeConfirmDialog()
      doSendEmail(reason)
    })
  }

  // Send event-specific email (funeral/baptism announcement)
  const sendEventEmail = async (event: Event) => {
    const emailName = event.type === 'funeral'
      ? `Funeral: ${event.deceased?.firstName || ''} ${event.deceased?.lastName || ''}`
      : `Baptism: ${event.candidate?.firstName || ''} ${event.candidate?.lastName || ''}`

    showSendConfirmation(emailName, `${event.type}-announcement`, () => {
      closeConfirmDialog()
      doSendEventEmail(event)
    })
  }

  // Actually send event email
  const doSendEventEmail = async (event: Event) => {
    setSending(true)
    setReason(`${event.type}-announcement`)
    try {
      const response = await sendEmail('event-announcement' as EmailReasonType, test, note, {
        eventId: event.id,
        eventType: event.type,
      })
      setEmail(response)
    } catch (error) {
      console.error('Error sending event email:', error)
      setEmail({ error: 'Failed to send event email', details: error })
    } finally {
      setSending(false)
      setReason(null)
    }
  }

  const handleCustomEmailSend = async (emailData: {
    subject: string
    htmlContent: string
    selectedList: EmailListTypeKeys
    note: string
    draftId?: string
  }) => {
    const isTestSend = emailData.selectedList === 'testList'
    const listLabel = availableLists.find(l => l.key === emailData.selectedList)?.label || emailData.selectedList

    showSendConfirmation(emailData.subject, 'Custom Email', () => {
      closeConfirmDialog()
      doSendCustomEmail(emailData, isTestSend, listLabel)
    })
  }

  const doSendCustomEmail = async (
    emailData: {
      subject: string
      htmlContent: string
      selectedList: EmailListTypeKeys
      note: string
      draftId?: string
    },
    isTestSend: boolean,
    _listLabel: string
  ) => {
    setSending(true)
    setReason('custom')
    try {
      const response = await sendEmail('custom', isTestSend, emailData.note, {
        htmlContent: emailData.htmlContent,
        subject: emailData.subject,
        selectedList: emailData.selectedList,
      })
      setEmail(response)
      // Switch to templates tab to show the response
      setActiveTab('templates')
    } catch (error) {
      console.error('Error sending custom email:', error)
      setEmail({ error: 'Failed to send custom email', details: error })
      setActiveTab('templates')
    } finally {
      setSending(false)
      setReason(null)
    }
  }

  const emailTypes = [
    {
      id: 'newsletter',
      label: 'Newsletter',
      description: 'Weekly newsletter with events and schedule',
      icon: Mail,
      color: '$blue10'
    },
    {
      id: 'recap',
      label: 'Memorial Info',
      description: 'Memorial service information and reminders',
      icon: Mail,
      color: '$green10'
    },
    {
      id: 'bible-class',
      label: 'Bible Class Info',
      description: 'Bible class schedule and topics',
      icon: Mail,
      color: '$purple10'
    },
    {
      id: 'sunday-school',
      label: 'Sunday School Info',
      description: 'Sunday school announcements',
      icon: Mail,
      color: '$orange10'
    },
    {
      id: 'business-meeting',
      label: 'Business Meeting',
      description: 'Business meeting details with Zoom link and documents',
      icon: Mail,
      color: '$blue10'
    }
  ]

  return (
    <Wrapper subHeader="Email Sender">
      <Section gap={'$4'}>
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          orientation="horizontal"
          flexDirection="column"
          width="100%"
        >
          <Tabs.List separator={<Separator vertical />} backgroundColor="$background">
            <Tabs.Tab flex={1} value="templates">
              <XStack gap="$2" alignItems="center">
                <Mail size={16} />
                <Text>Email Templates</Text>
              </XStack>
            </Tabs.Tab>
            <Tabs.Tab flex={1} value="custom">
              <XStack gap="$2" alignItems="center">
                <Edit3 size={16} />
                <Text>Create Custom Email</Text>
              </XStack>
            </Tabs.Tab>
          </Tabs.List>

          {/* Email Templates Tab */}
          <Tabs.Content value="templates" padding="$4">
            <YStack gap="$4">
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
                ⚠️ WARNING: Emails will be sent to ALL subscribers (100+ recipients)
              </Text>
            ) : null}
          </Card>

          {/* Recent Event Announcements - show after Test Mode */}
          {recentEvents.length > 0 ? (
            <Card elevate bordered padding="$4" backgroundColor="$purple2" borderColor="$purple6">
              <YStack gap="$3">
                <Heading size={4} color="$purple11">Recent Event Announcements</Heading>
                <Text fontSize="$3" color="$purple10">
                  These events were created in the last 2 weeks and may need announcement emails sent.
                </Text>
                <XStack gap="$3" flexWrap="wrap">
                  {recentEvents.map((event) => {
                    const personName = event.type === 'funeral'
                      ? `${event.deceased?.title || ''} ${event.deceased?.firstName || ''} ${event.deceased?.lastName || ''}`.trim()
                      : `${event.candidate?.firstName || ''} ${event.candidate?.lastName || ''}`.trim()

                    const eventLabel = event.type === 'funeral'
                      ? `Funeral: ${personName}`
                      : `Baptism: ${personName}`

                    const createdDate = new Date(event.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })

                    return (
                      <Card
                        key={event.id}
                        bordered
                        padding="$3"
                        backgroundColor="$background"
                        pressStyle={{ scale: 0.98 }}
                        hoverStyle={{ scale: 1.02, borderColor: '$purple8' }}
                        animation="quick"
                        cursor="pointer"
                        onPress={() => sendEventEmail(event)}
                        minWidth={200}
                      >
                        <YStack gap="$1">
                          <Text fontSize="$4" fontWeight="600" color="$color">
                            {eventLabel}
                          </Text>
                          <Text fontSize="$2" color="$gray10">
                            Created: {createdDate}
                          </Text>
                          <XStack gap="$1" alignItems="center" marginTop="$1">
                            <Send size={14} color="$purple10" />
                            <Text fontSize="$3" color="$purple10" fontWeight="500">
                              Send Announcement
                            </Text>
                          </XStack>
                        </YStack>
                      </Card>
                    )
                  })}
                </XStack>
              </YStack>
            </Card>
          ) : null}

          {loadingEvents ? (
            <Text fontSize="$3" color="$gray10">Loading recent events...</Text>
          ) : null}

          <Separator />

          {/* Regular Email Section */}
          <YStack gap="$3">
            <Heading size={4}>Resend Regular Email</Heading>

            {/* Optional Note */}
            <Card elevate bordered padding="$4" backgroundColor="$background">
              <YStack gap="$3">
                <Heading size={3}>Include a Brief Note (Optional)</Heading>
                <Text fontSize="$3" color="$gray11">
                  Add a note to include at the top of the email (e.g., corrections, important updates)
                </Text>
                <TextArea
                  placeholder="Enter your note here... (e.g., 'Links were broken in previous email, resending with correct URLs')"
                  value={note}
                  onChangeText={(text: string) => setNote(text.slice(0, MAX_NOTE_LENGTH))}
                  size="$4"
                  minHeight={100}
                  borderColor="$gray6"
                  borderWidth={1}
                  backgroundColor="$background"
                />
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$2" color={note.length >= MAX_NOTE_LENGTH ? '$red10' : '$gray11'}>
                    {note.length} / {MAX_NOTE_LENGTH} characters
                  </Text>
                  {note.length > 0 ? <Button size="$2" variant="outlined" onPress={() => setNote('')}>
                      Clear Note
                    </Button> : null}
                </XStack>
              </YStack>
            </Card>

            {sending ? (
              <Card
                elevate
                bordered
                padding="$6"
                backgroundColor="$background"
                animation="quick"
                animateOnly={['opacity']}
                opacity={0.8}
              >
                <YStack gap="$3" alignItems="center">
                  <Send size={32} color="$blue10" />
                  <Text fontSize="$5" textAlign="center">
                    Sending {reason}...
                  </Text>
                  <Text fontSize="$3" color="$gray11" textAlign="center">
                    Please wait, this may take a moment
                  </Text>
                </YStack>
              </Card>
            ) : (
              <XStack gap="$3" flexWrap="wrap">
                {emailTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <Card
                      key={type.id}
                      elevate
                      bordered
                      padding="$4"
                      pressStyle={{ scale: 0.98 }}
                      hoverStyle={{ scale: 1.02 }}
                      animation="quick"
                      width="calc(50% - $1.5)"
                      minWidth={250}
                      cursor="pointer"
                      onPress={() => getEmail(type.id as EmailReasonType, type.label)}
                    >
                      <YStack gap="$2">
                        <XStack gap="$2" alignItems="center">
                          <Icon size={24} color={type.color} />
                          <Text fontSize="$5" fontWeight="600">
                            {type.label}
                          </Text>
                        </XStack>
                        <Text fontSize="$3" color="$gray11">
                          {type.description}
                        </Text>
                      </YStack>
                    </Card>
                  )
                })}
              </XStack>
            )}
          </YStack>

          {/* Response Display */}
          {email ? (
            <Card elevate bordered padding="$4" backgroundColor="$background">
              <YStack gap="$3">
                <XStack justifyContent="space-between" alignItems="center">
                  <Heading size={4}>Email Send Response</Heading>
                  <Button size="$3" onPress={() => setEmail(null)}>
                    Clear Response
                  </Button>
                </XStack>

                <Card padding="$3" backgroundColor="$gray2">
                  {email.error ? (
                    <YStack gap="$2">
                      <Text color="$red10" fontWeight="600">Error: {email.error}</Text>
                      {email.details ? (
                        <Text fontSize="$3" color="$gray11">
                          {JSON.stringify(email.details, null, 2)}
                        </Text>
                      ) : null}
                    </YStack>
                  ) : (
                    <YStack gap="$2">
                      {email.sends ? (
                        <Text color="$green10">
                          ✅ Successfully sent to {email.sends.length} recipients
                        </Text>
                      ) : null}
                      {email.skips && email.skips.length > 0 ? (
                        <Text color="$orange10">
                          ⚠️ Skipped {email.skips.length} recipients
                        </Text>
                      ) : null}
                      <Separator marginVertical="$2" />
                      <Text fontSize="$2" fontFamily="$mono" color="$gray11">
                        {JSON.stringify(email, null, 2)}
                      </Text>
                    </YStack>
                  )}
                </Card>
              </YStack>
            </Card>
          ) : null}
            </YStack>
          </Tabs.Content>

          {/* Custom Email Tab */}
          <Tabs.Content value="custom" padding="$4">
            <CustomEmailCreator
              onSend={handleCustomEmailSend}
              availableLists={availableLists}
              sending={sending}
            />
          </Tabs.Content>
        </Tabs>
      </Section>

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen ? <Card
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
            <Heading size={4}>Confirm Email Send</Heading>

            {/* Content */}
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
                      This will send to ALL subscribers!
                    </Text>
                  ) : null}
                </YStack>
              </Card>

              <YStack gap="$2" padding="$3" backgroundColor="$gray2" borderRadius="$3">
                <XStack gap="$2">
                  <Text fontWeight="600" minWidth={80}>Email:</Text>
                  <Text flex={1}>{confirmDialog.emailName}</Text>
                </XStack>
                <XStack gap="$2">
                  <Text fontWeight="600" minWidth={80}>Type:</Text>
                  <Text flex={1}>{confirmDialog.emailType}</Text>
                </XStack>
                <XStack gap="$2">
                  <Text fontWeight="600" minWidth={80}>Send to:</Text>
                  <Text flex={1} color={confirmDialog.isTest ? '$gray11' : '$red10'}>
                    {confirmDialog.listName}
                  </Text>
                </XStack>
              </YStack>
            </YStack>

            {/* Actions */}
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
        </Card> : null}
    </Wrapper>
  )
}