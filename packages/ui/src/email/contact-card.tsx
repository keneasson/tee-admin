import { useState, useMemo } from 'react'
import { YStack, XStack, Card, Text, Separator, styled, useThemeName } from 'tamagui'
import { Button } from '../Button'
import { AlertTriangle, Mail, GripVertical, User, MapPin, Phone, Users, Save, X, Archive, ArchiveRestore } from '@tamagui/lucide-icons'
import { brandColors } from '../branding/brand-colors'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

// Email list types
type EmailListTypeKeys = 'sundaySchool' | 'newsletter' | 'memorial' | 'bibleClass' | 'members' | 'testList'

type EmailStatus = 'active' | 'archived'

type EmailResult = {
  email: string
  inSES: boolean
  inDirectory: boolean
  isPrimary: boolean
  status: EmailStatus  // 'active' = can receive SES emails, 'archived' = historical record only
  isBounced?: boolean
  bounceReason?: string
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
  hasStaleLink?: boolean
  staleLinkSK?: string
}

type ContactCardProps = {
  person: PersonResult
  onMerge?: (person: PersonResult) => void
  onMigrate?: (oldEmail: string, person: PersonResult) => void
  onReorder?: (person: PersonResult, emails: string[]) => void
  onUnsubscribeAll?: (email: string) => void
  onAddEmail?: (person: PersonResult) => void
  onArchive?: (person: PersonResult, email: string) => void
  onUnarchive?: (person: PersonResult, email: string) => void
  onSaveSubscriptions?: (changes: { email: string; list: EmailListTypeKeys; subscribed: boolean }[]) => Promise<void>
  isAdminOrHigher?: boolean
}

const DragHandle = styled(YStack, {
  cursor: 'grab',
  padding: '$2',
  hoverStyle: {
    backgroundColor: '$gray3',
  },
})

const EmailListBadge = styled(XStack, {
  name: 'EmailListBadge',
  alignItems: 'center',
  gap: '$1',
  paddingHorizontal: '$2',
  paddingVertical: '$1',
  borderRadius: '$2',
  backgroundColor: '$gray2',
  minWidth: 80,
})

