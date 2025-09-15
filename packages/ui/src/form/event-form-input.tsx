import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import { Input, Label, Text, YStack } from 'tamagui'
import { useCallback, useEffect, useRef } from 'react'

interface EventFormInputProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  required?: boolean
  type?: 'text' | 'email' | 'tel' | 'url' | 'number'
  multiline?: boolean
  disabled?: boolean
  autoComplete?: string
  onDebouncedChange?: (value: string) => void
  debounceMs?: number
}

export function EventFormInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required = false,
  type = 'text',
  multiline = false,
  disabled = false,
  autoComplete,
  onDebouncedChange,
  debounceMs = 2000
}: EventFormInputProps<T>) {
  const {
    field: { value, onChange, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules: {
      required: required ? `${label} is required` : false
    }
  })
  
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  
  // Debounced change handler
  const handleChange = useCallback((text: string) => {
    onChange(text) // Update form state immediately
    
    if (onDebouncedChange) {
      // Clear any existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      
      // Set new timer for debounced callback
      debounceTimerRef.current = setTimeout(() => {
        onDebouncedChange(text)
      }, debounceMs)
    }
  }, [onChange, onDebouncedChange, debounceMs])
  
  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <YStack space="$2">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>
      
      <Input
        id={name}
        value={value || ''}
        onChangeText={handleChange}
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
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        autoComplete={autoComplete}
        keyboardType={type === 'email' ? 'email-address' : type === 'tel' ? 'phone-pad' : type === 'number' ? 'numeric' : 'default'}
        paddingHorizontal="$3"
        paddingVertical="$2.5"
      />
      
      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}