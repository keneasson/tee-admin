'use client'

import React, { useState, useEffect } from 'react'
import {
  Button,
  Heading,
  Input,
  Paragraph,
  Select,
  Text,
  TextArea,
  XStack,
  YStack,
  Card,
  Separator,
  Adapt,
  Sheet,
  ScrollView,
  Spinner,
} from '@my/ui'
import { Check, Send, AlertCircle, Eye, Save, Trash2, Mail, TestTube2 } from '@tamagui/lucide-icons'
import { EmailListTypeKeys } from '@my/app/types'
import { EmailDraft } from '@my/app/types/email-draft'
import {
  getDrafts,
  createDraft,
  updateDraft,
  deleteDraft,
  markDraftAsTested,
  markDraftAsSent,
} from '@my/app/provider/email-drafts'

interface CustomEmailCreatorProps {
  onSend: (emailData: {
    subject: string
    htmlContent: string
    selectedList: EmailListTypeKeys
    note: string
    draftId?: string
  }) => Promise<void>
  availableLists: { key: EmailListTypeKeys; label: string }[]
  sending: boolean
  testSending?: boolean
}

export const CustomEmailCreator: React.FC<CustomEmailCreatorProps> = ({
  onSend,
  availableLists,
  sending,
}) => {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [selectedList, setSelectedList] = useState<EmailListTypeKeys>('newsletter')
  const [note, setNote] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  // Draft management state
  const [drafts, setDrafts] = useState<EmailDraft[]>([])
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [loadingDrafts, setLoadingDrafts] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  // Separate loading states for test vs production
  const [sendingTest, setSendingTest] = useState(false)
  const [sendingProduction, setSendingProduction] = useState(false)

  const MAX_NOTE_LENGTH = 500

  // Load drafts on mount
  useEffect(() => {
    loadDrafts()
  }, [])

  const loadDrafts = async () => {
    setLoadingDrafts(true)
    try {
      const loadedDrafts = await getDrafts()
      setDrafts(loadedDrafts)
    } catch (error) {
      console.error('Failed to load drafts:', error)
    } finally {
      setLoadingDrafts(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!subject.trim() || !content.trim()) {
      alert('Please fill in both subject and content before saving')
      return
    }

    setSavingDraft(true)
    try {
      const draftData = {
        subject,
        htmlContent: convertToHtml(content),
        selectedList,
        note,
      }

      let savedDraft: EmailDraft
      if (currentDraftId) {
        // Update existing draft
        savedDraft = await updateDraft({
          id: currentDraftId,
          ...draftData,
        })
      } else {
        // Create new draft
        savedDraft = await createDraft(draftData)
        setCurrentDraftId(savedDraft.id)
      }

      setLastSaved(new Date().toLocaleTimeString())
      await loadDrafts()
    } catch (error) {
      console.error('Failed to save draft:', error)
      alert('Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  const handleLoadDraft = (draft: EmailDraft) => {
    setCurrentDraftId(draft.id)
    setSubject(draft.subject)
    setContent(convertFromHtml(draft.htmlContent))
    setSelectedList(draft.selectedList)
    setNote(draft.note || '')
    setShowPreview(false)
  }

  const handleNewDraft = () => {
    setCurrentDraftId(null)
    setSubject('')
    setContent('')
    setSelectedList('newsletter')
    setNote('')
    setShowPreview(false)
    setLastSaved(null)
  }

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) {
      return
    }

    try {
      await deleteDraft(draftId)
      if (currentDraftId === draftId) {
        handleNewDraft()
      }
      await loadDrafts()
    } catch (error) {
      console.error('Failed to delete draft:', error)
      alert('Failed to delete draft')
    }
  }

  const handleSendTest = async () => {
    if (!subject.trim() || !content.trim()) {
      alert('Please fill in both subject and content')
      return
    }

    setSendingTest(true)
    try {
      // Save draft first if not already saved
      if (!currentDraftId) {
        await handleSaveDraft()
      }

      const htmlContent = convertToHtml(content)

      // Send to test list (test mode = true)
      await onSend({
        subject,
        htmlContent,
        selectedList: 'testList', // Always use testList for testing
        note,
        draftId: currentDraftId || undefined,
      })

      // Mark draft as tested
      if (currentDraftId) {
        try {
          await markDraftAsTested(currentDraftId)
          await loadDrafts()
        } catch (error) {
          console.error('Failed to mark draft as tested:', error)
        }
      }
    } finally {
      setSendingTest(false)
    }
  }

  const handleSendProduction = async () => {
    if (!subject.trim() || !content.trim()) {
      alert('Please fill in both subject and content')
      return
    }

    const currentDraft = drafts.find((d) => d.id === currentDraftId)
    if (currentDraft?.status !== 'tested') {
      const confirmSend = confirm(
        'This email has not been tested yet. Are you sure you want to send it to the production list?'
      )
      if (!confirmSend) {
        return
      }
    }

    setSendingProduction(true)
    try {
      const htmlContent = convertToHtml(content)

      await onSend({
        subject,
        htmlContent,
        selectedList,
        note,
        draftId: currentDraftId || undefined,
      })

      // Mark draft as sent
      if (currentDraftId) {
        try {
          await markDraftAsSent(currentDraftId)
          await loadDrafts()
        } catch (error) {
          console.error('Failed to mark draft as sent:', error)
        }
      }
    } finally {
      setSendingProduction(false)
    }
  }

  const currentDraft = drafts.find((d) => d.id === currentDraftId)

  return (
    <YStack gap="$4">
      {/* Draft Management Section */}
      <Card elevate bordered padding="$4" backgroundColor="$background">
        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <Heading size={4}>Email Drafts</Heading>
            <XStack gap="$2">
              <Button size="$3" variant="outlined" icon={Save} onPress={handleNewDraft}>
                New Draft
              </Button>
              <Button
                size="$3"
                icon={loadingDrafts ? undefined : Save}
                onPress={loadDrafts}
                disabled={loadingDrafts}
              >
                {loadingDrafts ? <Spinner size="small" /> : 'Refresh'}
              </Button>
            </XStack>
          </XStack>

          {drafts.length > 0 ? (
            <ScrollView maxHeight={200} borderWidth={1} borderColor="$gray6" borderRadius="$2">
              <YStack>
                {drafts.map((draft, index) => (
                  <XStack
                    key={draft.id}
                    padding="$3"
                    backgroundColor={
                      currentDraftId === draft.id ? '$blue2' : index % 2 === 0 ? '$background' : '$gray1'
                    }
                    borderBottomWidth={index < drafts.length - 1 ? 1 : 0}
                    borderBottomColor="$gray4"
                    hoverStyle={{ backgroundColor: '$gray2' }}
                    cursor="pointer"
                    onPress={() => handleLoadDraft(draft)}
                    alignItems="center"
                    gap="$2"
                  >
                    <YStack flex={1} gap="$1">
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize="$4" fontWeight="600" numberOfLines={1}>
                          {draft.subject}
                        </Text>
                        {draft.status === 'tested' && (
                          <Text
                            fontSize="$2"
                            fontWeight="600"
                            color="$orange10"
                            backgroundColor="$orange3"
                            paddingHorizontal="$2"
                            paddingVertical="$1"
                            borderRadius="$2"
                          >
                            TESTED
                          </Text>
                        )}
                        {draft.status === 'sent' && (
                          <Text
                            fontSize="$2"
                            fontWeight="600"
                            color="$green10"
                            backgroundColor="$green3"
                            paddingHorizontal="$2"
                            paddingVertical="$1"
                            borderRadius="$2"
                          >
                            SENT
                          </Text>
                        )}
                      </XStack>
                      <Text fontSize="$2" color="$gray11">
                        To: {availableLists.find((l) => l.key === draft.selectedList)?.label} •
                        Updated: {new Date(draft.updatedAt).toLocaleString()}
                      </Text>
                    </YStack>
                    <Button
                      size="$2"
                      variant="outlined"
                      icon={Trash2}
                      onPress={(e) => {
                        e.stopPropagation()
                        handleDeleteDraft(draft.id)
                      }}
                      circular
                    />
                  </XStack>
                ))}
              </YStack>
            </ScrollView>
          ) : (
            <Card padding="$4" backgroundColor="$gray2">
              <Text fontSize="$3" color="$gray11" textAlign="center">
                No saved drafts. Create and save your first email draft!
              </Text>
            </Card>
          )}
        </YStack>
      </Card>

      {/* Current Draft Info */}
      {currentDraft && (
        <Card elevate bordered padding="$3" backgroundColor="$blue2">
          <XStack gap="$2" alignItems="center">
            <Mail size={16} color="$blue10" />
            <Text fontSize="$3" flex={1}>
              Editing: <strong>{currentDraft.subject}</strong>
            </Text>
            {lastSaved && (
              <Text fontSize="$2" color="$gray11">
                Last saved: {lastSaved}
              </Text>
            )}
          </XStack>
        </Card>
      )}

      {/* Email Subject */}
      <Card elevate bordered padding="$4" backgroundColor="$background">
        <YStack gap="$3">
          <Heading size={3}>Email Subject</Heading>
          <Input
            placeholder="Enter email subject..."
            value={subject}
            onChangeText={setSubject}
            size="$4"
          />
          <Text fontSize="$2" color="$gray11">
            The date will be automatically appended to the subject
          </Text>
        </YStack>
      </Card>

      {/* Recipient List Selection */}
      <Card elevate bordered padding="$4" backgroundColor="$background">
        <YStack gap="$3">
          <Heading size={3}>Select Recipient List</Heading>
          <Select value={selectedList} onValueChange={(value) => setSelectedList(value as EmailListTypeKeys)}>
            <Select.Trigger width="100%" iconAfter={null}>
              <Select.Value placeholder="Select a list..." />
            </Select.Trigger>

            <Adapt when="sm" platform="touch">
              <Sheet
                native
                modal
                dismissOnSnapToBottom
                animationConfig={{
                  type: 'spring',
                  damping: 20,
                  mass: 1.2,
                  stiffness: 250,
                }}
              >
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
                    .filter((list) => list.key !== 'testList') // Hide test list from selection
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
          <Text fontSize="$2" color="$gray11">
            This is the production list. You can test first before sending to this list.
          </Text>
        </YStack>
      </Card>

      {/* Email Content Editor */}
      <Card elevate bordered padding="$4" backgroundColor="$background">
        <YStack gap="$3">
          <Heading size={3}>Email Content</Heading>
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
            <Text fontSize="$2" color="$gray11">
              Formatting:
            </Text>
            <Text fontSize="$2" color="$gray10">
              **bold text**
            </Text>
            <Text fontSize="$2" color="$gray11">
              •
            </Text>
            <Text fontSize="$2" color="$gray10">
              - List item
            </Text>
            <Text fontSize="$2" color="$gray11">
              •
            </Text>
            <Text fontSize="$2" color="$gray10">
              [Link](url)
            </Text>
            <Text fontSize="$2" color="$gray11">
              •
            </Text>
            <Text fontSize="$2" color="$gray10">
              Empty line = paragraph
            </Text>
          </XStack>

          <TextArea
            placeholder="Enter your email content here...

Example:
**Important Update**

We are pleased to announce:
- New service time
- Special guest speaker
- Fellowship lunch

For more details, visit [our website](https://example.com).

Looking forward to seeing you!
"
            value={content}
            onChangeText={setContent}
            size="$4"
            minHeight={300}
            borderColor="$gray6"
            borderWidth={1}
            backgroundColor="$background"
          />

          <XStack gap="$2">
            <Button
              size="$3"
              variant="outlined"
              icon={Eye}
              onPress={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </XStack>

          {showPreview && (
            <Card padding="$4" backgroundColor="$gray2" borderWidth={1} borderColor="$gray6">
              <Heading size={2} marginBottom="$2">
                Preview
              </Heading>
              <div
                dangerouslySetInnerHTML={{ __html: convertToHtml(content) }}
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  lineHeight: '1.6',
                }}
              />
            </Card>
          )}
        </YStack>
      </Card>

      {/* Optional Note */}
      <Card elevate bordered padding="$4" backgroundColor="$background">
        <YStack gap="$3">
          <Heading size={3}>Include a Brief Note (Optional)</Heading>
          <Text fontSize="$3" color="$gray11">
            Add a note to include at the top of the email (e.g., corrections, important updates)
          </Text>
          <TextArea
            placeholder="Enter your note here..."
            value={note}
            onChangeText={(text) => setNote(text.slice(0, MAX_NOTE_LENGTH))}
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
            {note.length > 0 && (
              <Button size="$2" variant="outlined" onPress={() => setNote('')}>
                Clear Note
              </Button>
            )}
          </XStack>
        </YStack>
      </Card>

      {/* Action Buttons */}
      <YStack gap="$3">
        {/* Save Draft Button */}
        <Card elevate bordered padding="$4" backgroundColor="$background">
          <XStack gap="$3" alignItems="center">
            <Save size={20} color="$gray10" />
            <YStack flex={1}>
              <Text fontWeight="600" fontSize="$4">
                Save Draft
              </Text>
              <Text fontSize="$3" color="$gray11">
                Save your progress without sending
              </Text>
            </YStack>
            <Button
              size="$4"
              icon={Save}
              onPress={handleSaveDraft}
              disabled={savingDraft || !subject.trim() || !content.trim()}
              variant="outlined"
            >
              {savingDraft ? 'Saving...' : currentDraftId ? 'Update' : 'Save'}
            </Button>
          </XStack>
        </Card>

        {/* Test Send Button */}
        <Card elevate bordered padding="$4" backgroundColor="$orange2">
          <XStack gap="$3" alignItems="center">
            <TestTube2 size={20} color="$orange10" />
            <YStack flex={1}>
              <Text fontWeight="600" fontSize="$4">
                Send Test Email
              </Text>
              <Text fontSize="$3" color="$gray11">
                Send to <strong>Test List</strong> to verify before production
              </Text>
            </YStack>
            <Button
              size="$4"
              icon={sendingTest ? undefined : TestTube2}
              onPress={handleSendTest}
              disabled={sendingTest || sendingProduction || !subject.trim() || !content.trim()}
            >
              {sendingTest ? (
                <XStack gap="$2" alignItems="center">
                  <Spinner size="small" />
                  <Text>Sending Test...</Text>
                </XStack>
              ) : (
                'Send Test'
              )}
            </Button>
          </XStack>
        </Card>

        {/* Production Send Button */}
        <Card elevate bordered padding="$4" backgroundColor="$blue2">
          <XStack gap="$3" alignItems="center">
            <AlertCircle size={20} color="$blue10" />
            <YStack flex={1}>
              <Text fontWeight="600" fontSize="$4">
                Send to Production List
              </Text>
              <Text fontSize="$3" color="$gray11">
                Sending to: <strong>{availableLists.find((l) => l.key === selectedList)?.label}</strong>
              </Text>
              {currentDraft?.status !== 'tested' && (
                <Text fontSize="$2" color="$orange10" fontWeight="600">
                  ⚠️ Not tested yet - consider sending a test first
                </Text>
              )}
            </YStack>
            <Button
              size="$4"
              icon={sendingProduction ? undefined : Send}
              onPress={handleSendProduction}
              disabled={sendingTest || sendingProduction || !subject.trim() || !content.trim()}
            >
              {sendingProduction ? (
                <XStack gap="$2" alignItems="center">
                  <Spinner size="small" />
                  <Text>Sending to {availableLists.find((l) => l.key === selectedList)?.label}...</Text>
                </XStack>
              ) : (
                'Send Email'
              )}
            </Button>
          </XStack>
        </Card>
      </YStack>
    </YStack>
  )
}

// Simple markdown-like to HTML converter
function convertToHtml(content: string): string {
  if (!content) return ''

  let html = content

  // Convert **bold** to <strong>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  // Convert [text](url) to links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #0066cc; text-decoration: none; font-weight: 600;">$1</a>')

  // Convert bullet points (lines starting with - or *)
  const lines = html.split('\n')
  let inList = false
  const processedLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        processedLines.push('<ul>')
        inList = true
      }
      processedLines.push(`<li>${line.substring(2)}</li>`)
    } else {
      if (inList) {
        processedLines.push('</ul>')
        inList = false
      }
      if (line === '') {
        processedLines.push('</p><p>')
      } else {
        processedLines.push(line)
      }
    }
  }

  if (inList) {
    processedLines.push('</ul>')
  }

  html = '<p>' + processedLines.join('\n') + '</p>'

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '')
  html = html.replace(/<p>\s*<ul>/g, '<ul>')
  html = html.replace(/<\/ul>\s*<\/p>/g, '</ul>')

  return html
}

// Convert HTML back to markdown-like format for editing
function convertFromHtml(html: string): string {
  if (!html) return ''

  let text = html

  // Convert <strong> to **bold**
  text = text.replace(/<strong>([^<]+)<\/strong>/g, '**$1**')

  // Convert links to [text](url)
  text = text.replace(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '[$2]($1)')

  // Handle lists - convert to markdown format with proper line breaks
  text = text.replace(/<ul>\s*/g, '\n')
  text = text.replace(/<\/ul>\s*/g, '\n')
  text = text.replace(/<li>([^<]+)<\/li>\s*/g, '- $1\n')

  // Convert paragraphs - split by </p><p> first
  text = text.replace(/<\/p>\s*<p>/g, '\n\n')

  // Remove opening and closing p tags
  text = text.replace(/<p>/g, '')
  text = text.replace(/<\/p>/g, '')

  // Clean up multiple consecutive newlines (more than 2)
  text = text.replace(/\n{3,}/g, '\n\n')

  // Clean up leading/trailing whitespace
  text = text.trim()

  return text
}
