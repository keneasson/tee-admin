import React, { useState, useEffect, useMemo } from 'react'
import { Control, useController, FieldPath, FieldValues, useWatch } from 'react-hook-form'
import { Select, Label, Text, YStack, Spinner } from 'tamagui'
import { ChevronDown } from '@tamagui/lucide-icons'

interface LocationSelectProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  type: 'country' | 'province'
  countryFieldName?: FieldPath<T> // Required for province selects
}

interface LocationOption {
  code: string
  name: string
}

// Cache for location data
const locationCache = {
  countries: null as LocationOption[] | null,
  provinces: new Map<string, LocationOption[]>()
}

// Fetch countries with caching
const fetchCountries = async (): Promise<LocationOption[]> => {
  if (locationCache.countries) {
    return locationCache.countries
  }

  try {
    const response = await fetch('/api/locations/countries')
    if (!response.ok) throw new Error('Failed to fetch countries')
    
    const result = await response.json()
    const data = result.success ? result.data : (Array.isArray(result) ? result : [])
    
    const countries = data.map((item: any) => ({
      code: item.code,
      name: item.name
    }))
    
    locationCache.countries = countries
    return countries
  } catch (error) {
    console.error('Error fetching countries:', error)
    return []
  }
}

// Fetch provinces with caching
const fetchProvinces = async (countryCode: string): Promise<LocationOption[]> => {
  if (!countryCode) return []
  
  if (locationCache.provinces.has(countryCode)) {
    return locationCache.provinces.get(countryCode)!
  }

  try {
    const response = await fetch(`/api/locations/${countryCode}/provinces`)
    if (!response.ok) throw new Error('Failed to fetch provinces')
    
    const result = await response.json()
    const data = result.success ? result.data : (Array.isArray(result) ? result : [])
    
    const provinces = data.map((item: any) => ({
      code: item.code,
      name: item.name
    }))
    
    locationCache.provinces.set(countryCode, provinces)
    return provinces
  } catch (error) {
    console.error('Error fetching provinces:', error)
    return []
  }
}

export function LocationSelect<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  required = false,
  disabled = false,
  type,
  countryFieldName
}: LocationSelectProps<T>) {
  const [options, setOptions] = useState<LocationOption[]>([])
  const [loading, setLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Watch the country field for province selects
  const selectedCountry = useWatch({
    control,
    name: countryFieldName as any,
    defaultValue: ''
  })

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

  // Load data when needed
  const loadOptions = async () => {
    if (loading || (hasLoaded && type === 'country')) return
    
    setLoading(true)
    try {
      let data: LocationOption[] = []
      
      if (type === 'country') {
        data = await fetchCountries()
      } else if (type === 'province') {
        // For provinces, use the selected country or default to CA
        const countryToUse = selectedCountry || 'CA'
        data = await fetchProvinces(countryToUse)
      }
      
      setOptions(data)
      setHasLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  // Load options when country changes (for provinces)
  useEffect(() => {
    if (type === 'province' && selectedCountry) {
      setHasLoaded(false) // Force reload when country changes
      loadOptions()
    }
  }, [type, selectedCountry])

  // Load countries on mount if type is country
  useEffect(() => {
    if (type === 'country' && !hasLoaded) {
      loadOptions()
    }
  }, [type])

  // Clear province value when country changes
  useEffect(() => {
    if (type === 'province' && countryFieldName) {
      // Only clear if the value is not valid for the new country
      const isValidForCountry = options.some(opt => opt.code === value)
      if (!isValidForCountry && value) {
        onChange('')
      }
    }
  }, [selectedCountry, options])

  // Get display name for current value
  const displayValue = useMemo(() => {
    if (!value) return ''
    const option = options.find(opt => opt.code === value)
    return option?.name || value
  }, [value, options])

  // Determine if select should be disabled
  const isDisabled = disabled || 
                     loading || 
                     (type === 'province' && !selectedCountry)

  return (
    <YStack gap="$2">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10"> *</Text>}
      </Label>
      
      <Select
        value={value || ''}
        onValueChange={onChange}
        disabled={isDisabled}
        onOpenChange={(open) => {
          if (open && !hasLoaded) {
            loadOptions()
          }
        }}
      >
        <Select.Trigger
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
          iconAfter={loading ? <Spinner size="small" /> : <ChevronDown size="$1" />}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
        >
          <Select.Value>
            {displayValue || placeholder || `Select ${label.toLowerCase()}`}
          </Select.Value>
        </Select.Trigger>

        <Select.Adapt when="sm" platform="touch">
          <Select.Sheet modal dismissOnSnapToBottom>
            <Select.Sheet.Frame>
              <Select.Sheet.ScrollView>
                <Select.Adapt.Contents />
              </Select.Sheet.ScrollView>
            </Select.Sheet.Frame>
            <Select.Sheet.Overlay
              animation="lazy"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            />
          </Select.Sheet>
        </Select.Adapt>

        <Select.Content zIndex={200000}>
          <Select.ScrollUpButton />
          <Select.Viewport>
            {options.length > 0 ? (
              <>
                {!required && (
                  <Select.Item value="" index={-1}>
                    <Select.ItemText>
                      <Text color="$placeholderColor">No selection</Text>
                    </Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">
                      <Text>✓</Text>
                    </Select.ItemIndicator>
                  </Select.Item>
                )}
                
                {options.map((option, index) => (
                  <Select.Item key={option.code} value={option.code} index={index}>
                    <Select.ItemText>{option.name}</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">
                      <Text>✓</Text>
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </>
            ) : loading ? (
              <Select.Item value="" index={0} disabled>
                <Select.ItemText>
                  <Text color="$placeholderColor">Loading...</Text>
                </Select.ItemText>
              </Select.Item>
            ) : (
              <Select.Item value="" index={0} disabled>
                <Select.ItemText>
                  <Text color="$placeholderColor">
                    {type === 'province' && !selectedCountry 
                      ? 'Select a country first'
                      : 'No options available'}
                  </Text>
                </Select.ItemText>
              </Select.Item>
            )}
          </Select.Viewport>
          <Select.ScrollDownButton />
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

// Convenience components for better API
export function CountrySelect<T extends FieldValues>(
  props: Omit<LocationSelectProps<T>, 'type'>
) {
  return <LocationSelect {...props} type="country" />
}

export function ProvinceSelect<T extends FieldValues>(
  props: Omit<LocationSelectProps<T>, 'type'> & { countryFieldName: FieldPath<T> }
) {
  return <LocationSelect {...props} type="province" />
}