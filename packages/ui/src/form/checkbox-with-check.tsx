'use client'

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
                <XStack gap="$3" alignItems="center" paddingVertical="$2">
                  <Checkbox
                    id={id}
                    size={size || "$4"}
                    onCheckedChange={handleCheckChange}
                    checked={value}
                    labelledBy={label}
                    value={value}
                    borderWidth={2}
                    borderColor={value ? "$primary" : "$textTertiary"}
                    backgroundColor={value ? "$primary" : "transparent"}
                    focusStyle={{
                      borderColor: "$primary",
                      borderWidth: 2
                    }}
                    pressStyle={{
                      borderColor: "$primary"
                    }}
                    {...checkboxProps}
                  >
                    <Checkbox.Indicator>
                      <CheckIcon color="$primaryForeground" />
                    </Checkbox.Indicator>
                  </Checkbox>
                  {label && (
                    <Label 
                      size={size || "$4"} 
                      htmlFor={id}
                      fontSize="$4"
                      fontWeight="500"
                      color="$textPrimary"
                      onPress={() => handleCheckChange(!value)}
                      cursor="pointer"
                    >
                      {label}
                    </Label>
                  )}
                </XStack>
                {error && <Text color="$error">{error.message}</Text>}
              </YStack>
            </FormFieldset>
          )
        }}
      />
    </>
  )
}
