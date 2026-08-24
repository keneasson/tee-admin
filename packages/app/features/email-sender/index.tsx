'use client'

import React, { useState, useEffect } from 'react'
import {
  Adapt,
  Button,
  Checkbox,
  Heading,
  Paragraph,
  Select,
  Sheet,
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
import { Check, Send, Mail, AlertCircle, Newspaper, Calendar, Users } from '@tamagui/lucide-icons'
import { sendEmail, sendNewsAlert, getContactsList, savePendingNote, getPendingNote, clearPendingNote, getRecentEvents, getActiveNews } from '../../provider/get-data'
import { CustomEmailCreator } from '../custom-email-creator'
import { DirectRecipientSend } from './direct-recipient-send'
import { EmailListTypeKeys, EmailReasonType, AuthSession, AuthStatus } from '@my/app/types'
import {
  Event,
  isEventActive,
  getBaptismCandidates,
  formatCandidateNames,
} from '@my/app/types/events'
import { NewsItem, isNewsActive } from '@my/app/types/news'

const DISPLAY_TIMEZONE = 'America/Toronto'

const REASON_LABEL: Record<string, string> = {
  newsletter: 'Newsletter',
  recap: 'Memorial recap',
  'bible-class': 'Bible Class',
  'sunday-school': 'Sunday School',
}

// Email reasons that support an attached pending note. Must stay in sync with
// ALLOWED_REASONS in apps/next/app/api/email/pending-note/route.ts.
const NOTE_REASONS: EmailReasonType[] = ['newsletter', 'recap', 'bible-class', 'sunday-school']

function formatSavedTimestamp(iso: string): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: DISPLAY_TIMEZONE,
  })
}

