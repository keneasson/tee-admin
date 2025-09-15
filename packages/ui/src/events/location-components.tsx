/**
 * Small, composable components for location functionality
 * Each component has a single responsibility
 */

import { Control, FieldValues, FieldPath } from 'react-hook-form'
import { YStack, XStack, Text, Checkbox } from 'tamagui'
import { Check } from '@tamagui/lucide-icons'
import { EventFormInput } from '../form/event-form-input'
import { CountrySelect, ProvinceSelect } from '../form/location-select'
import { OptimizedTextarea } from '../form/optimized-textarea'
import { useState, useEffect } from 'react'

// ============================================
// Pure Presentational Components
// ============================================

/**
 * Simple checkbox component - no side effects
 */
interface AtTheHallCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export const AtTheHallCheckbox = ({ 
  checked, 
  onCheckedChange, 
  disabled = false 
}: AtTheHallCheckboxProps) => (
  <XStack gap="$3" alignItems="center" opacity={disabled ? 0.5 : 1} paddingVertical="$2">
    <Checkbox
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      size="$4"
      borderWidth={2}
      borderColor={checked ? "$primary" : "$borderColor"}
      backgroundColor={checked ? "$primary" : "transparent"}
      focusStyle={{
        borderColor: "$primary",
        borderWidth: 2
      }}
      pressStyle={{
        borderColor: "$primary"
      }}
    >
      <Checkbox.Indicator>
        <Check size="$1" color="$primaryForeground" />
      </Checkbox.Indicator>
    </Checkbox>
    <Text fontSize="$4" fontWeight="500" color="$textPrimary">
      At the Hall - Use Brant County's hall location
    </Text>
  </XStack>
)

/**
 * Basic location name and address fields
 */
interface LocationBasicFieldsProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  required?: boolean
}

export const LocationBasicFields = <T extends FieldValues>({ 
  control, 
  namePrefix, 
  required = false 
}: LocationBasicFieldsProps<T>) => (
  <YStack gap="$3">
    <EventFormInput
      control={control}
      name={`${namePrefix}.name` as FieldPath<T>}
      label="Venue Name"
      placeholder="e.g., Toronto East Hall"
      required={required}
    />
    <EventFormInput
      control={control}
      name={`${namePrefix}.address` as FieldPath<T>}
      label="Street Address"
      placeholder="e.g., 123 Main Street"
    />
  </YStack>
)

/**
 * City, Province, Postal Code fields
 */
interface LocationRegionFieldsProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
}

export const LocationRegionFields = <T extends FieldValues>({ 
  control, 
  namePrefix 
}: LocationRegionFieldsProps<T>) => (
  <YStack gap="$3">
    <XStack gap="$3">
      <YStack flex={1}>
        <EventFormInput
          control={control}
          name={`${namePrefix}.city` as FieldPath<T>}
          label="City"
          placeholder="e.g., Toronto"
        />
      </YStack>
      <YStack flex={1}>
        <ProvinceSelect
          control={control}
          name={`${namePrefix}.province` as FieldPath<T>}
          label="Province/State"
        />
      </YStack>
    </XStack>
    <XStack gap="$3">
      <YStack flex={1}>
        <EventFormInput
          control={control}
          name={`${namePrefix}.postalCode` as FieldPath<T>}
          label="Postal/Zip Code"
          placeholder="e.g., M1A 1A1"
        />
      </YStack>
      <YStack flex={1}>
        <CountrySelect
          control={control}
          name={`${namePrefix}.country` as FieldPath<T>}
          label="Country"
        />
      </YStack>
    </XStack>
  </YStack>
)

/**
 * Parking and directions fields
 */
interface LocationAccessFieldsProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
}

export const LocationAccessFields = <T extends FieldValues>({ 
  control, 
  namePrefix 
}: LocationAccessFieldsProps<T>) => (
  <YStack gap="$3">
    <OptimizedTextarea
      control={control}
      name={`${namePrefix}.parking` as FieldPath<T>}
      label="Parking Information"
      placeholder="Describe parking availability and any special instructions"
      numberOfLines={2}
    />
    <OptimizedTextarea
      control={control}
      name={`${namePrefix}.directions` as FieldPath<T>}
      label="Directions"
      placeholder="Provide directions or landmarks to help attendees find the venue"
      numberOfLines={2}
    />
  </YStack>
)

// ============================================
// Container Components (Handle Logic)
// ============================================

/**
 * Location fields container - manages the "At the Hall" logic
 */
interface LocationFieldsContainerProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  required?: boolean
  showAtTheHall?: boolean
  onAtTheHallChange?: (checked: boolean) => void
}

export const LocationFieldsContainer = <T extends FieldValues>({
  control,
  namePrefix,
  required = false,
  showAtTheHall = false,
  onAtTheHallChange
}: LocationFieldsContainerProps<T>) => {
  const [atTheHall, setAtTheHall] = useState(false)

  const handleAtTheHallChange = (checked: boolean) => {
    setAtTheHall(checked)
    onAtTheHallChange?.(checked)
  }

  return (
    <YStack gap="$4">
      {showAtTheHall && (
        <AtTheHallCheckbox
          checked={atTheHall}
          onCheckedChange={handleAtTheHallChange}
        />
      )}
      
      <LocationBasicFields
        control={control}
        namePrefix={namePrefix}
        required={required}
      />
      
      <LocationRegionFields
        control={control}
        namePrefix={namePrefix}
      />
      
      <LocationAccessFields
        control={control}
        namePrefix={namePrefix}
      />
    </YStack>
  )
}