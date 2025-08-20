import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import { Label, Text, YStack, Select, Adapt, Sheet } from 'tamagui'
import { CheckCircle, ChevronDown, ChevronUp } from '@tamagui/lucide-icons'

interface SelectOption {
  value: string
  label: string
}

interface EventFormSelectProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

export function EventFormSelect<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = 'Select an option',
  required = false,
  disabled = false
}: EventFormSelectProps<T>) {
  const {
    field: { value, onChange },
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
      
      <Select
        id={name}
        value={value || ''}
        onValueChange={onChange}
        disabled={disabled}
      >
        <Select.Trigger
          borderColor={error ? '$red8' : '$borderColor'}
          focusStyle={{
            borderColor: error ? '$red10' : '$blue10'
          }}
          iconAfter={ChevronDown}
        >
          <Select.Value placeholder={placeholder} />
        </Select.Trigger>

        <Adapt when="sm" platform="touch">
          <Sheet
            modal
            dismissOnSnapToBottom
            animationConfig={{
              type: 'spring',
              damping: 20,
              mass: 1.2,
              stiffness: 250,
            }}
          >
            <Sheet.Frame>
              <Sheet.ScrollView>
                <Adapt.Contents />
              </Sheet.ScrollView>
            </Sheet.Frame>
            <Sheet.Overlay
              animation="lazy"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            />
          </Sheet>
        </Adapt>

        <Select.Content zIndex={200000}>
          <Select.ScrollUpButton
            alignItems="center"
            justifyContent="center"
            position="relative"
            width="100%"
            height="$3"
          >
            <YStack zIndex={10}>
              <ChevronUp size={20} />
            </YStack>
          </Select.ScrollUpButton>

          <Select.Viewport minHeight={200}>
            <Select.Group>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  index={options.indexOf(option)}
                  value={option.value}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator marginLeft="auto">
                    <CheckCircle size={16} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Group>
          </Select.Viewport>

          <Select.ScrollDownButton
            alignItems="center"
            justifyContent="center"
            position="relative"
            width="100%"
            height="$3"
          >
            <YStack zIndex={10}>
              <ChevronDown size={20} />
            </YStack>
          </Select.ScrollDownButton>
        </Select.Content>
      </Select>
      
      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}