// Build the display label for an event announcement card / confirmation dialog.
// Supports funeral, baptism, wedding, engagement and general event shapes.
function getEventAnnouncementLabel(event: Event): string {
  if (event.type === 'funeral') {
    const name = `${event.deceased?.title || ''} ${event.deceased?.firstName || ''} ${event.deceased?.lastName || ''}`.trim()
    return `Funeral: ${name}`
  }
  if (event.type === 'wedding') {
    const bride = `${event.couple?.bride?.firstName || ''} ${event.couple?.bride?.lastName || ''}`.trim()
    const groom = `${event.couple?.groom?.firstName || ''} ${event.couple?.groom?.lastName || ''}`.trim()
    const names = [bride, groom].filter(Boolean).join(' & ')
    return `Wedding: ${names || event.title}`
  }
  if (event.type === 'engagement') {
    const names = [event.engagementProposed, event.engagementTo].filter(Boolean).join(' & ')
    return `Engagement: ${names || event.title}`
  }
  if (event.type === 'general') {
    // General events have no person/occasion — the title is the announcement.
    return `Event: ${event.title}`
  }
  const name = formatCandidateNames(getBaptismCandidates(event))
  return `Baptism: ${name}`
}

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
  // Note attaches to a specific email TYPE. Selecting a type fetches any
  // previously-saved note so the admin can see, edit, or delete it — closing
  // the gap where a saved note was invisible after a page refresh.
  const [noteReason, setNoteReason] = useState<EmailReasonType | null>(null)
  const [note, setNote] = useState<string>('')
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [savedMeta, setSavedMeta] = useState<{ createdAt: string | null; createdBy: string | null }>({
    createdAt: null,
    createdBy: null,
  })
  const [loadingNote, setLoadingNote] = useState<boolean>(false)
  const [savingPending, setSavingPending] = useState<boolean>(false)
  const [deletingNote, setDeletingNote] = useState<boolean>(false)
  const [pendingSaveStatus, setPendingSaveStatus] = useState<
    | { kind: 'success'; label: string }
    | { kind: 'error'; label: string; message: string }
    | null
  >(null)
  const [availableLists, setAvailableLists] = useState<{ key: EmailListTypeKeys; label: string }[]>([])
  const [activeTab, setActiveTab] = useState<string>('templates')
  const [recentEvents, setRecentEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [loadingNews, setLoadingNews] = useState<boolean>(true)
  // Audience override for the shared News + Events composer. Defaults to the
  // newsletter list; any SES topic (incl. inter-ecclesia leaders) is selectable.
  // Test mode still forces the test list server-side regardless of this value.
  const [composerAudience, setComposerAudience] = useState<EmailListTypeKeys>('newsletter')
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

  // When an email type is selected for note-editing, fetch any previously-saved
  // note for it so the admin can see/edit/delete it. This is the fix for the
  // root-cause bug where a saved note was invisible after a page refresh.
  useEffect(() => {
    if (!noteReason) {
      setSavedNote(null)
      setSavedMeta({ createdAt: null, createdBy: null })
      setNote('')
      return
    }
    let cancelled = false
    const loadNote = async () => {
      setLoadingNote(true)
      setPendingSaveStatus(null)
      try {
        const result = await getPendingNote(noteReason)
        if (cancelled) return
        if (result.ok) {
          setSavedNote(result.note)
          setSavedMeta({ createdAt: result.createdAt, createdBy: result.createdBy })
          setNote(result.note ?? '')
        } else {
          setSavedNote(null)
          setSavedMeta({ createdAt: null, createdBy: null })
          setNote('')
          setPendingSaveStatus({
            kind: 'error',
            label: REASON_LABEL[noteReason] ?? noteReason,
            message: result.error || 'Failed to load saved note',
          })
        }
      } finally {
        if (!cancelled) setLoadingNote(false)
      }
    }
    loadNote()
    return () => {
      cancelled = true
    }
  }, [noteReason])

  // Load recent funeral/baptism/wedding/engagement/general events (created within 2 weeks)
  useEffect(() => {
    const loadRecentEvents = async () => {
      try {
        setLoadingEvents(true)
        const events = await getRecentEvents()
        const twoWeeksAgo = new Date()
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

        // Filter for funerals, baptisms, weddings and engagements created within 2 weeks
        const recent = events.filter((event: Event) => {
          const isRecentType =
            event.type === 'funeral' ||
            event.type === 'baptism' ||
            event.type === 'wedding' ||
            event.type === 'engagement' ||
            event.type === 'general'
          const createdAt = new Date(event.createdAt)
          const isRecent = createdAt >= twoWeeksAgo
          // Never surface DRAFT events for sending — /api/admin/events returns
          // all events incl. drafts; isEventActive gates on publishDate/active/status.
          const isActive = isEventActive(event)
          return isRecentType && isRecent && isActive
        })

        setRecentEvents(recent)
      } catch (error) {
        console.error('[EmailSender] Failed to load recent events:', error)
      } finally {
        setLoadingEvents(false)
      }
    }
    loadRecentEvents()
  }, [])

  // Load active News items so they can be sent from the same composer as events.
  useEffect(() => {
    const loadNews = async () => {
      try {
        setLoadingNews(true)
        const items = await getActiveNews()
        // Only active (unexpired) items can be blasted — the send-alert route
        // rejects expired ones, so hide them from the picker.
        setNewsItems(items.filter((item) => isNewsActive(item)))
      } catch (error) {
        console.error('[EmailSender] Failed to load news:', error)
      } finally {
        setLoadingNews(false)
      }
    }
    loadNews()
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

  // Show confirmation dialog before sending. `liveListName` lets a caller show
  // the actual audience it will send to on a live send (the shared composer
  // overrides the default full-subscriber list); test sends always show the
  // test list.
  const showSendConfirmation = (
    emailName: string,
    emailType: string,
    onConfirm: () => void,
    liveListName?: string
  ) => {
    setConfirmDialog({
      isOpen: true,
      emailName,
      emailType,
      listName: test ? getListDisplayName(true) : (liveListName ?? getListDisplayName(false)),
      isTest: test,
      onConfirm,
    })
  }

  // Close confirmation dialog
  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  // Actually send the email (called after confirmation).
  // NOTE: we deliberately do NOT pass the editor's textarea here. The note is a
  // saved, per-email-type resource — the send handler fetches the correct note
  // for `reason` itself. Passing the editor note would let a note authored for
  // one email attach to a different one (the 2026-05-30 cross-wire incident).
  const doSendEmail = async (reason: EmailReasonType) => {
    setSending(true)
    setReason(reason)
    try {
      const response = await sendEmail(reason, test)
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

  // Human label for the currently-selected composer audience.
  const composerAudienceLabel =
    availableLists.find((l) => l.key === composerAudience)?.label ?? composerAudience

  // Send event-specific email (funeral/baptism/wedding/engagement announcement)
  // to the audience chosen in the shared composer (defaults to the newsletter list).
  const sendEventEmail = async (event: Event) => {
    const emailName = getEventAnnouncementLabel(event)

    showSendConfirmation(
      emailName,
      `${event.type}-announcement`,
      () => {
        closeConfirmDialog()
        doSendEventEmail(event)
      },
      `${composerAudienceLabel} list`
    )
  }

  // Actually send event email.
  // Like doSendEmail, we don't pass the pending-note editor's textarea — that
  // note belongs to a specific regular email type, not this event announcement.
  const doSendEventEmail = async (event: Event) => {
    setSending(true)
    setReason(`${event.type}-announcement`)
    try {
      const response = await sendEmail('event-announcement' as EmailReasonType, test, undefined, {
        eventId: event.id,
        eventType: event.type,
        selectedList: composerAudience,
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

  // Send a News item to the audience chosen in the shared composer.
  const sendNewsItem = async (item: NewsItem) => {
    showSendConfirmation(
      item.title,
      'news-alert',
      () => {
        closeConfirmDialog()
        doSendNewsItem(item)
      },
      `${composerAudienceLabel} list`
    )
  }

  const doSendNewsItem = async (item: NewsItem) => {
    setSending(true)
    setReason('news-alert')
    try {
      const response = await sendNewsAlert(item.id, test, composerAudience)
      setEmail(response)
    } catch (error) {
      console.error('Error sending news alert:', error)
      setEmail({ error: 'Failed to send news alert', details: error })
    } finally {
      setSending(false)
      setReason(null)
    }
  }

  const noteReasonLabel = noteReason ? REASON_LABEL[noteReason] ?? noteReason : ''
  // "Unsaved" = the textarea differs from what's persisted in the DB.
  const hasUnsavedChanges = noteReason != null && note.trim() !== (savedNote ?? '').trim()
  const hasSavedNote = noteReason != null && (savedNote ?? '').trim().length > 0

  // Persist the textarea note for the selected email type. The cron/manual send
  // for that type picks it up automatically on its next live send.
  const handleSavePendingNote = async () => {
    if (!noteReason || !note.trim()) return
    setPendingSaveStatus(null)
    setSavingPending(true)
    try {
      const result = await savePendingNote(noteReason, note)
      if (result.ok) {
        setSavedNote(note)
        // Reflect the just-saved state locally; exact server timestamp loads on
        // next fetch but "now" is accurate enough for immediate feedback.
        setSavedMeta({ createdAt: new Date().toISOString(), createdBy: session.user?.email ?? null })
        setPendingSaveStatus({ kind: 'success', label: noteReasonLabel })
      } else {
        setPendingSaveStatus({
          kind: 'error',
          label: noteReasonLabel,
          message: result.error || 'Failed to save note',
        })
      }
    } catch (error) {
      setPendingSaveStatus({
        kind: 'error',
        label: noteReasonLabel,
        message: error instanceof Error ? error.message : 'Failed to save note',
      })
    } finally {
      setSavingPending(false)
    }
  }

  // Delete the saved note for the selected email type so it will NOT attach to
  // the next send. This is the admin's self-service path for clearing a stale
  // or no-longer-relevant note.
  const handleDeletePendingNote = async () => {
    if (!noteReason) return
    setPendingSaveStatus(null)
    setDeletingNote(true)
    try {
      const result = await clearPendingNote(noteReason)
      if (result.ok) {
        setSavedNote(null)
        setSavedMeta({ createdAt: null, createdBy: null })
        setNote('')
        setPendingSaveStatus({ kind: 'success', label: `Deleted — no note will attach to ${noteReasonLabel}` })
      } else {
        setPendingSaveStatus({
          kind: 'error',
          label: noteReasonLabel,
          message: result.error || 'Failed to delete note',
        })
      }
    } catch (error) {
      setPendingSaveStatus({
        kind: 'error',
        label: noteReasonLabel,
        message: error instanceof Error ? error.message : 'Failed to delete note',
      })
    } finally {
      setDeletingNote(false)
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
            <Tabs.Tab flex={2} value="templates">
              <XStack gap="$2" alignItems="center">
                <Mail size={16} />
                <Text>News, Events &amp; Templates</Text>
              </XStack>
            </Tabs.Tab>
            <Tabs.Tab flex={1} value="custom">
              <XStack gap="$2" alignItems="center">
                <AlertCircle size={16} color="$gray10" />
                <Text color="$gray10">Emergency Email</Text>
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

          {/* Direct-recipient send (Issue #127) — one-off, permission-gated 1:1
              send to someone who explicitly requested an email. Sits under TEST
              MODE and ignores it by design. */}
          <DirectRecipientSend session={session} />

          {/* Shared News + Events composer (Issue #57). One place to pick a
              News item OR an Event and send it to a chosen audience. */}
          <Card elevate bordered padding="$4" backgroundColor="$purple2" borderColor="$purple6">
            <YStack gap="$3">
              <Heading size={4} color="$purple11">Send News or Event</Heading>
              <Text fontSize="$3" color="$purple10">
                Pick a News item or an Event below, choose the audience, and send it.
                Custom/freeform email is for emergencies only — use the tab above.
              </Text>

              {/* Audience override — any SES list, incl. inter-ecclesia leaders. */}
              <YStack gap="$2">
                <XStack gap="$2" alignItems="center">
                  <Users size={16} color="$purple10" />
                  <Text fontSize="$3" fontWeight="600">Audience (live sends)</Text>
                </XStack>
                <Select
                  value={composerAudience}
                  onValueChange={(value) => setComposerAudience(value as EmailListTypeKeys)}
                >
                  <Select.Trigger minWidth={280} iconAfter={null} backgroundColor="$background">
                    <Select.Value placeholder="Select an audience…" />
                  </Select.Trigger>

                  <Adapt when="sm" platform="touch">
                    <Sheet native modal dismissOnSnapToBottom>
                      <Sheet.Frame>
                        <Sheet.ScrollView>
                          <Adapt.Contents />
                        </Sheet.ScrollView>
                      </Sheet.Frame>
                      <Sheet.Overlay
                        animation="lazy"
                        enterStyle={{ opacity: 0 }}
                        exitStyle={{ opacity: 0 }}
                      />
                    </Sheet>
                  </Adapt>

                  <Select.Content zIndex={200000 as any}>
                    <Select.ScrollUpButton />
                    <Select.Viewport>
                      <Select.Group>
                        {availableLists
                          .filter((list) => list.key !== 'testList')
                          .map((list, idx) => (
                            <Select.Item key={list.key} index={idx} value={list.key}>
                              <Select.ItemText>{list.label}</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check size={16} />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                      </Select.Group>
                    </Select.Viewport>
                    <Select.ScrollDownButton />
                  </Select.Content>
                </Select>
                <Text fontSize="$2" color="$purple10">
                  {test
                    ? 'Test mode is on — sends go to the test list regardless of this audience.'
                    : `Live sends go to: ${composerAudienceLabel}`}
                </Text>
              </YStack>

              <Separator />

              {/* News items */}
              <YStack gap="$2">
                <XStack gap="$2" alignItems="center">
                  <Newspaper size={16} color="$purple10" />
                  <Text fontSize="$4" fontWeight="600" color="$purple11">News</Text>
                </XStack>
                {loadingNews ? (
                  <Text fontSize="$3" color="$gray10">Loading news…</Text>
                ) : newsItems.length > 0 ? (
                  <XStack gap="$3" flexWrap="wrap">
                    {newsItems.map((item) => {
                      const publishedDate = new Date(item.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                      return (
                        <Card
                          key={item.id}
                          bordered
                          padding="$3"
                          backgroundColor="$background"
                          pressStyle={{ scale: 0.98 }}
                          hoverStyle={{ scale: 1.02, borderColor: '$purple8' }}
                          animation="quick"
                          cursor="pointer"
                          onPress={() => sendNewsItem(item)}
                          minWidth={200}
                        >
                          <YStack gap="$1">
                            <Text fontSize="$4" fontWeight="600" color="$color">
                              {item.title}
                            </Text>
                            <Text fontSize="$2" color="$gray10">
                              Published: {publishedDate}
                            </Text>
                            <XStack gap="$1" alignItems="center" marginTop="$1">
                              <Send size={14} color="$purple10" />
                              <Text fontSize="$3" color="$purple10" fontWeight="500">
                                Send News
                              </Text>
                            </XStack>
                          </YStack>
                        </Card>
                      )
                    })}
                  </XStack>
                ) : (
                  <Text fontSize="$3" color="$gray10">No active news items.</Text>
                )}
              </YStack>

              <Separator />

              {/* Event announcements */}
              <YStack gap="$2">
                <XStack gap="$2" alignItems="center">
                  <Calendar size={16} color="$purple10" />
                  <Text fontSize="$4" fontWeight="600" color="$purple11">Events</Text>
                </XStack>
                {loadingEvents ? (
                  <Text fontSize="$3" color="$gray10">Loading recent events…</Text>
                ) : recentEvents.length > 0 ? (
                  <XStack gap="$3" flexWrap="wrap">
                    {recentEvents.map((event) => {
                      const eventLabel = getEventAnnouncementLabel(event)

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
                ) : (
                  <Text fontSize="$3" color="$gray10">
                    No recent funeral, baptism, wedding, engagement or general events to announce.
                  </Text>
                )}
              </YStack>
            </YStack>
          </Card>

          <Separator />

          {/* Regular Email Section */}
          <YStack gap="$3">
            <Heading size={4}>Resend Regular Email</Heading>

            {/* Pending Note Manager — attach-to-FIRST. Selecting an email type
                fetches any saved note so it can be reviewed, edited, or deleted. */}
            <Card elevate bordered padding="$4" backgroundColor="$background">
              <YStack gap="$3">
                <Heading size={3}>Pending Note for Next Send (Optional)</Heading>
                <Text fontSize="$3" color="$gray11">
                  Choose which email this note belongs to. A saved note is automatically
                  included at the top of that email on its next live send (manual or scheduled),
                  then cleared.
                </Text>

                {/* Step 1: which email does this note attach to? */}
                <YStack gap="$2">
                  <Text fontSize="$3" fontWeight="600">
                    This note attaches to:
                  </Text>
                  <Select
                    value={noteReason ?? ''}
                    onValueChange={(value) => {
                      setNoteReason(value as EmailReasonType)
                      setPendingSaveStatus(null)
                    }}
                  >
                    <Select.Trigger minWidth={280} iconAfter={null}>
                      <Select.Value placeholder="Select an email…" />
                    </Select.Trigger>

                    <Adapt when="sm" platform="touch">
                      <Sheet native modal dismissOnSnapToBottom>
                        <Sheet.Frame>
                          <Sheet.ScrollView>
                            <Adapt.Contents />
                          </Sheet.ScrollView>
                        </Sheet.Frame>
                        <Sheet.Overlay
                          animation="lazy"
                          enterStyle={{ opacity: 0 }}
                          exitStyle={{ opacity: 0 }}
                        />
                      </Sheet>
                    </Adapt>

                    <Select.Content zIndex={200000 as any}>
                      <Select.ScrollUpButton />
                      <Select.Viewport>
                        <Select.Group>
                          {NOTE_REASONS.map((r, idx) => (
                            <Select.Item key={r} index={idx} value={r}>
                              <Select.ItemText>{REASON_LABEL[r] ?? r}</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check size={16} />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Group>
                      </Select.Viewport>
                      <Select.ScrollDownButton />
                    </Select.Content>
                  </Select>
                </YStack>

                {/* Step 2: the note editor — only once a type is chosen */}
                {noteReason ? (
                  <YStack gap="$3">
                    <Separator />

                    {loadingNote ? (
                      <Text fontSize="$3" color="$gray10">Loading saved note…</Text>
                    ) : (
                      <>
                        {/* Saved-state banner */}
                        {hasSavedNote ? (
                          <Card padding="$3" backgroundColor="$blue2" borderColor="$blue6" bordered>
                            <Text fontSize="$2" color="$blue11">
                              📌 A note is currently saved for {noteReasonLabel}
                              {savedMeta.createdAt ? ` — saved ${formatSavedTimestamp(savedMeta.createdAt)}` : ''}
                              {savedMeta.createdBy ? ` by ${savedMeta.createdBy}` : ''}.
                              {' '}It will attach to the next {noteReasonLabel} send unless you delete it.
                            </Text>
                          </Card>
                        ) : (
                          <Text fontSize="$2" color="$gray10">
                            No note is currently saved for {noteReasonLabel}.
                          </Text>
                        )}

                        <TextArea
                          placeholder="Enter your note here... (e.g., 'Links were broken in previous email, resending with correct URLs')"
                          value={note}
                          onChangeText={(text: string) => {
                            setNote(text.slice(0, MAX_NOTE_LENGTH))
                            setPendingSaveStatus(null)
                          }}
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
                          {hasUnsavedChanges ? (
                            <Text fontSize="$2" color="$orange10" fontWeight="600">
                              ● Unsaved changes
                            </Text>
                          ) : hasSavedNote ? (
                            <Text fontSize="$2" color="$green10" fontWeight="600">
                              ✓ Saved
                            </Text>
                          ) : null}
                        </XStack>

                        <XStack gap="$2" alignItems="center" flexWrap="wrap">
                          <Button
                            size="$3"
                            theme="active"
                            disabled={!note.trim() || !hasUnsavedChanges || savingPending}
                            opacity={!note.trim() || !hasUnsavedChanges ? 0.5 : 1}
                            onPress={handleSavePendingNote}
                          >
                            {savingPending ? 'Saving…' : 'Save'}
                          </Button>
                          {hasSavedNote ? (
                            <Button
                              size="$3"
                              variant="outlined"
                              borderColor="$red8"
                              color="$red10"
                              hoverStyle={{ backgroundColor: '$red3', borderColor: '$red8' }}
                              disabled={deletingNote}
                              onPress={handleDeletePendingNote}
                            >
                              {deletingNote ? 'Deleting…' : 'Delete saved note'}
                            </Button>
                          ) : null}
                        </XStack>

                        {pendingSaveStatus?.kind === 'success' ? (
                          <Text fontSize="$2" color="$green10">
                            ✅ {pendingSaveStatus.label}
                          </Text>
                        ) : null}
                        {pendingSaveStatus?.kind === 'error' ? (
                          <Text fontSize="$2" color="$red10">
                            {pendingSaveStatus.label}: {pendingSaveStatus.message}
                          </Text>
                        ) : null}
                      </>
                    )}
                  </YStack>
                ) : null}
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
                      ) : typeof email.sentCount === 'number' ? (
                        <Text color="$green10">
                          ✅ Successfully sent to {email.sentCount} recipients
                        </Text>
                      ) : null}
                      {email.skips && email.skips.length > 0 ? (
                        <Text color="$orange10">
                          ⚠️ Skipped {email.skips.length} recipients
                        </Text>
                      ) : typeof email.skippedCount === 'number' && email.skippedCount > 0 ? (
                        <Text color="$orange10">
                          ⚠️ Skipped {email.skippedCount} recipients
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

          {/* Emergency / freeform email — demoted (Issue #57). Regular News and
              Events are composed in the "News, Events & Templates" tab; this is
              a last resort for one-off, freeform messages. */}
          <Tabs.Content value="custom" padding="$4">
            <YStack gap="$4">
              <Card bordered padding="$3" backgroundColor="$orange2" borderColor="$orange6">
                <XStack gap="$2" alignItems="center">
                  <AlertCircle size={18} color="$orange10" />
                  <Text fontSize="$3" color="$orange11" flex={1}>
                    Emergency use only. Compose News and Events from the
                    &quot;News, Events &amp; Templates&quot; tab — use this
                    freeform tool only for one-off messages with no template.
                  </Text>
                </XStack>
              </Card>
              <CustomEmailCreator
                onSend={handleCustomEmailSend}
                availableLists={availableLists}
                sending={sending}
              />
            </YStack>
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