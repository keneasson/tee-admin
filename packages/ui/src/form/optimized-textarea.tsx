import React, { useCallback } from 'react'
import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import { TextArea, Label, Text, YStack } from 'tamagui'


interface OptimizedTextareaProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  rows?: number
  maxLength?: number
  autoComplete?: string
}

export function OptimizedTextarea<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required = false,
  disabled = false,
  rows = 4,
  maxLength,
  autoComplete
}: OptimizedTextareaProps<T>) {
  const {
    field: { value, onChange, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules: {
      required: required ? `${label} is required` : false,
      maxLength: maxLength ? {
        value: maxLength,
        message: `${label} cannot exceed ${maxLength} characters`
      } : undefined
    }
  })

  // Direct change handler for immediate responsiveness
  const handleChangeText = useCallback((text: string) => {
    onChange(text)
  }, [onChange])

  // Character count for user feedback
  const characterCount = value?.length || 0
  const isNearLimit = maxLength && characterCount > maxLength * 0.8
  const isOverLimit = maxLength && characterCount > maxLength

  return (
    <YStack gap="$2">
      <YStack>
        <Label htmlFor={name} fontSize="$4" fontWeight="600">
          {label}
          {required && <Text color="$red10"> *</Text>}
        </Label>
        {maxLength && (
          <Text 
            fontSize="$2" 
            color={isOverLimit ? '$red10' : isNearLimit ? '$orange10' : '$gray10'}
            alignSelf="flex-end"
          >
            {characterCount}/{maxLength}
          </Text>
        )}
      </YStack>
      
      <TextArea
        id={name}
        value={value || ''}
        onChangeText={handleChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        borderWidth={2}
        borderColor={error ? '$error' : '$textTertiary'}
        backgroundColor="$background"
        focusStyle={{
          borderColor: error ? '$error' : '$primary',
          borderWidth: 2
        }}
        hoverStyle={{
          borderColor: error ? '$error' : '$textSecondary'
        }}
        disabled={disabled}
        rows={rows}
        autoComplete={autoComplete}
        maxLength={maxLength}
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        // Performance optimizations
        textAlignVertical="top"
        multiline
        // Prevent text node issues in React Native
        suppressHydrationWarning
      />
      
      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}