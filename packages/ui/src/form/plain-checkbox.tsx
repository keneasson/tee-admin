import { Checkbox, Label, Text, XStack, YStack } from 'tamagui'
import { Check as CheckIcon } from '@tamagui/lucide-icons'
import { useId } from 'react'

/**
 * The app's checkbox row for plain `checked`/`onCheckedChange` state (forms
 * bound to react-hook-form use `CheckboxWithCheck`). Brand colours in both
 * themes: a `$textTertiary` border when unticked, `$primary` fill when ticked.
 * Use this, not Tamagui's bare `Checkbox`, whose default border is too faint.
 * Cross-platform.
 */
export interface PlainCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  /** A second, quieter line under the label. */
  description?: string
  disabled?: boolean
}

export function PlainCheckbox({ checked, onCheckedChange, label, description, disabled }: PlainCheckboxProps) {
  const id = useId()
  const toggle = disabled ? undefined : () => onCheckedChange(!checked)
  return (
    <XStack gap="$3" alignItems={description ? 'flex-start' : 'center'} paddingVertical="$2" opacity={disabled ? 0.6 : 1}>
      <Checkbox
        id={id}
        size="$4"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        aria-label={description ? label : undefined}
        borderWidth={2}
        borderColor={checked ? '$primary' : '$textTertiary'}
        backgroundColor={checked ? '$primary' : 'transparent'}
      >
        <Checkbox.Indicator>
          <CheckIcon color="$primaryForeground" />
        </Checkbox.Indicator>
      </Checkbox>
      {description ? (
        <YStack flex={1} gap="$1" cursor={disabled ? undefined : 'pointer'} onPress={toggle}>
          {/* Text, not a <label>: the row itself toggles, so a label would toggle twice. */}
          <Text fontSize="$4" color="$textPrimary">{label}</Text>
          <Text fontSize="$2" color="$textSecondary">{description}</Text>
        </YStack>
      ) : (
        <Label htmlFor={id} fontSize="$3" cursor={disabled ? undefined : 'pointer'} onPress={toggle}>
          {label}
        </Label>
      )}
    </XStack>
  )
}