export function ContactCard({
  person,
  onMerge,
  onMigrate,
  onReorder,
  onUnsubscribeAll,
  onAddEmail,
  onArchive,
  onUnarchive,
  onSaveSubscriptions,
  isAdminOrHigher = false,
}: ContactCardProps) {
  const [draggedEmailIndex, setDraggedEmailIndex] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Get brand colors based on theme
  const themeName = useThemeName()
  const mode = String(themeName).includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  // Track pending subscription changes: { email -> { list -> pendingValue } }
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<EmailListTypeKeys, boolean>>>({})

  const emailLists: { key: EmailListTypeKeys; label: string; adminOnly?: boolean }[] = [
    { key: 'newsletter', label: 'Newsletter' },
    { key: 'memorial', label: 'Memorial' },
    { key: 'bibleClass', label: 'Bible Class' },
    { key: 'sundaySchool', label: 'Sunday School' },
    { key: 'members', label: 'Members' },
    { key: 'testList', label: 'Test', adminOnly: true },
  ]

  const handleDragStart = (index: number) => {
    setDraggedEmailIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (dropIndex: number) => {
    if (draggedEmailIndex === null || draggedEmailIndex === dropIndex) {
      setDraggedEmailIndex(null)
      return
    }

    const reorderedEmails = [...person.emails]
    const [draggedEmail] = reorderedEmails.splice(draggedEmailIndex, 1)
    reorderedEmails.splice(dropIndex, 0, draggedEmail)

    const emailAddresses = reorderedEmails.map((e) => e.email)
    onReorder?.(person, emailAddresses)
    setDraggedEmailIndex(null)
  }

  // Check if there are any pending changes
  const hasPendingChanges = useMemo(() => {
    return Object.keys(pendingChanges).length > 0 &&
      Object.values(pendingChanges).some(lists => Object.keys(lists).length > 0)
  }, [pendingChanges])

  // Get effective subscription state (pending or original)
  const getEffectiveSubscription = (email: string, list: EmailListTypeKeys): boolean => {
    if (pendingChanges[email]?.[list] !== undefined) {
      return pendingChanges[email][list]
    }
    const emailData = person.emails.find(e => e.email === email)
    return emailData?.sesLists?.[list] || false
  }

  // Toggle a subscription (adds to pending changes)
  const handleToggleSubscription = (email: string, list: EmailListTypeKeys) => {
    const currentValue = getEffectiveSubscription(email, list)
    const newValue = !currentValue

    setPendingChanges(prev => ({
      ...prev,
      [email]: {
        ...prev[email],
        [list]: newValue
      }
    }))
  }

  // Save all pending changes
  const handleSave = async () => {
    if (!onSaveSubscriptions || !hasPendingChanges) return

    setIsSaving(true)
    try {
      // Convert pending changes to array of changes
      const changes: { email: string; list: EmailListTypeKeys; subscribed: boolean }[] = []
      Object.entries(pendingChanges).forEach(([email, lists]) => {
        Object.entries(lists).forEach(([list, subscribed]) => {
          changes.push({ email, list: list as EmailListTypeKeys, subscribed })
        })
      })

      await onSaveSubscriptions(changes)
      setPendingChanges({}) // Clear pending changes on success
    } catch (error) {
      console.error('Failed to save subscription changes:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Cancel pending changes
  const handleCancel = () => {
    setPendingChanges({})
  }

  const isEmailUnsubscribed = (email: EmailResult) => {
    if (!email.inSES || !email.sesLists) return true
    return Object.values(email.sesLists).every((subscribed) => !subscribed)
  }

  const activeEmailCount = person.emails.filter(e => e.status === 'active').length
  const canAddEmail = activeEmailCount < 2

  return (
    <Card elevate size="$4" bordered padding="$4" marginBottom="$3">
      <YStack gap="$3">
        {/* Header with name and duplicate warning */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center" flexShrink={1}>
            <User size={20} flexShrink={0} />
            <YStack flexShrink={1} minWidth={0}>
              <XStack gap="$2" alignItems="center" flexWrap="nowrap">
                <Text fontSize="$6" fontWeight="bold" flexShrink={1} numberOfLines={1}>
                  {person.displayName}
                </Text>
                {person.isMember ? (
                  <Text fontSize="$2" color="$gray11" flexShrink={0}>
                    Member
                  </Text>
                ) : null}
              </XStack>
            </YStack>
          </XStack>

          <XStack gap="$2">
            {person.isPotentialDuplicate ? <XStack gap="$2" alignItems="center" paddingHorizontal="$3" paddingVertical="$2" backgroundColor="$yellow3" borderRadius="$3">
                <AlertTriangle size={16} color="$yellow11" />
                <Text fontSize="$2" color="$yellow11">
                  Potential Duplicate
                </Text>
              </XStack> : null}
            {person.hasStaleLink ? <XStack gap="$2" alignItems="center" paddingHorizontal="$3" paddingVertical="$2" backgroundColor="$red3" borderRadius="$3">
                <AlertTriangle size={16} color="$red11" />
                <Text fontSize="$2" color="$red11">
                  Stale Link (was: {person.staleLinkSK})
                </Text>
              </XStack> : null}
          </XStack>
        </XStack>

        <Separator />

        {/* Directory Information */}
        {person.directoryData ? (
          <YStack gap="$2">
            {person.directoryData.address ? (
              <XStack gap="$2" alignItems="center">
                <MapPin size={16} color="$gray11" />
                <Text fontSize="$3" color="$gray11">
                  {person.directoryData.address}
                </Text>
              </XStack>
            ) : null}
            {person.directoryData.phone ? (
              <XStack gap="$2" alignItems="center">
                <Phone size={16} color="$gray11" />
                <Text fontSize="$3" color="$gray11">
                  {person.directoryData.phone}
                </Text>
              </XStack>
            ) : null}
            {person.directoryData.ecclesia ? (
              <XStack gap="$2" alignItems="center">
                <Users size={16} color="$gray11" />
                <Text fontSize="$3" color="$gray11">
                  {HOME_ECCLESIA.normalize(person.directoryData.ecclesia)}
                </Text>
              </XStack>
            ) : null}
            {person.directoryData.children ? (
              <Text fontSize="$3" color="$gray11">
                Children: {person.directoryData.children}
              </Text>
            ) : null}
          </YStack>
        ) : null}

        {person.directoryData ? <Separator /> : null}

        {/* Emails */}
        <YStack gap="$3">
          {person.emails.map((emailData, index) => {
            const isUnsubscribed = isEmailUnsubscribed(emailData)
            const isArchived = emailData.status === 'archived'

            return (
              <YStack
                key={emailData.email}
                opacity={draggedEmailIndex === index ? 0.5 : isArchived ? 0.6 : 1}
                padding="$3"
                backgroundColor={isArchived ? '$gray1' : '$gray2'}
                borderRadius="$3"
                gap="$2"
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <XStack gap="$2" alignItems="center" flex={1}>
                    {person.emails.length > 1 ? <DragHandle>
                        <GripVertical size={16} color="$gray11" />
                      </DragHandle> : null}
                    <Mail size={16} color={emailData.isPrimary ? '$blue11' : isArchived ? '$gray9' : '$gray11'} />
                    <YStack flex={1}>
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize="$4" fontWeight={emailData.isPrimary ? 'bold' : 'normal'} color={isArchived ? '$gray10' : undefined}>
                          {emailData.email}
                        </Text>
                        {emailData.isPrimary ? <Button
                            backgroundColor={colors.info}
                            color={colors.infoForeground}
                            size="$1"
                            disabled
                            borderRadius="$2"
                            paddingHorizontal="$2"
                            paddingVertical="$1"
                            fontSize={12}
                          >
                            Primary
                          </Button> : null}
                        {emailData.isBounced ? <Button
                            backgroundColor={colors.error}
                            color={colors.errorForeground}
                            size="$1"
                            disabled
                            borderRadius="$2"
                            paddingHorizontal="$2"
                            paddingVertical="$1"
                            fontSize={12}
                          >
                            Bounced
                          </Button> : null}
                        {isArchived ? <Text fontSize="$2" color="$gray10" backgroundColor="$gray4" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                            ARCHIVED
                          </Text> : null}
                        {!isArchived && !emailData.isBounced && isUnsubscribed ? <Text fontSize="$2" color="$gray11">
                            Unsubscribed
                          </Text> : null}
                      </XStack>
                      <XStack gap="$2">
                        {emailData.inDirectory ? <Text fontSize="$2" color="$green11">
                            In Directory
                          </Text> : null}
                        {emailData.inSES ? <Text fontSize="$2" color="$blue11">
                            In SES
                          </Text> : null}
                        {!emailData.inDirectory && !emailData.inSES ? <Text fontSize="$2" color="$red11">
                            Not synced
                          </Text> : null}
                      </XStack>
                    </YStack>
                  </XStack>

                  <XStack gap="$2">
                    {!emailData.isPrimary && onMigrate && !isArchived ? <Button size="$2" chromeless onPress={() => onMigrate(emailData.email, person)}>
                        Migrate
                      </Button> : null}
                    {onUnsubscribeAll && emailData.inSES && !isUnsubscribed && !isArchived ? <Button size="$2" chromeless theme="red" onPress={() => onUnsubscribeAll(emailData.email)}>
                        Unsubscribe All
                      </Button> : null}
                    {!isArchived && onArchive && activeEmailCount > 1 ? <Button size="$2" chromeless icon={Archive} onPress={() => onArchive(person, emailData.email)}>
                        Archive
                      </Button> : null}
                    {isArchived && onUnarchive && activeEmailCount < 2 ? <Button size="$2" chromeless icon={ArchiveRestore} theme="blue" onPress={() => onUnarchive(person, emailData.email)}>
                        Unarchive
                      </Button> : null}
                  </XStack>
                </XStack>

                {/* Email Lists - Only show for active emails (archived emails can't receive SES) */}
                {!isArchived ? <XStack gap="$2" flexWrap="wrap" marginTop="$2">
                    {emailLists
                      .filter((list) => !list.adminOnly || isAdminOrHigher)
                      .map((list) => {
                      const isSubscribed = getEffectiveSubscription(emailData.email, list.key)
                      const hasPendingChange = pendingChanges[emailData.email]?.[list.key] !== undefined
                      const originalValue = emailData.sesLists?.[list.key] || false

                      return (
                        <EmailListBadge
                          key={list.key}
                          backgroundColor={isSubscribed ? '$blue3' : '$gray2'}
                          borderWidth={hasPendingChange ? 2 : 0}
                          borderColor={hasPendingChange ? '$orange8' : 'transparent'}
                          pressStyle={{ opacity: 0.8 }}
                          cursor="pointer"
                          onPress={() => handleToggleSubscription(emailData.email, list.key)}
                        >
                          <Text fontSize="$2" color={isSubscribed ? '$blue11' : '$gray11'}>
                            {isSubscribed ? '✓' : '○'}
                          </Text>
                          <Text fontSize="$2" color={isSubscribed ? '$blue11' : '$gray11'}>
                            {list.label}
                          </Text>
                          {hasPendingChange ? (
                            <Text fontSize="$1" color="$orange11">
                              *
                            </Text>
                          ) : null}
                        </EmailListBadge>
                      )
                    })}
                  </XStack> : null}
              </YStack>
            )
          })}
        </YStack>

        {/* Save/Cancel Buttons - Show only when there are pending changes */}
        {hasPendingChanges ? (
          <>
            <Separator />
            <XStack gap="$3" justifyContent="space-between" alignItems="center">
              <Text fontSize="$3" color="$orange11" fontWeight="600">
                You have unsaved changes
              </Text>
              <XStack gap="$2">
                <Button
                  size="$3"
                  chromeless
                  icon={X}
                  onPress={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="$3"
                  theme="blue"
                  icon={Save}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </XStack>
            </XStack>
          </>
        ) : null}

        <Separator />

        {/* Actions */}
        <XStack gap="$2" justifyContent="flex-end">
          {canAddEmail && onAddEmail ? (
            <Button size="$3" chromeless onPress={() => onAddEmail(person)}>
              Add Email
            </Button>
          ) : null}
          {onMerge ? (
            <Button size="$3" chromeless onPress={() => onMerge(person)}>
              Merge with Another Contact
            </Button>
          ) : null}
        </XStack>
      </YStack>
    </Card>
  )
}
