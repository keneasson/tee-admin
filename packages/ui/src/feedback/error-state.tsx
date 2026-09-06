import { YStack, XStack, Text, Heading } from 'tamagui'
import { Button } from '../Button'

/**
 * The ONE full-surface error state: a heading, the message, and an optional way
 * back. Same rationale as {@link LoadingState} — error colour and recovery
 * affordance are brand decisions, owned here rather than per route (ADR 0003).
 */
export interface ErrorStateProps {
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
}

export function ErrorState({ title, message, actionLabel, onAction }: ErrorStateProps) {
  return (
    <YStack flex={1} padding="$4" gap="$3">
      <Heading size="$7">{title}</Heading>
      <Text color="$red10">{message}</Text>
      {onAction && actionLabel ? (
        <XStack>
          <Button variant="outlined" onPress={onAction}>
            {actionLabel}
          </Button>
        </XStack>
      ) : null}
    </YStack>
  )
}
