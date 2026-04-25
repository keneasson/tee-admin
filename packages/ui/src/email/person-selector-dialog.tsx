import { useState, useMemo } from 'react'
import { YStack, XStack, Dialog, Text, Input, ScrollView, Separator } from 'tamagui'
import { Button } from '../Button'
import { Search, User, Mail, X, AlertTriangle, MapPin } from '@tamagui/lucide-icons'

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
  hasStaleLink?: boolean
  staleLinkSK?: string
}

type PersonSelectorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourcePerson?: PersonResult
  availablePersons: PersonResult[]
  onSelectTarget: (target: PersonResult) => void
}

export function PersonSelectorDialog({
  open,
  onOpenChange,
  sourcePerson,
  availablePersons,
  onSelectTarget
}: PersonSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null)

  // Filter available persons (exclude source person)
  const filteredPersons = useMemo(() => {
    if (!sourcePerson) return []
    const filtered = availablePersons.filter(p => p.baseSkey !== sourcePerson.baseSkey)

    if (!searchTerm) {
      return filtered
    }

    const search = searchTerm.toLowerCase()
    return filtered.filter(p => {
      const nameMatch = p.displayName.toLowerCase().includes(search) ||
                       p.firstName.toLowerCase().includes(search) ||
                       p.lastName.toLowerCase().includes(search)
      const emailMatch = p.emails.some(e => e.email.toLowerCase().includes(search))
      return nameMatch || emailMatch
    })
  }, [availablePersons, sourcePerson, searchTerm])

  const handleSelect = (person: PersonResult) => {
    setSelectedPerson(person)
  }

  const handleConfirm = () => {
    if (selectedPerson) {
      onSelectTarget(selectedPerson)
      handleClose()
    }
  }

  const handleClose = () => {
    setSearchTerm('')
    setSelectedPerson(null)
    onOpenChange(false)
  }

  // Calculate merge preview
  const mergePreview = selectedPerson && sourcePerson ? (() => {
    // Combine all unique emails (use status from search results)
    const allEmailsAfterMerge = [
      ...sourcePerson.emails,
      ...selectedPerson.emails.filter(e =>
        !sourcePerson.emails.some(se => se.email === e.email)
      )
    ]

    // Check if source is SES-only and will be added as archived
    const sourceIsSESOnly = sourcePerson.pkey.startsWith('SES#')
    const sourceWillBeArchived = sourceIsSESOnly &&
      sourcePerson.emails.length > 0 &&
      sourcePerson.emails[0].status === 'archived'

    const totalEmails = allEmailsAfterMerge.length
    const totalActiveAfterMerge = allEmailsAfterMerge.filter(e => e.status === 'active').length
    const totalArchivedAfterMerge = allEmailsAfterMerge.filter(e => e.status === 'archived').length
    const exceedsLimit = totalActiveAfterMerge > 2

    return {
      totalEmails,
      totalActiveAfterMerge,
      totalArchivedAfterMerge,
      exceedsLimit,
      sourceWillBeArchived
    }
  })() : null

  // Don't render dialog content if no source person
  if (!sourcePerson) {
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
          maxWidth={700}
          maxHeight="85vh"
        >
          <Dialog.Title fontSize="$7" fontWeight="bold">
            Select Person to Merge With
          </Dialog.Title>

          <Dialog.Description fontSize="$4" color="$gray11">
            Choose which person to merge {sourcePerson.displayName} into
          </Dialog.Description>

          <YStack gap="$4">
            {/* Source Person Card */}
            <YStack gap="$2" padding="$3" backgroundColor="$blue2" borderRadius="$3">
              <Text fontSize="$3" fontWeight="600" color="$blue11">
                Merging:
              </Text>
              <XStack gap="$2" alignItems="center">
                <User size={16} color="$blue11" />
                <Text fontSize="$4" fontWeight="bold" color="$blue11">
                  {sourcePerson.displayName}
                </Text>
              </XStack>
              <XStack gap="$2" flexWrap="wrap">
                {sourcePerson.emails.map((email) => (
                  <XStack key={email.email} gap="$1" alignItems="center">
                    <Mail size={12} color="$blue11" />
                    <Text fontSize="$2" color="$blue11">
                      {email.email}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            </YStack>

            <Separator />

            {/* Search */}
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center">
                <Search size={20} color="$gray10" />
                <Input
                  flex={1}
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  size="$4"
                />
              </XStack>
              <Text fontSize="$2" color="$gray11">
                {filteredPersons.length} {filteredPersons.length === 1 ? 'person' : 'people'} available
              </Text>
            </YStack>

            {/* Person List */}
            <ScrollView maxHeight={300}>
              <YStack gap="$2">
                {filteredPersons.length === 0 ? (
                  <YStack padding="$6" alignItems="center" gap="$2">
                    <Search size={48} color="$gray8" />
                    <Text fontSize="$4" color="$gray11">
                      No people found
                    </Text>
                    <Text fontSize="$3" color="$gray10">
                      Try a different search term
                    </Text>
                  </YStack>
                ) : (
                  filteredPersons.map((person) => {
                    const isSelected = selectedPerson?.baseSkey === person.baseSkey

                    return (
                      <XStack
                        key={person.baseSkey}
                        padding="$3"
                        backgroundColor={isSelected ? '$blue3' : '$gray2'}
                        borderRadius="$3"
                        borderWidth={2}
                        borderColor={isSelected ? '$blue8' : 'transparent'}
                        cursor="pointer"
                        hoverStyle={{ backgroundColor: isSelected ? '$blue3' : '$gray3' }}
                        pressStyle={{ scale: 0.98 }}
                        onPress={() => handleSelect(person)}
                        gap="$2"
                      >
                        <YStack flex={1} gap="$2">
                          <XStack gap="$2" alignItems="center">
                            <User size={16} color={isSelected ? '$blue11' : '$gray11'} />
                            <Text fontSize="$4" fontWeight="bold" color={isSelected ? '$blue11' : '$gray12'}>
                              {person.displayName}
                            </Text>
                            {person.isMember ? (
                              <Text
                                fontSize="$2"
                                fontWeight="600"
                                color="$green10"
                                backgroundColor="$green3"
                                paddingHorizontal="$2"
                                paddingVertical="$1"
                                borderRadius="$2"
                              >
                                Member
                              </Text>
                            ) : null}
                          </XStack>

                          <YStack gap="$1">
                            {person.emails.map((email, index) => (
                              <XStack key={email.email} gap="$2" alignItems="center">
                                <Mail size={12} color={isSelected ? '$blue11' : '$gray11'} />
                                <Text fontSize="$3" color={isSelected ? '$blue11' : '$gray11'}>
                                  {email.email}
                                </Text>
                                {index === 0 ? <Text fontSize="$2" color={isSelected ? '$blue10' : '$gray10'}>
                                    PRIMARY
                                  </Text> : null}
                              </XStack>
                            ))}
                          </YStack>

                          {person.directoryData?.address ? (
                            <XStack gap="$2" alignItems="center">
                              <MapPin size={12} color={isSelected ? '$blue11' : '$gray11'} />
                              <Text fontSize="$2" color={isSelected ? '$blue11' : '$gray11'}>
                                {person.directoryData.address}
                              </Text>
                            </XStack>
                          ) : null}
                        </YStack>

                        {isSelected ? (
                          <XStack alignItems="center" justifyContent="center" width={24} height={24} backgroundColor="$blue8" borderRadius="$10">
                            <Text fontSize="$3" color="white">
                              ✓
                            </Text>
                          </XStack>
                        ) : null}
                      </XStack>
                    )
                  })
                )}
              </YStack>
            </ScrollView>

            {/* Merge Preview */}
            {mergePreview ? (
              <YStack gap="$2" padding="$3" backgroundColor={mergePreview.exceedsLimit ? '$red2' : '$green2'} borderRadius="$3">
                <Text fontSize="$3" fontWeight="bold" color={mergePreview.exceedsLimit ? '$red11' : '$green11'}>
                  Merge Preview:
                </Text>
                <Text fontSize="$3" color={mergePreview.exceedsLimit ? '$red11' : '$green11'}>
                  Total emails: {mergePreview.totalEmails} ({mergePreview.totalActiveAfterMerge} active, {mergePreview.totalArchivedAfterMerge} archived)
                </Text>
                {mergePreview.sourceWillBeArchived ? (
                  <XStack gap="$2" alignItems="flex-start" padding="$2" backgroundColor="$blue3" borderRadius="$2">
                    <Text fontSize="$3" color="$blue11" flex={1}>
                      ℹ️ Email will be added as ARCHIVED (unsubscribed from all lists)
                    </Text>
                  </XStack>
                ) : null}
                {mergePreview.exceedsLimit ? (
                  <XStack gap="$2" alignItems="flex-start">
                    <AlertTriangle size={14} color="$red11" />
                    <Text fontSize="$3" color="$red11" flex={1}>
                      Cannot merge: Combined active emails exceed maximum of 2. Archive some emails first.
                    </Text>
                  </XStack>
                ) : null}
              </YStack>
            ) : null}
          </YStack>

          <XStack gap="$3" justifyContent="flex-end">
            <Dialog.Close displayWhenAdapted asChild>
              <Button chromeless onPress={handleClose}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              theme="blue"
              onPress={handleConfirm}
              disabled={!selectedPerson || (mergePreview?.exceedsLimit ?? false)}
            >
              Continue to Merge
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
