import { Checkbox, CheckboxProps, SizeTokens } from 'tamagui'
import { Check as CheckIcon } from '@tamagui/lucide-icons'

export function CheckboxWithCheck({
  size,
  label,
  ...checkboxProps
}: CheckboxProps & { size: SizeTokens; label: string }) {
  const id = `checkbox-${size.toString().slice(1)}`
  return (
    <Checkbox id={id} size={size} {...checkboxProps} labelledBy={label}>
      <Checkbox.Indicator>
        <CheckIcon />
      </Checkbox.Indicator>
    </Checkbox>
  )
}
