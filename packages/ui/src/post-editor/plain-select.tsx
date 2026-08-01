import { Label, Text, YStack, Select, Adapt, Sheet } from 'tamagui'
import { CheckCircle, ChevronDown, ChevronUp } from '@tamagui/lucide-icons'
import type { Option } from './options'

/**
 * A small, fully-controlled Select — the post-editor's own styling primitive
 * (the module owns its style, per design §3.1). Mirrors the Tamagui Select
 * markup used by `event-form-select` but takes plain `value` / `onValueChange`
 * props instead of a react-hook-form `Control`, so block editors stay pure
 * controlled components. Cross-platform (Select + Adapt/Sheet handle touch).
 */
export interface PlainSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  label?: string
  placeholder?: string
  id?: string
}

export function PlainSelect({
  value,
  onValueChange,
  options,
  label,
  placeholder = 'Select…',
  id,
}: PlainSelectProps) {
  return (
    <YStack gap="$2">
      {label ? (
        <Label htmlFor={id} fontSize="$3" fontWeight="600">
          {label}
        </Label>
      ) : null}

      <Select id={id} value={value} onValueChange={onValueChange}>
        <Select.Trigger borderColor="$borderColor" iconAfter={ChevronDown}>
          <Select.Value placeholder={placeholder} />
        </Select.Trigger>

        <Adapt when="sm" platform="touch">
          <Sheet modal dismissOnSnapToBottom snapPointsMode="fit">
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
              {options.map((option, index) => (
                <Select.Item key={option.value} index={index} value={option.value}>
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
    </YStack>
  )
}
