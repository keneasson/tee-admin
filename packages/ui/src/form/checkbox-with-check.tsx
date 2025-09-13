'use client'

import type { CheckboxProps } from 'tamagui'
import { Checkbox, Label, Text, XStack, YStack } from 'tamagui'
import { useId } from 'react'
import { Check as CheckIcon } from '@tamagui/lucide-icons/icons/Check'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Controller } from 'react-hook-form'
import { FormFieldset } from './form-fieldset'

type FormCheckboxProps<T extends FieldValues> = Omit<CheckboxProps, 'name'> & {
  control: Control<T, object>
  label?: string
  rules?: object
  name: Path<T>
  onCheckChange?: (checked: boolean) => void
}

export const CheckboxWithCheck = <T extends FieldValues>({
  control,
  rules,
  name,
  label,
  size,
  onCheckChange,
  ...checkboxProps
}: FormCheckboxProps<T>) => {
  const id = useId()
  
  const handleChange = (checked: boolean) => {
    // Call the onChange handler immediately for checkboxes
    if (onCheckChange) {
      onCheckChange(checked)
    }
  }
  
  return (
    <>
      <Controller
        control={control}
        name={name}
        rules={rules}
        render={({ field: { value, onChange }, fieldState: { error } }) => {
          const handleCheckChange = (checked: boolean) => {
            onChange(checked) // Update form state
            handleChange(checked) // Trigger immediate callback
          }
          
          return (
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
                  onCheckedChange={handleCheckChange}
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
          )
        }}
      />
    </>
  )
}
