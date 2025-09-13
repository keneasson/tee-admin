import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import React, { useState, useRef, useEffect } from 'react'
import { Label, Text, YStack, XStack, Button, Popover, Card, Select, Adapt, Sheet, Checkbox, ScrollView } from 'tamagui'
import { Calendar, Clock, ChevronDown, ChevronUp, Check } from '@tamagui/lucide-icons'

interface EventDatePickerProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
  disabled?: boolean
  includeTime?: boolean
  allowHideTimes?: boolean
  onDateChange?: (date: Date) => void
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
    days.push(<YStack key={`empty-${i}`} width="$2.5" height="$2.5" />)
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
        size="$2.5"
        width="$2.5"
        height="$2.5"
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
    <YStack space="$2" minWidth="260px">
      {/* Day headers */}
      <XStack space="$1" justifyContent="space-between">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <YStack key={day} width="$2.5" alignItems="center">
            <Text fontSize="$1" color="$gray11" fontWeight="600">{day}</Text>
          </YStack>
        ))}
      </XStack>
      
      {/* Calendar grid */}
      <YStack space="$2">
        {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => (
          <XStack key={weekIndex} space="$1" justifyContent="space-between">
            {days.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => (
              <React.Fragment key={weekIndex * 7 + dayIndex}>
                {day}
              </React.Fragment>
            ))}
            {/* Fill empty slots at end of month */}
            {weekIndex === Math.ceil(days.length / 7) - 1 && 
             Array.from({ length: 7 - (days.length % 7 || 7) }, (_, emptyIndex) => (
               <YStack key={`end-empty-${emptyIndex}`} width="$2.5" height="$2.5" />
             ))
            }
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
  includeTime = false,
  allowHideTimes = false,
  onDateChange
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
  const [hidesTimes, setHidesTimes] = useState(false)
  const [shouldOpenUpward, setShouldOpenUpward] = useState(false)
  const buttonRef = useRef<any>(null)
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
    
    if (includeTime && !hidesTimes) {
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
      // Format: "Jan 15, 2025" (for date-only or hidden times)
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  }

  const handleDateSelect = (date: Date) => {
    setTempDate(date)
    if (!includeTime || hidesTimes) {
      // For date-only or hidden times, close popover and defer onChange until dismiss
      setIsOpen(false)
    } else {
      // For datetime, update the date but keep the current time
      updateDateTime(date, tempHour, tempMinute, tempPeriod)
    }
  }
  
  // Handle popover close - this is where we trigger onChange for date-only picks
  const handlePopoverClose = () => {
    if (tempDate) {
      if (!includeTime || hidesTimes) {
        // For date-only or hidden times
        const fullDayDate = new Date(tempDate)
        if (hidesTimes) {
          fullDayDate.setHours(0, 0, 0, 0) // Start of day for save-the-date events
        }
        onChange(fullDayDate)
        onDateChange?.(fullDayDate)
      } else {
        // For date+time, ensure final time update is called
        updateDateTime(tempDate, tempHour, tempMinute, tempPeriod)
      }
    }
    setIsOpen(false)
  }

  const updateDateTime = (date: Date, hour: string, minute: string, period: string) => {
    const finalDate = new Date(date)
    const hour24 = period === 'AM' 
      ? (hour === '12' ? 0 : parseInt(hour))
      : (hour === '12' ? 12 : parseInt(hour) + 12)
    
    finalDate.setHours(hour24, parseInt(minute), 0, 0)
    onChange(finalDate)
    onDateChange?.(finalDate)
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

  // Calculate if popover should open upward based on button position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonElement = buttonRef.current
      const rect = buttonElement.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      
      // If button is in bottom half of screen, open upward
      const shouldOpenUp = rect.bottom > viewportHeight * 0.6
      setShouldOpenUpward(shouldOpenUp)
    }
  }, [isOpen])

  return (
    <YStack space="$2">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>
      
      {/* Hide Times Checkbox */}
      {allowHideTimes && includeTime && (
        <XStack space="$2" alignItems="center">
          <Checkbox
            id={`${name}-hide-times`}
            size="$4"
            checked={hidesTimes}
            onCheckedChange={(checked) => {
              setHidesTimes(!!checked)
              if (checked && value) {
                // When hiding times, set to start of day
                const dateOnly = new Date(value)
                dateOnly.setHours(0, 0, 0, 0)
                onChange(dateOnly)
                onDateChange?.(dateOnly)
              }
            }}
          >
            <Checkbox.Indicator>
              <Check />
            </Checkbox.Indicator>
          </Checkbox>
          <Label htmlFor={`${name}-hide-times`} fontSize="$3">
            Hide times (save-the-date)
          </Label>
        </XStack>
      )}
      
      <Popover open={isOpen} onOpenChange={(open) => {
        if (!open) {
          handlePopoverClose()
        } else {
          setIsOpen(open)
        }
      }}>
        <Popover.Trigger asChild>
          <Button
            ref={buttonRef}
            id={name}
            size="$4"
            justifyContent="flex-start"
            borderColor={error ? '$red8' : '$borderColor'}
            backgroundColor="$background"
            color="$color"
            pressStyle={{ backgroundColor: '$gray2' }}
            disabled={disabled}
            iconAfter={includeTime && !hidesTimes ? Clock : Calendar}
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
          // Size constraints
          width="350px"
          maxHeight="500px"
          // Position based on calculation
          style={{
            transform: shouldOpenUpward 
              ? 'translateY(calc(-100% - 60px))' 
              : 'translateY(10px)'
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} maxHeight="450px">
            <YStack space="$3" padding="$2">
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
              {includeTime && !hidesTimes && (
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

              {/* Action buttons */}
              <XStack space="$2" justifyContent="flex-end" paddingTop="$3" borderTopWidth={1} borderTopColor="$borderColor">
                <Button 
                  size="$2" 
                  variant="outlined" 
                  onPress={() => {
                    // Clear the date
                    onChange(null)
                    setTempDate(new Date())
                    setIsOpen(false)
                  }}
                >
                  Clear
                </Button>
                <Button 
                  size="$2" 
                  theme="blue"
                  onPress={() => {
                    handlePopoverClose()
                  }}
                >
                  Done
                </Button>
              </XStack>
            </YStack>
          </ScrollView>
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