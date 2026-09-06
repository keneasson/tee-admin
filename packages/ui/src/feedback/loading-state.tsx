import { YStack, Text } from 'tamagui'
import { Spinner } from '../Spinner'

/**
 * The ONE full-surface loading state.
 *
 * 26 pages had hand-rolled `<YStack …><Spinner size="large" width={36}
 * height={36} /><Text marginTop="$4">Loading…</Text></YStack>`, each free to
 * drift on size, spacing and wording. Those are BRAND decisions, so they belong
 * to one component and not to 26 route files (ADR 0003).
 */
export interface LoadingStateProps {
  /** What is loading, e.g. "post". Rendered as "Loading post…". */
  label?: string
  /** Fill the available space (default) or sit inline in the flow. */
  inline?: boolean
}

export function LoadingState({ label, inline = false }: LoadingStateProps) {
  return (
    <YStack
      flex={inline ? undefined : 1}
      justifyContent="center"
      alignItems="center"
      padding="$4"
    >
      <Spinner size="large" width={36} height={36} />
      <Text marginTop="$4">{label ? `Loading ${label}…` : 'Loading…'}</Text>
    </YStack>
  )
}
