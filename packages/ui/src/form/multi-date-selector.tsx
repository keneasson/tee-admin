import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import React, { useState } from 'react'
import { Label, Text, YStack, XStack, Button, Card, ScrollView } from 'tamagui'
import { Calendar, ChevronLeft, ChevronRight, X } from '@tamagui/lucide-icons'

interface MultiDateSelectorProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  required?: boolean
  disabled?: boolean
  minDate?: Date // Minimum selectable date (default: today)
  maxDate?: Date // Maximum selectable date
  onDateChange?: (dates: string[]) => void
}

// Calendar grid component for selecting individual dates
function CalendarGrid({ 
  selectedDates,
  onDateToggle,
  currentMonth,
  currentYear,
  minDate,
  maxDate,
  disabled
}: {
  selectedDates: string[]
  onDateToggle: (dateStr: string) => void
  currentMonth: number
  currentYear: number
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
}) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const days: React.ReactNode[] = []
  
  // Empty cells for days before the first day of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<YStack key={`empty-${i}`} width="$2.5" height="$2.5" />)
  }
  
  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth, day)
    date.setHours(0, 0, 0, 0)
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format
    const isSelected = selectedDates.includes(dateStr)
    const isToday = date.getTime() === today.getTime()
    
    // Check if date is within allowed range
    const isPast = minDate && date < minDate
    const isFuture = maxDate && date > maxDate
    const isDisabled = isPast || isFuture || disabled
    
    let backgroundColor = 'transparent'
    let color = '$color'
    let opacity = 1
    
    if (isDisabled) {
      opacity = 0.3
      color = '$gray8'
    } else if (isSelected) {
      backgroundColor = '$primary'
      color = 'white'
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
        opacity={opacity}
        borderWidth={isToday && !isSelected ? 2 : 0}
        borderColor="$primary"
        onPress={() => !isDisabled && onDateToggle(dateStr)}
        pressStyle={isDisabled ? {} : { scale: 0.95 }}
        disabled={isDisabled}
      >
        {day}
      </Button>
    )
  }
  
  return (
    <XStack flexWrap="wrap" gap="$1" justifyContent="center">
      <Text fontSize="$2" color="$gray11" width="$2.5" textAlign="center">Su</Text>
      <Text fontSize="$2" color="$gray11" width="$2.5" textAlign="center">Mo</Text>
      <Text fontSize="$2" color="$gray11" width="$2.5" textAlign="center">Tu</Text>
      <Text fontSize="$2" color="$gray11" width="$2.5" textAlign="center">We</Text>
      <Text fontSize="$2" color="$gray11" width="$2.5" textAlign="center">Th</Text>
      <Text fontSize="$2" color="$gray11" width="$2.5" textAlign="center">Fr</Text>
      <Text fontSize="$2" color="$gray11" width="$2.5" textAlign="center">Sa</Text>
      {days}
    </XStack>
  )
}

export function MultiDateSelector<T extends FieldValues>({
  control,
  name,
  label,
  required = false,
  disabled = false,
  minDate = new Date(), // Default to today
  maxDate,
  onDateChange
}: MultiDateSelectorProps<T>) {
  const {
    field: { onChange, value },
    fieldState: { error }
  } = useController({
    name,
    control,
    defaultValue: [] as any
  })

  // Ensure minDate is at start of day
  const normalizedMinDate = new Date(minDate)
  normalizedMinDate.setHours(0, 0, 0, 0)

  const selectedDates: string[] = value || []
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  const handleDateToggle = (dateStr: string) => {
    let newDates: string[]
    if (selectedDates.includes(dateStr)) {
      // Remove date
      newDates = selectedDates.filter(d => d !== dateStr)
    } else {
      // Add date and sort
      newDates = [...selectedDates, dateStr].sort()
    }
    onChange(newDates)
    onDateChange?.(newDates)
  }

  const handleRemoveDate = (dateStr: string) => {
    const newDates = selectedDates.filter(d => d !== dateStr)
    onChange(newDates)
    onDateChange?.(newDates)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11)
        setCurrentYear(currentYear - 1)
      } else {
        setCurrentMonth(currentMonth - 1)
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0)
        setCurrentYear(currentYear + 1)
      } else {
        setCurrentMonth(currentMonth + 1)
      }
    }
  }

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00') // Add time to avoid timezone issues
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <YStack space="$3">
      <Label fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>

      {/* Calendar */}
      <Card padding="$4" borderWidth={2} borderColor={error ? '$error' : '$borderColor'}>
        <YStack space="$3">
          {/* Month navigation */}
          <XStack justifyContent="space-between" alignItems="center">
            <Button
              size="$3"
              icon={ChevronLeft}
              onPress={() => navigateMonth('prev')}
              variant="outlined"
            />
            <Text fontSize="$5" fontWeight="600">
              {monthNames[currentMonth]} {currentYear}
            </Text>
            <Button
              size="$3"
              icon={ChevronRight}
              onPress={() => navigateMonth('next')}
              variant="outlined"
            />
          </XStack>

          {/* Calendar grid */}
          <CalendarGrid
            selectedDates={selectedDates}
            onDateToggle={handleDateToggle}
            currentMonth={currentMonth}
            currentYear={currentYear}
            minDate={normalizedMinDate}
            maxDate={maxDate}
            disabled={disabled}
          />

          {/* Selected dates list */}
          {selectedDates.length > 0 && (
            <YStack space="$2">
              <Text fontSize="$3" fontWeight="600" color="$gray11">
                Selected Dates ({selectedDates.length}):
              </Text>
              <ScrollView maxHeight={150}>
                <XStack flexWrap="wrap" gap="$2">
                  {selectedDates.map(dateStr => (
                    <XStack
                      key={dateStr}
                      backgroundColor="$backgroundSecondary"
                      borderRadius="$2"
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                      alignItems="center"
                      space="$1"
                    >
                      <Text fontSize="$3">{formatDateDisplay(dateStr)}</Text>
                      <Button
                        size="$1"
                        icon={X}
                        onPress={() => handleRemoveDate(dateStr)}
                        variant="outlined"
                        circular
                        padding={0}
                      />
                    </XStack>
                  ))}
                </XStack>
              </ScrollView>
            </YStack>
          )}

          {selectedDates.length === 0 && (
            <Text fontSize="$3" color="$gray11" textAlign="center">
              Click on dates to select them
            </Text>
          )}
        </YStack>
      </Card>

      {error && (
        <Text fontSize="$3" color="$red10">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}