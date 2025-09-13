import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import React, { useState, useRef, useEffect } from 'react'
import { Label, Text, YStack, XStack, Button, Popover, Card, Select, Adapt, Sheet, Checkbox, ScrollView } from 'tamagui'
import { Calendar, Clock, ChevronDown, ChevronUp, Check } from '@tamagui/lucide-icons'

interface EventDateRange {
  start: Date
  end: Date
  hidesTimes?: boolean
}

interface EventDateRangePickerProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
  disabled?: boolean
  allowSingleDay?: boolean // Allow selecting just one day (end = start)
  allowHideTimes?: boolean // Allow hiding times for save-the-date events
  onDateChange?: (dateRange: EventDateRange) => void
}

// Calendar grid component
function CalendarGrid({ 
  selectedStartDate,
  selectedEndDate, 
  onDateSelect, 
  currentMonth, 
  currentYear,
  allowSingleDay = false
}: {
  selectedStartDate: Date | null
  selectedEndDate: Date | null
  onDateSelect: (date: Date, isEnd?: boolean) => void
  currentMonth: number
  currentYear: number
  allowSingleDay?: boolean
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
    const isStartSelected = selectedStartDate && 
      date.getDate() === selectedStartDate.getDate() &&
      date.getMonth() === selectedStartDate.getMonth() &&
      date.getFullYear() === selectedStartDate.getFullYear()
    const isEndSelected = selectedEndDate && 
      date.getDate() === selectedEndDate.getDate() &&
      date.getMonth() === selectedEndDate.getMonth() &&
      date.getFullYear() === selectedEndDate.getFullYear()
    const isInRange = selectedStartDate && selectedEndDate && 
      date >= selectedStartDate && date <= selectedEndDate
    const isToday = 
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    
    let backgroundColor = 'transparent'
    let color = '$color'
    
    if (isStartSelected || isEndSelected) {
      backgroundColor = '$primary'
      color = '$primaryForeground'
    } else if (isInRange) {
      backgroundColor = '$accent'
      color = '$accentForeground'
    } else if (isToday) {
      backgroundColor = '$backgroundPress'
      color = '$primary'
    }
    
    days.push(
      <Button
        key={day}
        size="$2.5"
        width="$2.5"
        height="$2.5"
        backgroundColor={backgroundColor}
        color={color}
        borderWidth={isToday && !isStartSelected && !isEndSelected ? 1 : 0}
        borderColor="$primary"
        onPress={() => onDateSelect(date)}
        pressStyle={{ scale: 0.95 }}
      >
        {day}
      </Button>
    )
  }
  
  return (
    <YStack gap="$2" minWidth="260px">
      {/* Day headers */}
      <XStack gap="$1" justifyContent="space-between">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <YStack key={day} width="$2.5" alignItems="center">
            <Text fontSize="$1" color="$gray11" fontWeight="600">{day}</Text>
          </YStack>
        ))}
      </XStack>
      
      {/* Calendar grid */}
      <YStack gap="$2">
        {Array.from({ length: Math.ceil(days.length / 7) }, (_, weekIndex) => (
          <XStack key={weekIndex} gap="$1" justifyContent="space-between">
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

// Time picker component
function TimePicker({
  label,
  value,
  onChange
}: {
  label: string
  value: { hour: string; minute: string; period: string }
  onChange: (time: { hour: string; minute: string; period: string }) => void
}) {
  return (
    <YStack gap="$2">
      <Text fontSize="$3" fontWeight="500">{label}</Text>
      <XStack gap="$2" alignItems="center">
        {/* Hour */}
        <YStack flex={1}>
          <Select value={value.hour} onValueChange={(hour) => onChange({ ...value, hour })}>
            <Select.Trigger>
              <Select.Value placeholder="Hour" />
              <Select.Icon><ChevronDown /></Select.Icon>
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
              <Select.ScrollUpButton><ChevronUp size={20} /></Select.ScrollUpButton>
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
              <Select.ScrollDownButton><ChevronDown size={20} /></Select.ScrollDownButton>
            </Select.Content>
          </Select>
        </YStack>

        <Text>:</Text>

        {/* Minute */}
        <YStack flex={1}>
          <Select value={value.minute} onValueChange={(minute) => onChange({ ...value, minute })}>
            <Select.Trigger>
              <Select.Value placeholder="Min" />
              <Select.Icon><ChevronDown /></Select.Icon>
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
              <Select.ScrollUpButton><ChevronUp size={20} /></Select.ScrollUpButton>
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
              <Select.ScrollDownButton><ChevronDown size={20} /></Select.ScrollDownButton>
            </Select.Content>
          </Select>
        </YStack>

        {/* AM/PM */}
        <YStack flex={1}>
          <Select value={value.period} onValueChange={(period) => onChange({ ...value, period })}>
            <Select.Trigger>
              <Select.Value placeholder="AM/PM" />
              <Select.Icon><ChevronDown /></Select.Icon>
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
              <Select.ScrollUpButton><ChevronUp size={20} /></Select.ScrollUpButton>
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
              <Select.ScrollDownButton><ChevronDown size={20} /></Select.ScrollDownButton>
            </Select.Content>
          </Select>
        </YStack>
      </XStack>
    </YStack>
  )
}

export function EventDateRangePicker<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  disabled = false,
  allowSingleDay = true,
  allowHideTimes = false,
  onDateChange
}: EventDateRangePickerProps<T>) {
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
  const [tempStartDate, setTempStartDate] = useState<Date>(
    value?.start ? new Date(value.start) : new Date()
  )
  const [tempEndDate, setTempEndDate] = useState<Date | null>(
    value?.end ? new Date(value.end) : null
  )
  const [hidesTimes, setHidesTimes] = useState(value?.hidesTimes || false)
  const [shouldOpenUpward, setShouldOpenUpward] = useState(false)
  const buttonRef = useRef<any>(null)
  
  // Time states
  const [startTime, setStartTime] = useState(() => {
    if (value?.start && !hidesTimes) {
      const d = new Date(value.start)
      const hour = d.getHours()
      return {
        hour: hour === 0 ? '12' : hour > 12 ? (hour - 12).toString() : hour.toString(),
        minute: Math.floor(d.getMinutes() / 15) * 15 === d.getMinutes() 
          ? d.getMinutes().toString().padStart(2, '0') 
          : '00',
        period: hour < 12 ? 'AM' : 'PM'
      }
    }
    return { hour: '10', minute: '00', period: 'AM' }
  })
  
  const [endTime, setEndTime] = useState(() => {
    if (value?.end && !hidesTimes) {
      const d = new Date(value.end)
      const hour = d.getHours()
      return {
        hour: hour === 0 ? '12' : hour > 12 ? (hour - 12).toString() : hour.toString(),
        minute: Math.floor(d.getMinutes() / 15) * 15 === d.getMinutes() 
          ? d.getMinutes().toString().padStart(2, '0') 
          : '00',
        period: hour < 12 ? 'AM' : 'PM'
      }
    }
    return { hour: '12', minute: '00', period: 'PM' }
  })

  const formatDisplayDate = (dateRange: EventDateRange | null) => {
    if (!dateRange?.start) return ''
    
    const start = new Date(dateRange.start)
    const end = dateRange.end ? new Date(dateRange.end) : null
    
    if (hidesTimes || dateRange.hidesTimes) {
      // Date only format
      const startStr = start.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      
      if (!end || (allowSingleDay && start.toDateString() === end.toDateString())) {
        return startStr
      }
      
      const endStr = end.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      
      return `${startStr} - ${endStr}`
    } else {
      // Date and time format
      const formatDateTime = (date: Date) => {
        const dateStr = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
        const hour = date.getHours()
        const minute = date.getMinutes()
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
        const displayMinute = minute.toString().padStart(2, '0')
        const period = hour < 12 ? 'am' : 'pm'
        return `${dateStr} ${displayHour}:${displayMinute}${period}`
      }
      
      const startStr = formatDateTime(start)
      
      if (!end || (allowSingleDay && start.toDateString() === end.toDateString())) {
        return startStr
      }
      
      const endStr = formatDateTime(end)
      return `${startStr} - ${endStr}`
    }
  }

  const handleDateSelect = (date: Date) => {
    if (!tempStartDate || (tempStartDate && tempEndDate)) {
      // Starting new selection
      setTempStartDate(date)
      setTempEndDate(null)
    } else {
      // Selecting end date
      if (date < tempStartDate) {
        // If end date is before start, swap them
        setTempEndDate(tempStartDate)
        setTempStartDate(date)
      } else {
        setTempEndDate(date)
      }
    }
  }

  const createDateTime = (date: Date, time: { hour: string; minute: string; period: string }) => {
    const result = new Date(date)
    const hour24 = time.period === 'AM' 
      ? (time.hour === '12' ? 0 : parseInt(time.hour))
      : (time.hour === '12' ? 12 : parseInt(time.hour) + 12)
    
    result.setHours(hour24, parseInt(time.minute), 0, 0)
    return result
  }

  const handleApply = () => {
    if (!tempStartDate) return
    
    let finalStart: Date
    let finalEnd: Date
    
    if (hidesTimes) {
      // For save-the-date events, set to start of day
      finalStart = new Date(tempStartDate)
      finalStart.setHours(0, 0, 0, 0)
      
      finalEnd = new Date(tempEndDate || tempStartDate)
      finalEnd.setHours(23, 59, 59, 999) // End of day
    } else {
      // Apply times
      finalStart = createDateTime(tempStartDate, startTime)
      finalEnd = createDateTime(tempEndDate || tempStartDate, endTime)
    }
    
    const result: EventDateRange = {
      start: finalStart,
      end: finalEnd,
      hidesTimes
    }
    
    onChange(result)
    onDateChange?.(result)
    setIsOpen(false)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setTempStartDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  // Calculate popover position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonElement = buttonRef.current
      const rect = buttonElement.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      
      const shouldOpenUp = rect.bottom > viewportHeight * 0.6
      setShouldOpenUpward(shouldOpenUp)
    }
  }, [isOpen])

  return (
    <YStack gap="$2">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>
      
      {/* Hide Times Checkbox */}
      {allowHideTimes && (
        <XStack gap="$2" alignItems="center">
          <Checkbox
            id={`${name}-hide-times`}
            size="$4"
            checked={hidesTimes}
            onCheckedChange={(checked) => {
              setHidesTimes(!!checked)
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
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Popover.Trigger asChild>
          <Button
            ref={buttonRef}
            id={name}
            size="$4"
            justifyContent="flex-start"
            borderColor={error ? '$error' : '$borderColor'}
            backgroundColor="$background"
            color="$color"
            pressStyle={{ backgroundColor: '$backgroundPress' }}
            focusStyle={{ borderColor: '$primary' }}
            disabled={disabled}
            iconAfter={hidesTimes ? Calendar : Clock}
          >
            <Text>
              {value ? formatDisplayDate(value) : `Select ${label.toLowerCase()}`}
            </Text>
          </Button>
        </Popover.Trigger>

        <Popover.Content 
          borderWidth={1}
          borderColor="$borderColor"
          backgroundColor="$background"
          elevate
          width="400px"
          maxHeight="600px"
          style={{
            transform: shouldOpenUpward 
              ? 'translateY(calc(-100% - 60px))' 
              : 'translateY(10px)'
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} maxHeight="550px">
            <YStack gap="$4" p="$4">
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
                  {tempStartDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
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
                selectedStartDate={tempStartDate}
                selectedEndDate={tempEndDate}
                onDateSelect={handleDateSelect}
                currentMonth={tempStartDate.getMonth()}
                currentYear={tempStartDate.getFullYear()}
                allowSingleDay={allowSingleDay}
              />

              {/* Time pickers */}
              {!hidesTimes && (
                <YStack gap="$3">
                  <TimePicker
                    label="Start Time"
                    value={startTime}
                    onChange={setStartTime}
                  />
                  
                  {(!allowSingleDay || (tempEndDate && tempStartDate.toDateString() !== tempEndDate.toDateString())) && (
                    <TimePicker
                      label="End Time"
                      value={endTime}
                      onChange={setEndTime}
                    />
                  )}
                </YStack>
              )}

              {/* Action buttons */}
              <XStack gap="$2" justifyContent="flex-end">
                <Button size="$3" variant="outlined" onPress={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="$3"
                  backgroundColor="$primary"
                  color="$primaryForeground"
                  onPress={handleApply}
                  disabled={!tempStartDate}
                >
                  Apply
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