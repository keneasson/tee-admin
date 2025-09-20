import { useState } from 'react'
import { XStack, YStack, Select, Button, Text } from 'tamagui'
import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'

interface TimeSelectorProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
}

export function TimeSelector<T extends FieldValues>({
  control,
  name,
  label,
  required = false
}: TimeSelectorProps<T>) {
  const {
    field: { onChange, value },
    fieldState: { error }
  } = useController({
    name,
    control,
    defaultValue: '' as any
  })

  // Parse existing value or use defaults
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour: '12', minute: '00', period: 'PM' }
    
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
    if (match) {
      return {
        hour: match[1].padStart(2, '0'),
        minute: match[2],
        period: match[3].toUpperCase() as 'AM' | 'PM'
      }
    }
    
    // Try 24-hour format
    const match24 = timeStr.match(/(\d{1,2}):(\d{2})/)
    if (match24) {
      const hourNum = parseInt(match24[1])
      const isPM = hourNum >= 12
      const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum
      return {
        hour: hour12.toString().padStart(2, '0'),
        minute: match24[2],
        period: isPM ? 'PM' : 'AM'
      }
    }
    
    return { hour: '12', minute: '00', period: 'PM' }
  }

  const currentTime = parseTime(value)
  const [hour, setHour] = useState(currentTime.hour)
  const [minute, setMinute] = useState(currentTime.minute)
  const [period, setPeriod] = useState<'AM' | 'PM'>(currentTime.period as 'AM' | 'PM')

  const updateTime = (newHour?: string, newMinute?: string, newPeriod?: 'AM' | 'PM') => {
    const h = newHour ?? hour
    const m = newMinute ?? minute
    const p = newPeriod ?? period
    
    const formattedTime = `${h}:${m} ${p}`
    onChange(formattedTime)
  }

  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const hour = (i + 1).toString().padStart(2, '0')
    return { label: hour, value: hour }
  })

  // Generate minute options (00, 15, 30, 45)
  const minuteOptions = [
    { label: '00', value: '00' },
    { label: '15', value: '15' },
    { label: '30', value: '30' },
    { label: '45', value: '45' }
  ]

  return (
    <YStack space="$2">
      <Text fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Text>
      
      <XStack space="$2" alignItems="center">
        {/* Hour selector */}
        <Select
          value={hour}
          onValueChange={(val) => {
            setHour(val)
            updateTime(val)
          }}
          size="$3"
        >
          <Select.Trigger width={80} borderWidth={2} borderColor={error ? '$error' : '$textTertiary'}>
            <Select.Value placeholder="HH" />
          </Select.Trigger>
          
          <Select.Content>
            <Select.ScrollUpButton />
            <Select.Viewport>
              {hourOptions.map((opt) => (
                <Select.Item key={opt.value} value={opt.value} index={parseInt(opt.value)}>
                  <Select.ItemText>{opt.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>

        <Text fontSize="$5" fontWeight="600">:</Text>

        {/* Minute selector */}
        <Select
          value={minute}
          onValueChange={(val) => {
            setMinute(val)
            updateTime(undefined, val)
          }}
          size="$3"
        >
          <Select.Trigger width={80} borderWidth={2} borderColor={error ? '$error' : '$textTertiary'}>
            <Select.Value placeholder="MM" />
          </Select.Trigger>
          
          <Select.Content>
            <Select.ScrollUpButton />
            <Select.Viewport>
              {minuteOptions.map((opt) => (
                <Select.Item key={opt.value} value={opt.value} index={parseInt(opt.value)}>
                  <Select.ItemText>{opt.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>

        {/* AM/PM Toggle */}
        <XStack borderRadius="$2" borderWidth={2} borderColor={error ? '$error' : '$textTertiary'}>
          <Button
            size="$3"
            backgroundColor={period === 'AM' ? '$primary' : 'transparent'}
            color={period === 'AM' ? 'white' : '$color'}
            borderWidth={0}
            hoverStyle={{
              backgroundColor: period === 'AM' ? '$primaryHover' : '$backgroundSecondary'
            }}
            onPress={() => {
              setPeriod('AM')
              updateTime(undefined, undefined, 'AM')
            }}
            borderRadius={0}
            borderTopLeftRadius="$2"
            borderBottomLeftRadius="$2"
          >
            AM
          </Button>
          <Button
            size="$3"
            backgroundColor={period === 'PM' ? '$primary' : 'transparent'}
            color={period === 'PM' ? 'white' : '$color'}
            borderWidth={0}
            hoverStyle={{
              backgroundColor: period === 'PM' ? '$primaryHover' : '$backgroundSecondary'
            }}
            onPress={() => {
              setPeriod('PM')
              updateTime(undefined, undefined, 'PM')
            }}
            borderRadius={0}
            borderTopRightRadius="$2"
            borderBottomRightRadius="$2"
          >
            PM
          </Button>
        </XStack>
      </XStack>
      
      {error && (
        <Text fontSize="$3" color="$red10">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}