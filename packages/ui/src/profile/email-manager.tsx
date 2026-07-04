import React, { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Spinner } from 'tamagui'
import { Button } from '../Button'
import { Mail, Plus, Trash2, GripVertical, Check, AlertCircle, Send, Bell } from '@tamagui/lucide-icons'

export interface EmailEntry {
  id: string
  email: string
  verified: boolean
  verificationSentAt?: string
  subscribed?: boolean // Whether subscribed to communications
  subscriptionCount?: number // How many mailing lists this address is opted into
  isPrimary?: boolean // Primary login email (cannot be removed)
}

interface EmailManagerProps {
  emails: EmailEntry[]
  onChange: (emails: EmailEntry[]) => void
  onSave?: () => Promise<void>
  onSendVerification?: (emailId: string) => Promise<void>
  saving?: boolean
  readOnly?: boolean
  emailPreferencesUrl?: string
}

// Simple email validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Generate a simple ID
function generateId(): string {
  return `email-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const EmailManager: React.FC<EmailManagerProps> = ({
  emails,
  onChange,
  onSave,
  onSendVerification,
  saving = false,
  readOnly = false,
  emailPreferencesUrl = '/email-preferences',
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [sendingVerification, setSendingVerification] = useState<string | null>(null)

  const handleAddEmail = () => {
    const newEmail: EmailEntry = {
      id: generateId(),
      email: '',
      verified: false,
    }
    onChange([...emails, newEmail])
  }

  const handleRemoveEmail = (id: string) => {
    // Don't allow removing primary email
    const emailToRemove = emails.find(e => e.id === id)
    if (emailToRemove?.isPrimary) return
    onChange(emails.filter(e => e.id !== id))
  }

  const handleUpdateEmail = (id: string, value: string) => {
    onChange(emails.map(e => e.id === id ? { ...e, email: value.toLowerCase().trim(), verified: false } : e))
  }

  const moveEmail = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= emails.length) return
    const newEmails = [...emails]
    const [moved] = newEmails.splice(fromIndex, 1)
    newEmails.splice(toIndex, 0, moved)
    onChange(newEmails)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      moveEmail(draggedIndex, index)
      setDraggedIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSendVerification = async (emailId: string) => {
    if (!onSendVerification) return
    setSendingVerification(emailId)
    try {
      await onSendVerification(emailId)
    } finally {
      setSendingVerification(null)
    }
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Mail size={20} />
          <Text fontSize="$4" fontWeight="600">Email Addresses</Text>
        </XStack>
        {!readOnly && (
          <Button size="$2" icon={Plus} onPress={handleAddEmail}>
            Add
          </Button>
        )}
      </XStack>

      {emails.length === 0 ? (
        <Card padding="$3" backgroundColor="$backgroundHover">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No email addresses. Click "Add" to add one.
          </Text>
        </Card>
      ) : (
        <YStack gap="$2">
          {emails.map((emailEntry, index) => (
            <Card
              key={emailEntry.id}
              padding="$3"
              backgroundColor={index === 0 ? '$blue2' : '$backgroundHover'}
              borderWidth={index === 0 ? 1 : 0}
              borderColor="$blue6"
              {...({
                draggable: !readOnly && !emailEntry.isPrimary,
                onDragStart: () => handleDragStart(index),
                onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
                onDragEnd: handleDragEnd,
              } as any)}
              opacity={draggedIndex === index ? 0.5 : 1}
            >
              <YStack gap="$2">
                <XStack gap="$3" alignItems="center">
                  {!readOnly && !emailEntry.isPrimary && (
                    <YStack cursor="grab" opacity={0.5}>
                      <GripVertical size={16} />
                    </YStack>
                  )}

                  <YStack flex={1} gap="$1">
                    {readOnly ? (
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <Text fontSize="$4" fontWeight="500">
                          {emailEntry.email || 'No email'}
                        </Text>
                        {index === 0 && (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$blue4">
                            <Text fontSize="$1" color="$blue10">Preferred</Text>
                          </Card>
                        )}
                        {emailEntry.isPrimary && (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$gray4">
                            <Text fontSize="$1" color="$gray11">Login</Text>
                          </Card>
                        )}
                      </XStack>
                    ) : (
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <Input
                          flex={1}
                          minWidth={200}
                          placeholder="email@example.com"
                          value={emailEntry.email}
                          onChangeText={(value) => handleUpdateEmail(emailEntry.id, value)}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          editable={!emailEntry.isPrimary}
                        />
                        {index === 0 && (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$blue4">
                            <Text fontSize="$1" color="$blue10">Preferred</Text>
                          </Card>
                        )}
                        {emailEntry.isPrimary && (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$gray4">
                            <Text fontSize="$1" color="$gray11">Login</Text>
                          </Card>
                        )}
                      </XStack>
                    )}

                    {/* Validation error */}
                    {emailEntry.email && !isValidEmail(emailEntry.email) && !readOnly && (
                      <Text fontSize="$2" color="$red10">
                        Enter a valid email address
                      </Text>
                    )}
                  </YStack>

                  {!readOnly && !emailEntry.isPrimary && (
                    <Button
                      size="$2"
                      circular
                      icon={Trash2}
                      theme="red"
                      onPress={() => handleRemoveEmail(emailEntry.id)}
                    />
                  )}
                </XStack>

                {/* Verification and subscription status */}
                <XStack gap="$3" alignItems="center" flexWrap="wrap" paddingLeft={!readOnly && !emailEntry.isPrimary ? '$6' : 0}>
                  {emailEntry.verified ? (
                    <XStack gap="$1" alignItems="center">
                      <Check size={14} color="$green10" />
                      <Text fontSize="$2" color="$green10">Verified</Text>
                    </XStack>
                  ) : emailEntry.email && isValidEmail(emailEntry.email) ? (
                    <XStack gap="$2" alignItems="center">
                      <XStack gap="$1" alignItems="center">
                        <AlertCircle size={14} color="$orange10" />
                        <Text fontSize="$2" color="$orange10">Not verified</Text>
                      </XStack>
                      {onSendVerification && (
                        <Button
                          size="$1"
                          icon={sendingVerification === emailEntry.id ? <Spinner size="small" /> : Send}
                          onPress={() => handleSendVerification(emailEntry.id)}
                          disabled={sendingVerification !== null}
                        >
                          {emailEntry.verificationSentAt ? 'Resend' : 'Verify'}
                        </Button>
                      )}
                    </XStack>
                  ) : null}

                  {emailEntry.verified && (
                    <>
                      {emailEntry.subscriptionCount !== undefined && (
                        <Text fontSize="$2" theme="alt2">
                          {emailEntry.subscriptionCount === 0
                            ? 'You are not currently signed up to any emails'
                            : `You are currently signed up to ${emailEntry.subscriptionCount} email${emailEntry.subscriptionCount === 1 ? '' : 's'}`}
                        </Text>
                      )}
                      <Button
                        size="$1"
                        icon={Bell}
                        onPress={() => {
                          if (typeof window !== 'undefined') window.location.href = emailPreferencesUrl
                        }}
                      >
                        Manage my Email Notifications
                      </Button>
                    </>
                  )}
                </XStack>
              </YStack>
            </Card>
          ))}
        </YStack>
      )}

      {emails.length > 1 && !readOnly && (
        <Text fontSize="$2" theme="alt2" textAlign="center">
          Drag to reorder. First email is your preferred contact.
        </Text>
      )}

      {onSave && !readOnly && (
        <Button
          theme="blue"
          onPress={onSave}
          disabled={saving || emails.some(e => e.email && !isValidEmail(e.email))}
          icon={saving ? <Spinner /> : undefined}
        >
          {saving ? 'Saving...' : 'Save Email Addresses'}
        </Button>
      )}
    </YStack>
  )
}
