import { useState } from 'react'
import { YStack, XStack, Dialog, Button, Text, Input, Label, Separator } from 'tamagui'
import { Mail, User, AlertTriangle, X, ArrowRight, Check } from '@tamagui/lucide-icons'

type EmailStatus = 'active' | 'archived'

type EmailResult = {
  email: string
  inSES: boolean
  inDirectory: boolean
  isPrimary: boolean
  status: EmailStatus
  sesLists?: {
    sundaySchool?: boolean
    newsletter?: boolean
    memorial?: boolean
    bibleClass?: boolean
    members?: boolean
    testList?: boolean
  }
}

type PersonResult = {
  pkey: string
  baseSkey: string
  firstName: string
  lastName: string
  displayName: string
  isMember: boolean
  emails: EmailResult[]
  directoryData?: {
    address?: string
    phone?: string
    children?: string
    ecclesia?: string
  }
}

type MigrateEmailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonResult
  oldEmail?: string
  onMigrateEmail: (person: PersonResult, oldEmail: string, newEmail: string) => Promise<void>
}

const listLabels = {
  sundaySchool: 'Sunday School',
  newsletter: 'Newsletter',
  memorial: 'Memorial',
  bibleClass: 'Bible Class',
  members: 'Members',
  testList: 'Test'
}

