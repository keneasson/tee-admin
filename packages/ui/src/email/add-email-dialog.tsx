import { useState } from 'react'
import { YStack, XStack, Dialog, Button, Text, Input, Label, Separator } from 'tamagui'
import { Mail, User, AlertTriangle, X, Check } from '@tamagui/lucide-icons'

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

type AddEmailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: PersonResult
  onAddEmail: (person: PersonResult, newEmail: string) => Promise<void>
}

export function AddEmailDialog({ open, onOpenChange, person, onAddEmail }: AddEmailDialogProps) {
  const [newEmail, setNewEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const activeEmailCount = person ? person.emails.filter(e => e.status === 'active').length : 0
  const canAddEmail = activeEmailCount < 2

  const validateEmail = (email: string): boolean => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setValidationError('Invalid email format')
      return false
    }

    // Check if email already exists for this person
    if (person?.emails.some(e => e.email.toLowerCase() === email.toLowerCase())) {
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
    if (!person || !validateEmail(newEmail)) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onAddEmail(person, newEmail)
      setNewEmail('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add email')
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

  // Don't render if no person provided
  if (!person) {
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
          animateOnly={['transform', 'opacity']}
          animation={[
            'quick',
            {
              opacity: {
                overshootClamping: true,
              },
            },
          ]}
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
          padding="$5"
          width="90%"
          maxWidth={500}
        >
          <Dialog.Title fontSize="$7" fontWeight="bold">
            Add Second Email
          </Dialog.Title>

          <Dialog.Description fontSize="$4" color="$gray11">
            Add a second email address for {person.displayName}
          </Dialog.Description>

          <YStack gap="$4">
            {/* Current Person Info */}
            <YStack gap="$2" padding="$3" backgroundColor="$gray2" borderRadius="$3">
              <XStack gap="$2" alignItems="center">
                <User size={16} color="$gray11" />
                <Text fontSize="$4" fontWeight="bold">
                  {person.displayName}
                </Text>
              </XStack>

              <YStack gap="$1">
                <Text fontSize="$3" color="$gray11">
                  Active emails ({activeEmailCount}/2):
                </Text>
                {person.emails.filter(e => e.status === 'active').map((email, index) => (
                  <XStack key={email.email} gap="$2" alignItems="center">
                    <Mail size={14} color="$gray11" />
                    <Text fontSize="$3">
                      {email.email} {index === 0 && '(PRIMARY)'}
                    </Text>
                  </XStack>
                ))}
              </YStack>
            </YStack>

            {/* Email Input */}
            {canAddEmail ? (
              <YStack gap="$2">
                <Label htmlFor="newEmail" fontSize="$3" fontWeight="600">
                  New Email Address
                </Label>
                <Input
                  id="newEmail"
                  size="$4"
                  placeholder="email@example.com"
                  value={newEmail}
                  onChangeText={handleEmailChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  disabled={isSubmitting}
                />
                {validationError && (
                  <XStack gap="$2" alignItems="center">
                    <AlertTriangle size={14} color="$red11" />
                    <Text fontSize="$2" color="$red11">
                      {validationError}
                    </Text>
                  </XStack>
                )}
              </YStack>
            ) : (
              <XStack gap="$2" alignItems="flex-start" padding="$3" backgroundColor="$yellow3" borderRadius="$3">
                <AlertTriangle size={16} color="$yellow11" />
                <YStack flex={1}>
                  <Text fontSize="$3" fontWeight="bold" color="$yellow11">
                    Maximum active emails reached
                  </Text>
                  <Text fontSize="$3" color="$yellow11">
                    This person already has 2 active email addresses (maximum allowed). Archive one before adding another.
                  </Text>
                </YStack>
              </XStack>
            )}

            {/* Info Note */}
            <XStack gap="$2" alignItems="flex-start" padding="$3" backgroundColor="$blue2" borderRadius="$3">
              <Check size={16} color="$blue11" />
              <Text fontSize="$3" color="$blue11" flex={1}>
                The new email will be added to the directory. To sync subscriptions, use "Migrate Email" instead.
              </Text>
            </XStack>

            {error && (
              <XStack gap="$2" alignItems="center" padding="$3" backgroundColor="$red3" borderRadius="$3">
                <AlertTriangle size={16} color="$red11" />
                <Text fontSize="$3" color="$red11" flex={1}>
                  {error}
                </Text>
              </XStack>
            )}
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
              disabled={!canAddEmail || !newEmail || isSubmitting || !!validationError}
            >
              {isSubmitting ? 'Adding...' : 'Add Email'}
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
