import { YStack, XStack, Text, Button } from '@my/ui'

/** A labelled single-choice row of buttons (Brother / Sister, Yes / No). */
export function Choice({
  label,
  value,
  options,
  onChange,
  testID,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
  testID?: string
}) {
  return (
    <YStack gap="$1">
      <Text fontSize="$2">{label}</Text>
      <XStack gap="$2" flexWrap="wrap" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <Button
            key={o.value}
            size="$3"
            variant={value === o.value ? 'action' : 'outlined'}
            role="radio"
            aria-checked={value === o.value}
            onPress={() => onChange(o.value)}
            testID={testID ? `${testID}-${o.value}` : undefined}
          >
            {o.label}
          </Button>
        ))}
      </XStack>
    </YStack>
  )
}
