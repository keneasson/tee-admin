import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import React, { useState } from 'react'
import { Label, Text, YStack, XStack, Button, Popover, Card, Select, Adapt, Sheet } from 'tamagui'
import { Calendar, Clock, ChevronDown, ChevronUp, Check } from '@tamagui/lucide-icons'

interface EventDatePickerProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
  disabled?: boolean
  includeTime?: boolean
}

// Calendar grid component
function CalendarGrid({ 
  selectedDate, 
  onDateSelect, 
  currentMonth, 
  currentYear 
}: {
  selectedDate: Date | null
  onDateSelect: (date: Date) => void
  currentMonth: number
  currentYear: number
}) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  const today = new Date()
  
  const days: React.ReactNode[] = []
  
  // Empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<YStack key={`empty-${i}`} width="$3" height="$3" />)
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day)
    const isSelected = selectedDate && 
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    const isToday = 
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    
    days.push(
      <Button
        key={day}
        size="$3"
        width="$3"
        height="$3"
        backgroundColor={isSelected ? '$blue10' : isToday ? '$blue2' : 'transparent'}
        color={isSelected ? 'white' : isToday ? '$blue10' : '$color'}
        borderWidth={isToday && !isSelected ? 1 : 0}
        borderColor="$blue10"
        onPress={() => onDateSelect(date)}
        pressStyle={{ scale: 0.95 }}
      >
        {day}
      </Button>
    )
  }
  
  return (
    <YStack space="$1">
      {/* Day headers */}
      <XStack space="$1" justifyContent="space-between">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <YStack key={day} width="$3" alignItems="center">
            <Text fontSize="$2" color="$gray11" fontWeight="600">{day}</Text>
          </YStack>
        ))}
      </XStack>
      
      {/* Calendar grid */}
      <YStack space="$1">
        {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => (
          <XStack key={weekIndex} space="$1" justifyContent="space-between">
            {days.slice(weekIndex * 7, weekIndex * 7 + 7)}
          </XStack>
        ))}
      </YStack>
    </YStack>
  )
}

