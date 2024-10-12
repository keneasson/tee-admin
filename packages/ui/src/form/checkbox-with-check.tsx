import type { CheckboxProps } from 'tamagui'
import { Checkbox, Label, Text, XStack, YStack } from 'tamagui'
import { useId } from 'react'
import { Check as CheckIcon } from '@tamagui/lucide-icons'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { FormFieldset } from './form-fieldset'

type FormCheckboxProps<T extends FieldValues> = Omit<CheckboxProps, 'name'> & {
  control: Control<T, object>
  label?: string
  rules?: object
  name: Path<T>
}

export const CheckboxWithCheck = <T extends FieldValues>({
  control,
  rules,
  name,
  label,
  size,
  ...checkboxProps
}: FormCheckboxProps<T>) => {
  const id = useId()
  
  return (
    <>
      <Controller
        control={control}
        name={name}
        rules={rules}
        render={({ field: { value, onChange }, fieldState: { error } }) => (
          <FormFieldset>
            <YStack>
              <XStack>
                {label && (
                  <Label size={size} htmlFor={id}>
                    {label}
                  </Label>
                )}
                <Checkbox
                  id={id}
                  size={size}
                  onCheckedChange={onChange}
                  checked={value}
                  labelledBy={label}
                  value={value}
                  {...checkboxProps}
                >
                  <Checkbox.Indicator>
                    <CheckIcon />
                  </Checkbox.Indicator>
                </Checkbox>
              </XStack>
              {error && <Text>{error.message}</Text>}
            </YStack>
          </FormFieldset>
        )}
      />
    </>
  )
}
