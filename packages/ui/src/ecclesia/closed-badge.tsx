import { XStack, YStack, Text } from 'tamagui'
import { closedLabel, isClosedEcclesia, type EcclesiaClosure } from '@my/app/utils/ecclesia-name'

/**
 * "Closed {year}" for an ecclesia that has closed, plus its note when there is
 * one. Renders nothing for an active ecclesia. One component, so the directory
 * list, the record page and search results all say it the same way.
 */
export function ClosedBadge({ ecclesia, showNote = false }: { ecclesia: EcclesiaClosure; showNote?: boolean }) {
  if (!isClosedEcclesia(ecclesia)) return null
  return (
    <YStack gap="$1" alignItems="flex-start">
      <XStack
        paddingHorizontal="$2"
        paddingVertical="$1"
        borderRadius="$2"
        backgroundColor="$gray4"
        borderWidth={1}
        borderColor="$gray8"
      >
        <Text fontSize="$2" fontWeight="600" color="$gray11">
          {closedLabel(ecclesia)}
        </Text>
      </XStack>
      {showNote && ecclesia.closedNote ? (
        <Text fontSize="$3" color="$gray11">
          {ecclesia.closedNote}
        </Text>
      ) : null}
    </YStack>
  )
}