export function MigrateEmailDialog({
  open,
  onOpenChange,
  person,
  oldEmail,
  onMigrateEmail
}: MigrateEmailDialogProps) {
  const [newEmail, setNewEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const oldEmailData = person?.emails.find(e => e.email === oldEmail)

  // Get subscribed lists from old email
  const subscribedLists = oldEmailData
    ? Object.entries(oldEmailData.sesLists || {})
        .filter(([_, subscribed]) => subscribed)
        .map(([key, _]) => listLabels[key as keyof typeof listLabels] || key)
    : []

  const validateEmail = (email: string): boolean => {
    if (!person || !oldEmail) return false

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setValidationError('Invalid email format')
      return false
    }

    // Check if email is the same as old email
    if (email.toLowerCase() === oldEmail.toLowerCase()) {
      setValidationError('New email must be different from old email')
      return false
    }

    // Check if email already exists for this person
    if (person.emails.some(e => e.email.toLowerCase() === email.toLowerCase())) {
      setValidationError('This email already exists for this person')
      return false
    }

    setValidationError(null)
    return true
  }

  const handleEmailChange = (value: string) => {
    setNewEmail(value.trim())
    setValidationError(null)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!person || !oldEmail || !validateEmail(newEmail)) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onMigrateEmail(person, oldEmail, newEmail)
      setNewEmail('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to migrate email')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setNewEmail('')
    setError(null)
    setValidationError(null)
    onOpenChange(false)
  }

  // Don't render if missing required props
  if (!person || !oldEmail || !oldEmailData) {
    return null
  }

  return (
    <Dialog modal open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay key="overlay" animation="quick" opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animation="quick"
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
          padding="$5"
          width="90%"
          maxWidth={600}
        >
          <Dialog.Title fontSize="$7" fontWeight="bold">
            Migrate Email Address
          </Dialog.Title>

          <Dialog.Description fontSize="$4" color="$gray11">
            Transfer subscriptions from old email to new email for {person.displayName}
          </Dialog.Description>

          <YStack gap="$4">
            {/* Current Email Info */}
            <YStack gap="$3" padding="$3" backgroundColor="$gray2" borderRadius="$3">
              <XStack gap="$2" alignItems="center">
                <User size={16} color="$gray11" />
                <Text fontSize="$4" fontWeight="bold">
                  {person.displayName}
                </Text>
              </XStack>

              <Separator />

              <YStack gap="$2">
                <Text fontSize="$3" fontWeight="600" color="$gray11">
                  Old Email:
                </Text>
                <XStack gap="$2" alignItems="center">
                  <Mail size={14} color="$gray11" />
                  <Text fontSize="$3">{oldEmail}</Text>
                  {oldEmailData.isPrimary ? <Text fontSize="$2" color="$blue11">
                      PRIMARY
                    </Text> : null}
                </XStack>

                {subscribedLists.length > 0 ? <YStack gap="$1" marginTop="$2">
                    <Text fontSize="$3" color="$gray11">
                      Current subscriptions:
                    </Text>
                    <XStack gap="$2" flexWrap="wrap">
                      {subscribedLists.map((list) => (
                        <XStack
                          key={list}
                          paddingHorizontal="$2"
                          paddingVertical="$1"
                          backgroundColor="$blue3"
                          borderRadius="$2"
                          alignItems="center"
                          gap="$1"
                        >
                          <Check size={12} color="$blue11" />
                          <Text fontSize="$2" color="$blue11">
                            {list}
                          </Text>
                        </XStack>
                      ))}
                    </XStack>
                  </YStack> : null}
              </YStack>
            </YStack>

            {/* New Email Input */}
            <YStack gap="$2">
              <Label htmlFor="newEmail" fontSize="$3" fontWeight="600">
                New Email Address
              </Label>
              <Input
                id="newEmail"
                size="$4"
                placeholder="newemail@example.com"
                value={newEmail}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                disabled={isSubmitting}
              />
              {validationError ? <XStack gap="$2" alignItems="center">
                  <AlertTriangle size={14} color="$red11" />
                  <Text fontSize="$2" color="$red11">
                    {validationError}
                  </Text>
                </XStack> : null}
            </YStack>

            {/* Migration Preview */}
            {newEmail && !validationError ? <YStack gap="$3" padding="$3" backgroundColor="$blue2" borderRadius="$3">
                <Text fontSize="$3" fontWeight="bold" color="$blue11">
                  What will happen:
                </Text>

                <YStack gap="$2">
                  <XStack gap="$2" alignItems="center">
                    <Text fontSize="$3" color="$blue11">
                      1. Copy subscriptions to
                    </Text>
                    <Text fontSize="$3" fontWeight="bold" color="$blue11">
                      {newEmail}
                    </Text>
                  </XStack>

                  <XStack gap="$2" alignItems="center">
                    <Text fontSize="$3" color="$blue11">
                      2. Unsubscribe
                    </Text>
                    <Text fontSize="$3" fontWeight="bold" color="$blue11">
                      {oldEmail}
                    </Text>
                    <Text fontSize="$3" color="$blue11">
                      from all lists
                    </Text>
                  </XStack>

                  <XStack gap="$2" alignItems="center">
                    <Text fontSize="$3" color="$blue11">
                      3. Set
                    </Text>
                    <Text fontSize="$3" fontWeight="bold" color="$blue11">
                      {newEmail}
                    </Text>
                    <Text fontSize="$3" color="$blue11">
                      as primary in directory
                    </Text>
                  </XStack>

                  {subscribedLists.length > 0 ? <XStack gap="$2" alignItems="center" marginTop="$2">
                      <ArrowRight size={14} color="$blue11" />
                      <Text fontSize="$2" color="$blue11">
                        Lists to copy: {subscribedLists.join(', ')}
                      </Text>
                    </XStack> : null}
                </YStack>
              </YStack> : null}

            {/* Warning */}
            <XStack gap="$2" alignItems="flex-start" padding="$3" backgroundColor="$yellow3" borderRadius="$3">
              <AlertTriangle size={16} color="$yellow11" />
              <YStack flex={1}>
                <Text fontSize="$3" fontWeight="bold" color="$yellow11">
                  Warning: This action cannot be undone
                </Text>
                <Text fontSize="$3" color="$yellow11">
                  The old email address will be unsubscribed from all lists. Make sure the new email is correct before proceeding.
                </Text>
              </YStack>
            </XStack>

            {error ? <XStack gap="$2" alignItems="center" padding="$3" backgroundColor="$red3" borderRadius="$3">
                <AlertTriangle size={16} color="$red11" />
                <Text fontSize="$3" color="$red11" flex={1}>
                  {error}
                </Text>
              </XStack> : null}
          </YStack>

          <XStack gap="$3" justifyContent="flex-end">
            <Dialog.Close displayWhenAdapted asChild>
              <Button chromeless disabled={isSubmitting} onPress={handleClose}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              theme="blue"
              onPress={handleSubmit}
              disabled={!newEmail || isSubmitting || !!validationError}
            >
              {isSubmitting ? 'Migrating...' : 'Migrate Email'}
            </Button>
          </XStack>

          <Dialog.Close asChild>
            <Button position="absolute" top="$3" right="$3" size="$3" circular icon={X} chromeless />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