export function EventDatePicker<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  disabled = false,
  includeTime = false
}: EventDatePickerProps<T>) {
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

  const [isOpen, setIsOpen] = useState(false)
  const [tempDate, setTempDate] = useState<Date>(value ? new Date(value) : new Date())
  const [tempHour, setTempHour] = useState<string>(() => {
    if (value && includeTime) {
      const d = new Date(value)
      const hour = d.getHours()
      return hour === 0 ? '12' : hour > 12 ? (hour - 12).toString() : hour.toString()
    }
    return '12'
  })
  const [tempMinute, setTempMinute] = useState<string>(() => {
    if (value && includeTime) {
      const d = new Date(value)
      const minutes = d.getMinutes()
      // Round to nearest 15-minute interval
      if (minutes < 8) return '00'
      if (minutes < 23) return '15'
      if (minutes < 38) return '30'
      if (minutes < 53) return '45'
      return '00'
    }
    return '00'
  })
  const [tempPeriod, setTempPeriod] = useState<string>(() => {
    if (value && includeTime) {
      const d = new Date(value)
      return d.getHours() < 12 ? 'AM' : 'PM'
    }
    return 'AM'
  })

  const formatDisplayDate = (date: Date | string | null) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    
    if (includeTime) {
      // Format: "Jan 15, 2025 2:30pm"
      const dateStr = d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      const hour = d.getHours()
      const minute = d.getMinutes()
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const displayMinute = minute.toString().padStart(2, '0')
      const period = hour < 12 ? 'am' : 'pm'
      return `${dateStr} ${displayHour}:${displayMinute}${period}`
    } else {
      // Format: "Jan 15, 2025"
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }

  const handleDateSelect = (date: Date) => {
    setTempDate(date)
    if (!includeTime) {
      // For date-only, immediately save and close
      onChange(date)
      setIsOpen(false)
    } else {
      // For datetime, update the date but keep the current time
      updateDateTime(date, tempHour, tempMinute, tempPeriod)
    }
  }

  const updateDateTime = (date: Date, hour: string, minute: string, period: string) => {
    const finalDate = new Date(date)
    const hour24 = period === 'AM' 
      ? (hour === '12' ? 0 : parseInt(hour))
      : (hour === '12' ? 12 : parseInt(hour) + 12)
    
    finalDate.setHours(hour24, parseInt(minute), 0, 0)
    onChange(finalDate)
  }

  const handleTimeChange = (type: 'hour' | 'minute' | 'period', value: string) => {
    let newHour = tempHour
    let newMinute = tempMinute
    let newPeriod = tempPeriod

    if (type === 'hour') {
      newHour = value
      setTempHour(value)
    } else if (type === 'minute') {
      newMinute = value
      setTempMinute(value)
    } else if (type === 'period') {
      newPeriod = value
      setTempPeriod(value)
    }

    // Update the datetime immediately
    updateDateTime(tempDate, newHour, newMinute, newPeriod)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setTempDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  return (
    <YStack space="$2">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <Button
            id={name}
            size="$4"
            justifyContent="flex-start"
            borderColor={error ? '$red8' : '$borderColor'}
            backgroundColor="$background"
            color="$color"
            pressStyle={{ backgroundColor: '$gray2' }}
            disabled={disabled}
            iconAfter={includeTime ? Clock : Calendar}
          >
            <Text>
              {value ? formatDisplayDate(value) : `Select ${label.toLowerCase()}`}
            </Text>
          </Button>
        </Popover.Trigger>

        <Popover.Content 
          borderWidth={1}
          borderColor="$borderColor"
          padding="$4"
          backgroundColor="$background"
          elevate
        >
          <Card padding="$3">
            <YStack space="$4">
              {/* Month navigation */}
              <XStack justifyContent="space-between" alignItems="center">
                <Button
                  size="$3"
                  variant="outlined"
                  onPress={() => navigateMonth('prev')}
                >
                  ←
                </Button>
                <Text fontSize="$5" fontWeight="600">
                  {tempDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <Button
                  size="$3"
                  variant="outlined"
                  onPress={() => navigateMonth('next')}
                >
                  →
                </Button>
              </XStack>

              {/* Calendar */}
              <CalendarGrid
                selectedDate={tempDate}
                onDateSelect={handleDateSelect}
                currentMonth={tempDate.getMonth()}
                currentYear={tempDate.getFullYear()}
              />

              {/* Time picker */}
              {includeTime && (
                <YStack space="$3">
                  <Text fontSize="$4" fontWeight="600">Time</Text>
                  <XStack space="$2" alignItems="center">
                    {/* Hour Select */}
                    <YStack flex={1}>
                      <Select value={tempHour} onValueChange={(value) => handleTimeChange('hour', value)}>
                        <Select.Trigger>
                          <Select.Value placeholder="Hour" />
                          <Select.Icon>
                            <ChevronDown />
                          </Select.Icon>
                        </Select.Trigger>

                        <Adapt when="sm" platform="touch">
                          <Sheet modal dismissOnSnapToBottom>
                            <Sheet.Frame>
                              <Sheet.ScrollView>
                                <Adapt.Contents />
                              </Sheet.ScrollView>
                            </Sheet.Frame>
                            <Sheet.Overlay />
                          </Sheet>
                        </Adapt>

                        <Select.Content zIndex={200000}>
                          <Select.ScrollUpButton>
                            <ChevronUp size={20} />
                          </Select.ScrollUpButton>

                          <Select.Viewport>
                            <Select.Group>
                              {Array.from({ length: 12 }, (_, i) => {
                                const hour = (i + 1).toString()
                                return (
                                  <Select.Item key={hour} index={i} value={hour}>
                                    <Select.ItemText>{hour}</Select.ItemText>
                                    <Select.ItemIndicator marginLeft="auto">
                                      <Check size={16} />
                                    </Select.ItemIndicator>
                                  </Select.Item>
                                )
                              })}
                            </Select.Group>
                          </Select.Viewport>

                          <Select.ScrollDownButton>
                            <ChevronDown size={20} />
                          </Select.ScrollDownButton>
                        </Select.Content>
                      </Select>
                    </YStack>

                    <Text>:</Text>

                    {/* Minute Select */}
                    <YStack flex={1}>
                      <Select value={tempMinute} onValueChange={(value) => handleTimeChange('minute', value)}>
                        <Select.Trigger>
                          <Select.Value placeholder="Min" />
                          <Select.Icon>
                            <ChevronDown />
                          </Select.Icon>
                        </Select.Trigger>

                        <Adapt when="sm" platform="touch">
                          <Sheet modal dismissOnSnapToBottom>
                            <Sheet.Frame>
                              <Sheet.ScrollView>
                                <Adapt.Contents />
                              </Sheet.ScrollView>
                            </Sheet.Frame>
                            <Sheet.Overlay />
                          </Sheet>
                        </Adapt>

                        <Select.Content zIndex={200000}>
                          <Select.ScrollUpButton>
                            <ChevronUp size={20} />
                          </Select.ScrollUpButton>

                          <Select.Viewport>
                            <Select.Group>
                              {['00', '15', '30', '45'].map((minute, index) => (
                                <Select.Item key={minute} index={index} value={minute}>
                                  <Select.ItemText>{minute}</Select.ItemText>
                                  <Select.ItemIndicator marginLeft="auto">
                                    <Check size={16} />
                                  </Select.ItemIndicator>
                                </Select.Item>
                              ))}
                            </Select.Group>
                          </Select.Viewport>

                          <Select.ScrollDownButton>
                            <ChevronDown size={20} />
                          </Select.ScrollDownButton>
                        </Select.Content>
                      </Select>
                    </YStack>

                    {/* AM/PM Select */}
                    <YStack flex={1}>
                      <Select value={tempPeriod} onValueChange={(value) => handleTimeChange('period', value)}>
                        <Select.Trigger>
                          <Select.Value placeholder="AM/PM" />
                          <Select.Icon>
                            <ChevronDown />
                          </Select.Icon>
                        </Select.Trigger>

                        <Adapt when="sm" platform="touch">
                          <Sheet modal dismissOnSnapToBottom>
                            <Sheet.Frame>
                              <Sheet.ScrollView>
                                <Adapt.Contents />
                              </Sheet.ScrollView>
                            </Sheet.Frame>
                            <Sheet.Overlay />
                          </Sheet>
                        </Adapt>

                        <Select.Content zIndex={200000}>
                          <Select.ScrollUpButton>
                            <ChevronUp size={20} />
                          </Select.ScrollUpButton>

                          <Select.Viewport>
                            <Select.Group>
                              <Select.Item index={0} value="AM">
                                <Select.ItemText>AM</Select.ItemText>
                                <Select.ItemIndicator marginLeft="auto">
                                  <Check size={16} />
                                </Select.ItemIndicator>
                              </Select.Item>
                              <Select.Item index={1} value="PM">
                                <Select.ItemText>PM</Select.ItemText>
                                <Select.ItemIndicator marginLeft="auto">
                                  <Check size={16} />
                                </Select.ItemIndicator>
                              </Select.Item>
                            </Select.Group>
                          </Select.Viewport>

                          <Select.ScrollDownButton>
                            <ChevronDown size={20} />
                          </Select.ScrollDownButton>
                        </Select.Content>
                      </Select>
                    </YStack>
                  </XStack>
                </YStack>
              )}
            </YStack>
          </Card>
        </Popover.Content>
      </Popover>
      
      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}