import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import { Input, Label, Text, YStack } from 'tamagui'

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
  autoComplete
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

  return (
    <YStack space="$2">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>
      
      <Input
        id={name}
        value={value || ''}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        borderColor={error ? '$red8' : '$borderColor'}
        focusStyle={{
          borderColor: error ? '$red10' : '$blue10'
        }}
        disabled={disabled}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        autoComplete={autoComplete}
        keyboardType={type === 'email' ? 'email-address' : type === 'tel' ? 'phone-pad' : type === 'number' ? 'numeric' : 'default'}
      />
      
      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}