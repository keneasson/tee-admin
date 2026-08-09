import { Checkbox, Label, XStack } from 'tamagui'
import { Check as CheckIcon } from '@tamagui/lucide-icons'
import { useId } from 'react'

/**
 * A small, fully-controlled checkbox row — the post-editor's own primitive
 * (mirrors the app's checkbox styling but takes plain `checked`/`onCheckedChange`
 * instead of a react-hook-form `Control`). Cross-platform.
 */
export interface PlainCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}

export function PlainCheckbox({ checked, onCheckedChange, label }: PlainCheckboxProps) {
  const id = useId()
  return (
    <XStack gap="$3" alignItems="center" paddingVertical="$2">
      <Checkbox
        id={id}
        size="$4"
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
        borderWidth={2}
        borderColor={checked ? '$primary' : '$textTertiary'}
        backgroundColor={checked ? '$primary' : 'transparent'}
      >
        <Checkbox.Indicator>
          <CheckIcon color="$primaryForeground" />
        </Checkbox.Indicator>
      </Checkbox>
      <Label htmlFor={id} fontSize="$3" cursor="pointer" onPress={() => onCheckedChange(!checked)}>
        {label}
      </Label>
    </XStack>
  )
}
