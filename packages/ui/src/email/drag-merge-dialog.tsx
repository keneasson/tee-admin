import React from 'react'
import { Dialog, Button, Text, XStack, YStack, Card, Separator } from 'tamagui'
import { ArrowRight, Users, Mail, AlertTriangle } from '@tamagui/lucide-icons'
import type { PersonEntry, EmailRow } from './draggable-contact-card'
import { brandColors } from '../branding/brand-colors'

interface DragMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  source: PersonEntry | null
  target: PersonEntry | null
  onConfirm: () => void
  isLoading?: boolean
}

export function DragMergeDialog({
  open,
  onOpenChange,
  source,
  target,
  onConfirm,
  isLoading = false,
}: DragMergeDialogProps) {
  if (!source || !target) return null

  // Compute merged emails (all unique emails from both contacts)
  const mergedEmails = getMergedEmails(source, target)

  const sourceName = source.firstName
    ? `${source.firstName} ${source.lastName}`
    : source.sesOnlyEmail || 'Unknown'

  const targetName = target.firstName
    ? `${target.firstName} ${target.lastName}`
    : target.sesOnlyEmail || 'Unknown'

  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          opacity={0.5}
        />
        <Dialog.Content
          key="content"
          bordered
          elevate
          gap="$4"
          padding="$4"
          maxWidth={700}
          width="95%"
        >
          <Dialog.Title fontSize="$6" fontWeight="600">
            <XStack gap="$2" alignItems="center">
              <Users size={24} color="$blue10" />
              <Text fontSize="$6" fontWeight="600">Merge Contacts</Text>
            </XStack>
          </Dialog.Title>

          <YStack gap="$4">
            {/* Warning notice */}
            <Card padding="$3" backgroundColor="$yellow2" borderWidth={1} borderColor="$yellow7">
              <XStack gap="$2" alignItems="center">
                <AlertTriangle size={16} color="$yellow10" />
                <Text fontSize="$3" color="$yellow11">
                  This will combine both contacts into one. The source contact will be deleted.
                </Text>
              </XStack>
            </Card>

            {/* Side-by-side comparison */}
            <XStack gap="$3" alignItems="stretch">
              {/* Source card (being dragged) */}
              <Card flex={1} padding="$3" backgroundColor="$red2" borderWidth={2} borderColor="$red7">
                <YStack gap="$2">
                  <Text fontSize="$2" color="$red10" fontWeight="600">SOURCE (will be deleted)</Text>
                  <Separator />
                  <ContactPreview person={source} />
                </YStack>
              </Card>

              {/* Arrow */}
              <YStack justifyContent="center" alignItems="center" paddingHorizontal="$2">
                <ArrowRight size={24} color="$gray10" />
              </YStack>

              {/* Target card (drop target) */}
              <Card flex={1} padding="$3" backgroundColor="$green2" borderWidth={2} borderColor="$green7">
                <YStack gap="$2">
                  <Text fontSize="$2" color="$green10" fontWeight="600">TARGET (will keep)</Text>
                  <Separator />
                  <ContactPreview person={target} />
                </YStack>
              </Card>
            </XStack>

            {/* Merged result preview */}
            <Card padding="$3" backgroundColor="$blue2" borderWidth={2} borderColor="$blue7">
              <YStack gap="$2">
                <Text fontSize="$3" color="$blue10" fontWeight="600">After Merge:</Text>
                <Separator />
                <YStack gap="$1">
                  <Text fontSize="$4" fontWeight="600">{targetName}</Text>
                  <Text fontSize="$2" color="$gray11">{target.ecclesia || source.ecclesia || 'No ecclesia'}</Text>
                  <YStack gap="$1" marginTop="$2">
                    <XStack gap="$1" alignItems="center">
                      <Mail size={14} color="$gray11" />
                      <Text fontSize="$2" color="$gray11" fontWeight="600">
                        {mergedEmails.length} email{mergedEmails.length !== 1 ? 's' : ''}:
                      </Text>
                    </XStack>
                    {mergedEmails.map((email, idx) => (
                      <Text key={idx} fontSize="$3" paddingLeft="$4">
                        • {email}
                      </Text>
                    ))}
                  </YStack>
                </YStack>
              </YStack>
            </Card>
          </YStack>

          {/* Action buttons */}
          <XStack gap="$3" justifyContent="flex-end" marginTop="$2">
            <Dialog.Close asChild>
              <Button
                variant="outlined"
                borderWidth={2}
                borderColor="$textTertiary"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              backgroundColor={brandColors.light.primary}
              color="white"
              borderWidth={2}
              borderColor={brandColors.light.primary}
              hoverStyle={{
                backgroundColor: brandColors.light.primary,
                opacity: 0.9
              }}
              onPress={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Merging...' : 'Confirm Merge'}
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}

// Helper component to show contact preview
function ContactPreview({ person }: { person: PersonEntry }) {
  const name = person.firstName
    ? `${person.firstName} ${person.lastName}`
    : person.sesOnlyEmail || 'Unknown'

  return (
    <YStack gap="$1">
      <Text fontSize="$4" fontWeight="600">{name}</Text>
      {person.ecclesia ? (
        <Text fontSize="$2" color="$gray11">{person.ecclesia}</Text>
      ) : null}
      <YStack gap="$1" marginTop="$1">
        {person.emails.map((emailRow, idx) => (
          <XStack key={idx} gap="$1" alignItems="center">
            <Mail size={12} color="$gray10" />
            <Text fontSize="$2">{emailRow.email}</Text>
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}

// Helper to get all unique emails from both contacts
function getMergedEmails(source: PersonEntry, target: PersonEntry): string[] {
  const emailSet = new Set<string>()

  // Add target emails first (they take precedence)
  target.emails.forEach(e => {
    if (e.email) emailSet.add(e.email.toLowerCase())
  })

  // Add source emails
  source.emails.forEach(e => {
    if (e.email) emailSet.add(e.email.toLowerCase())
  })

  return Array.from(emailSet)
}
