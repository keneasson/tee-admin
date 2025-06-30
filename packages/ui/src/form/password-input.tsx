'use client'

import React, { useId, useState } from 'react'
import type { InputProps } from 'tamagui'
import { Input, Label, YStack, Text, XStack, Button } from 'tamagui'
import { Eye } from '@tamagui/lucide-icons/icons/Eye'
import { EyeOff } from '@tamagui/lucide-icons/icons/EyeOff'
import { type Control, Controller, FieldValues, Path } from 'react-hook-form'
import { FormFieldset } from './form-fieldset'

type PasswordInputProps<T extends FieldValues> = Omit<InputProps, 'name' | 'type' | 'value'> & {
  control: Control<T, object>
  label?: string
  rules?: object
  name: Path<T>
  onChangeText?: (text: string) => void
}

export const PasswordInput = <T extends FieldValues>({
  control,
  rules,
  name,
  label,
  onChangeText: customOnChangeText,
  ...inputProps
}: PasswordInputProps<T>) => {
  const id = useId()
  const [showPassword, setShowPassword] = useState(false)

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

        // Clean input props to avoid conflicts
        const cleanInputProps = {
          ...inputProps,
          // Remove any potentially conflicting props
          name: undefined,
          type: undefined,
        }

        return (
          <FormFieldset>
            <YStack gap="$2">
              {label && <Label htmlFor={id}>{label}</Label>}
              <XStack position="relative" alignItems="center">
                <Input
                  ref={ref}
                  id={id}
                  flex={1}
                  paddingRight="$12"
                  {...cleanInputProps}
                  value={value || ''}
                  onChangeText={handleChange}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button
                  position="absolute"
                  right="$1"
                  size="$3"
                  chromeless
                  circular
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => setShowPassword(!showPassword)}
                  icon={showPassword ? EyeOff : Eye}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                />
              </XStack>
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