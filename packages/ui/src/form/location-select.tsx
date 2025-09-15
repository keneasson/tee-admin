import React, { useState, useEffect } from 'react'
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
  const [error, setError] = useState<string | null>(null)

  // Watch the country field for province selects
  const selectedCountry = useWatch({
    control,
    name: countryFieldName as any
  })

  const {
    field: { value, onChange },
    fieldState: { error: fieldError }
  } = useController({
    name,
    control,
    rules: {
      required: required ? `${label} is required` : false
    }
  })

  // Fetch options based on type
  useEffect(() => {
    async function fetchOptions() {
      setLoading(true)
      setError(null)
      
      try {
        let url = ''
        
        if (type === 'country') {
          url = '/api/locations/countries'
        } else if (type === 'province' && selectedCountry) {
          url = `/api/locations/${selectedCountry}/provinces`
        } else if (type === 'province' && !selectedCountry) {
          // Default to Canada if no country selected
          url = '/api/locations/CA/provinces'
        } else {
          setOptions([])
          setLoading(false)
          return
        }

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch ${type} options`)
        }

        const result = await response.json()
        const data = result.success ? result.data : result
        
        if (type === 'country') {
          setOptions(data.map((country: any) => ({
            code: country.code,
            name: country.name
          })))
        } else {
          setOptions(data.map((province: any) => ({
            code: province.code,
            name: province.name
          })))
        }
      } catch (err) {
        console.error(`Error fetching ${type} options:`, err)
        setError(`Failed to load ${type} options`)
        setOptions([])
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [type, selectedCountry])

  // Clear province when country changes
  useEffect(() => {
    if (type === 'province' && countryFieldName) {
      onChange('')
    }
  }, [selectedCountry, type, countryFieldName, onChange])

  return (
    <YStack gap="$2">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>
      
      <Select
        value={value || ''}
        onValueChange={onChange}
        disabled={disabled || loading || (type === 'province' && !selectedCountry && !options.length)}
      >
        <Select.Trigger
          borderWidth={2}
          borderColor={fieldError ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{
            borderColor: fieldError ? '$error' : '$primary',
            borderWidth: 2
          }}
          hoverStyle={{
            borderColor: fieldError ? '$error' : '$textSecondary'
          }}
          iconAfter={loading ? <Spinner size="small" /> : <ChevronDown size="$1" color="$textSecondary" />}
          disabled={disabled || loading}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
        >
          <Select.Value placeholder={placeholder || `Select ${label}`}>
            {value ? (
              <Text>
                {options.find(opt => opt.code === value)?.name || value}
              </Text>
            ) : (
              <Text color="$placeholderColor">
                {placeholder || `Select ${label}`}
              </Text>
            )}
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
                  <Select.Group>
                    <Select.Item value="" index={-1}>
                      <Select.ItemText>
                        <Text color="$placeholderColor">No selection</Text>
                      </Select.ItemText>
                    </Select.Item>
                  </Select.Group>
                )}
                
                {options.map((option, index) => (
                  <Select.Group key={option.code}>
                    <Select.Item value={option.code} index={index}>
                      <Select.ItemText>{option.name}</Select.ItemText>
                      <Select.ItemIndicator marginLeft="auto">
                        <Text>✓</Text>
                      </Select.ItemIndicator>
                    </Select.Item>
                  </Select.Group>
                ))}
              </>
            ) : loading ? (
              <Select.Group>
                <Select.Item value="" index={0} disabled>
                  <Select.ItemText>
                    <Text color="$placeholderColor">Loading...</Text>
                  </Select.ItemText>
                </Select.Item>
              </Select.Group>
            ) : error ? (
              <Select.Group>
                <Select.Item value="" index={0} disabled>
                  <Select.ItemText>
                    <Text color="$red10">{error}</Text>
                  </Select.ItemText>
                </Select.Item>
              </Select.Group>
            ) : (
              <Select.Group>
                <Select.Item value="" index={0} disabled>
                  <Select.ItemText>
                    <Text color="$placeholderColor">No options available</Text>
                  </Select.ItemText>
                </Select.Item>
              </Select.Group>
            )}
          </Select.Viewport>
          <Select.ScrollDownButton />
        </Select.Content>
      </Select>
      
      {fieldError && (
        <Text color="$red11" fontSize="$3">
          {fieldError.message}
        </Text>
      )}
      
      {error && (
        <Text color="$red11" fontSize="$3">
          {error}
        </Text>
      )}
    </YStack>
  )
}

// Convenience components
interface CountrySelectProps<T extends FieldValues> extends Omit<LocationSelectProps<T>, 'type'> {}

export function CountrySelect<T extends FieldValues>(props: CountrySelectProps<T>) {
  return <LocationSelect {...props} type="country" />
}

interface ProvinceSelectProps<T extends FieldValues> extends Omit<LocationSelectProps<T>, 'type'> {
  countryFieldName: FieldPath<T>
}

export function ProvinceSelect<T extends FieldValues>(props: ProvinceSelectProps<T>) {
  return <LocationSelect {...props} type="province" />
}