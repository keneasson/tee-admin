import { useState } from 'react'
import { YStack, XStack, Dialog, Button, Text, RadioGroup, Label, Separator, ScrollView } from 'tamagui'
import { AlertTriangle, User, Mail, MapPin, Phone, Users, X } from '@tamagui/lucide-icons'

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
  isPotentialDuplicate?: boolean
}

type MergeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourcePerson?: PersonResult
  targetPerson?: PersonResult
  onConfirmMerge: (sourcePK: string, sourceSK: string, targetPK: string, targetSK: string) => Promise<void>
}

export function MergeDialog({ open, onOpenChange, sourcePerson, targetPerson, onConfirmMerge }: MergeDialogProps) {
  const [selectedTarget, setSelectedTarget] = useState<'left' | 'right'>('left')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!sourcePerson || !targetPerson) {
    return null
  }

  const leftPerson = selectedTarget === 'left' ? targetPerson : sourcePerson
  const rightPerson = selectedTarget === 'left' ? sourcePerson : targetPerson

  // Calculate merged result
  const allEmails = [
    ...leftPerson.emails,
    ...rightPerson.emails.filter((e) => !leftPerson.emails.some((le) => le.email === e.email)),
  ]
  const totalEmails = allEmails.length
  const totalActiveEmails = allEmails.filter(e => e.status === 'active').length
  const exceedsLimit = totalActiveEmails > 2

  const handleConfirm = async () => {
    if (exceedsLimit) {
      setError('Cannot merge: total active emails would exceed maximum of 2. Archive some emails first.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const source = selectedTarget === 'left' ? sourcePerson : targetPerson
      const target = selectedTarget === 'left' ? targetPerson : sourcePerson

      console.log('🔀 Starting merge:', {
        source: { pkey: source.pkey, baseSkey: source.baseSkey, displayName: source.displayName },
        target: { pkey: target.pkey, baseSkey: target.baseSkey, displayName: target.displayName }
      })

      await onConfirmMerge(source.pkey, source.baseSkey, target.pkey, target.baseSkey)

      console.log('✅ Merge completed successfully')
      onOpenChange(false)
    } catch (err) {
      console.error('❌ Merge failed:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to merge contacts'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const PersonCard = ({ person, side }: { person: PersonResult; side: 'left' | 'right' }) => (
    <YStack flex={1} gap="$3" padding="$4" backgroundColor="$gray2" borderRadius="$4">
      <XStack gap="$2" alignItems="center">
        <User size={20} />
        <YStack flex={1}>
          <Text fontSize="$5" fontWeight="bold">
            {person.displayName}
          </Text>
          {person.isMember ? (
            <Text fontSize="$2" color="$gray11">
              Member
            </Text>
          ) : null}
        </YStack>
        <RadioGroup value={selectedTarget} onValueChange={(value) => setSelectedTarget(value as 'left' | 'right')}>
          <RadioGroup.Item value={side} id={`radio-${side}`}>
            <RadioGroup.Indicator />
          </RadioGroup.Item>
        </RadioGroup>
      </XStack>

      <Separator />

      {/* Emails */}
      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="bold" color="$gray11">
          Emails
        </Text>
        {person.emails.map((email) => (
          <XStack key={email.email} gap="$2" alignItems="center">
            <Mail size={14} color={email.isPrimary ? '$blue11' : email.status === 'archived' ? '$gray9' : '$gray11'} />
            <Text fontSize="$3" color={email.status === 'archived' ? '$gray10' : undefined}>{email.email}</Text>
            {email.isPrimary ? (
              <Text fontSize="$2" color="$blue11">
                PRIMARY
              </Text>
            ) : null}
            {email.status === 'archived' ? (
              <Text fontSize="$2" color="$gray10" backgroundColor="$gray4" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                ARCHIVED
              </Text>
            ) : null}
          </XStack>
        ))}
      </YStack>

      <Separator />

      {/* Directory Data */}
      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="bold" color="$gray11">
          Directory Information
        </Text>
        {person.directoryData?.address ? (
          <XStack gap="$2" alignItems="flex-start">
            <MapPin size={14} color="$gray11" />
            <Text fontSize="$3" flex={1}>
              {person.directoryData.address}
            </Text>
          </XStack>
        ) : null}
        {person.directoryData?.phone ? (
          <XStack gap="$2" alignItems="center">
            <Phone size={14} color="$gray11" />
            <Text fontSize="$3">{person.directoryData.phone}</Text>
          </XStack>
        ) : null}
        {person.directoryData?.ecclesia ? (
          <XStack gap="$2" alignItems="center">
            <Users size={14} color="$gray11" />
            <Text fontSize="$3">{person.directoryData.ecclesia}</Text>
          </XStack>
        ) : null}
        {person.directoryData?.children ? (
          <Text fontSize="$3">Children: {person.directoryData.children}</Text>
        ) : null}
        {!person.directoryData?.address &&
          !person.directoryData?.phone &&
          !person.directoryData?.ecclesia &&
          !person.directoryData?.children ? <Text fontSize="$3" color="$gray11" fontStyle="italic">No directory data</Text> : null}
      </YStack>
    </YStack>
  )

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
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
          maxWidth={900}
          maxHeight="90vh"
        >
          <Dialog.Title fontSize="$7" fontWeight="bold">
            Merge Contacts
          </Dialog.Title>

          <Dialog.Description fontSize="$4" color="$gray11">
            Choose which contact's directory information (name, address, phone) to keep. All emails from both contacts will be merged.
          </Dialog.Description>

          <YStack gap="$2" padding="$3" backgroundColor="$blue2" borderRadius="$3">
            <Text fontSize="$3" fontWeight="bold" color="$blue11">
              How merge works:
            </Text>
            <Text fontSize="$3" color="$blue11">
              • Select the contact with the correct directory information
            </Text>
            <Text fontSize="$3" color="$blue11">
              • All emails from both contacts will be combined
            </Text>
            <Text fontSize="$3" color="$blue11">
              • The other contact record will be deleted
            </Text>
          </YStack>

          <ScrollView maxHeight={500}>
            <YStack gap="$4">
              {/* Selection Label */}
              <Text fontSize="$4" fontWeight="bold" textAlign="center">
                Select which contact's information to keep ↓
              </Text>

              {/* Side-by-side comparison */}
              <XStack gap="$4">
                <PersonCard person={leftPerson} side="left" />
                <PersonCard person={rightPerson} side="right" />
              </XStack>

              {/* Preview merged result */}
              <YStack gap="$3" padding="$4" backgroundColor="$green2" borderRadius="$4">
                <Text fontSize="$4" fontWeight="bold" color="$green11">
                  Merged Result Preview
                </Text>
                <Text fontSize="$3" color="$green11">
                  Name: <Text fontWeight="bold">{selectedTarget === 'left' ? targetPerson.displayName : sourcePerson.displayName}</Text>
                </Text>
                <Text fontSize="$3" color="$green11">
                  Total Emails: {totalEmails} ({totalActiveEmails} active, {totalEmails - totalActiveEmails} archived)
                </Text>
                {totalEmails > 0 ? (
                  <YStack gap="$1">
                    {allEmails.map((email, index) => (
                      <Text key={email.email} fontSize="$3" color={email.status === 'archived' ? '$gray10' : '$green11'}>
                        • {email.email} {index === 0 ? '(PRIMARY)' : ''} {email.status === 'archived' ? '[ARCHIVED]' : ''}
                      </Text>
                    ))}
                  </YStack>
                ) : null}

                {exceedsLimit ? (
                  <XStack gap="$2" alignItems="center" padding="$3" backgroundColor="$red3" borderRadius="$3" marginTop="$2">
                    <AlertTriangle size={16} color="$red11" />
                    <Text fontSize="$3" color="$red11" flex={1}>
                      Cannot merge: Maximum 2 active emails per person. Combined total is {totalActiveEmails} active. Archive some emails first.
                    </Text>
                  </XStack>
                ) : null}
              </YStack>

              {/* Warning */}
              <XStack gap="$2" alignItems="flex-start" padding="$3" backgroundColor="$yellow3" borderRadius="$3">
                <AlertTriangle size={16} color="$yellow11" />
                <YStack flex={1} gap="$1">
                  <Text fontSize="$3" fontWeight="bold" color="$yellow11">
                    Warning: This action cannot be undone
                  </Text>
                  <Text fontSize="$3" color="$yellow11">
                    The non-selected contact will be permanently deleted from the directory.
                  </Text>
                </YStack>
              </XStack>

              {error ? (
                <XStack gap="$2" alignItems="center" padding="$3" backgroundColor="$red3" borderRadius="$3">
                  <AlertTriangle size={16} color="$red11" />
                  <Text fontSize="$3" color="$red11" flex={1}>
                    {error}
                  </Text>
                </XStack>
              ) : null}
            </YStack>
          </ScrollView>

          <XStack gap="$3" justifyContent="flex-end">
            <Dialog.Close displayWhenAdapted asChild>
              <Button chromeless disabled={isSubmitting}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button theme="blue" onPress={handleConfirm} disabled={exceedsLimit || isSubmitting}>
              {isSubmitting ? 'Merging...' : 'Confirm Merge'}
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
