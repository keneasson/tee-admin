import React, { useId } from 'react'
import type { InputProps } from 'tamagui'
import { Input, Label, YStack, Text } from 'tamagui'
import { type Control, Controller, FieldValues, Path } from 'react-hook-form'
import { FormFieldset } from './form-fieldset'

// Define valid input modes for Tamagui
type InputModeOptions = 'text' | 'none' | 'tel' | 'search' | 'url' | 'email'

type FormInputProps<T extends FieldValues> = Omit<InputProps, 'name' | 'value'> & {
  control: Control<T, object>
  label?: string
  rules?: object
  name: Path<T>
  type?: 'text' | 'email' | 'tel' | 'url' | 'search'
  onChangeText?: (text: string) => void
}

export const FormInput = <T extends FieldValues>({
  control,
  rules,
  name,
  label,
  type = 'text',
  onChangeText: customOnChangeText,
  ...inputProps
}: FormInputProps<T>) => {
  const id = useId()

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { value, onChange, ref }, fieldState: { error } }) => {
        const handleChange = (text: string) => {
          onChange(text)
          customOnChangeText?.(text)
        }

        const validInputProps = {
          ...inputProps,
          onChangeText: handleChange,
          inputMode: type as InputModeOptions
        } as InputProps

        return (
          <FormFieldset>
            <YStack>
              {label && <Label htmlFor={id}>{label}</Label>}
              <Input 
                ref={ref} 
                id={id} 
                {...validInputProps}
                value={value}
              />
              {error && (
                <Text fontSize="$3" color="$red10">
                  {error.message}
                </Text>
              )}
            </YStack>
          </FormFieldset>
        )
      }}
    />
  )
}
