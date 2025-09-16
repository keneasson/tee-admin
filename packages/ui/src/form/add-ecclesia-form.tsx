import { useState, useEffect, useMemo } from 'react'
import { YStack, XStack, Text, Button, Label, Input, Select, Spinner } from 'tamagui'
import { ChevronDown } from '@tamagui/lucide-icons'

interface LocationOption {
  code: string
  name: string
}

interface EcclesiaFormData {
  name: string
  country: string
  province: string
  city: string
  address?: string
}

interface AddEcclesiaFormProps {
  initialName?: string
  onSave: (ecclesia: EcclesiaFormData) => Promise<boolean>
  onCancel: () => void
  isLoading?: boolean
}

// Cache for location data
const locationCache = {
  countries: null as LocationOption[] | null,
  provinces: new Map<string, LocationOption[]>()
}

// API functions
const fetchCountries = async (): Promise<LocationOption[]> => {
  if (locationCache.countries) {
    return locationCache.countries
  }

  try {
    const response = await fetch('/api/locations/countries')
    if (!response.ok) throw new Error('Failed to fetch countries')
    
    const data = await response.json()
    const countries = Array.isArray(data) ? data : (data.data || [])
    locationCache.countries = countries
    return countries
  } catch (error) {
    console.error('Error fetching countries:', error)
    return []
  }
}

const fetchProvinces = async (countryCode: string): Promise<LocationOption[]> => {
  if (locationCache.provinces.has(countryCode)) {
    return locationCache.provinces.get(countryCode)!
  }

  try {
    const response = await fetch(`/api/locations/${countryCode}/provinces`)
    if (!response.ok) throw new Error('Failed to fetch provinces')
    
    const data = await response.json()
    const provinces = Array.isArray(data) ? data : (data.data || [])
    locationCache.provinces.set(countryCode, provinces)
    return provinces
  } catch (error) {
    console.error('Error fetching provinces:', error)
    return []
  }
}

export function AddEcclesiaForm({
  initialName = '',
  onSave,
  onCancel,
  isLoading = false
}: AddEcclesiaFormProps) {
  const [formData, setFormData] = useState<EcclesiaFormData>({
    name: initialName,
    country: 'CA', // Default to Canada
    province: '',
    city: '',
    address: ''
  })
  
  const [countries, setCountries] = useState<LocationOption[]>([])
  const [provinces, setProvinces] = useState<LocationOption[]>([])
  const [loadingCountries, setLoadingCountries] = useState(false)
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [errors, setErrors] = useState<Partial<EcclesiaFormData>>({})

  // Load countries on mount
  useEffect(() => {
    setLoadingCountries(true)
    fetchCountries().then(data => {
      setCountries(data)
      setLoadingCountries(false)
    })
  }, [])

  // Load provinces when country changes or on mount
  useEffect(() => {
    if (formData.country) {
      setLoadingProvinces(true)
      fetchProvinces(formData.country).then(data => {
        setProvinces(data)
        setLoadingProvinces(false)
      })
    } else {
      setProvinces([])
    }
  }, [formData.country])

  // Update field and clear error
  const updateField = (field: keyof EcclesiaFormData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      
      // Clear province when country changes
      if (field === 'country' && value !== prev.country) {
        updated.province = ''
      }
      
      return updated
    })
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Partial<EcclesiaFormData> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Ecclesia name is required'
    }
    if (!formData.country) {
      newErrors.country = 'Country is required'
    }
    if (!formData.province) {
      newErrors.province = 'Province/State is required'
    }
    if (!formData.city.trim()) {
      newErrors.city = 'City is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return

    const success = await onSave({
      name: formData.name.trim(),
      country: formData.country,
      province: formData.province,
      city: formData.city.trim(),
      address: formData.address?.trim() || undefined
    })

    if (!success) {
      setErrors({ name: 'Failed to save ecclesia. Please try again.' })
    }
  }

  // Check if form is valid
  const isValid = useMemo(() => {
    return formData.name.trim() && 
           formData.country && 
           formData.province && 
           formData.city.trim()
  }, [formData])

  // Get display names for selected values
  const selectedCountryName = useMemo(() => {
    return countries.find(c => c.code === formData.country)?.name || formData.country
  }, [countries, formData.country])

  const selectedProvinceName = useMemo(() => {
    return provinces.find(p => p.code === formData.province)?.name || formData.province
  }, [provinces, formData.province])

  return (
    <YStack gap="$4" padding="$4" minWidth={400} backgroundColor="$brandLight">
      {/* Name Field */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Ecclesia Name <Text color="$red10">*</Text>
        </Label>
        <Input
          value={formData.name}
          onChangeText={(text) => updateField('name', text)}
          placeholder="Enter ecclesia name"
          borderWidth={2}
          borderColor={errors.name ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{
            borderColor: errors.name ? '$error' : '$primary',
            borderWidth: 2
          }}
          hoverStyle={{
            borderColor: errors.name ? '$error' : '$textSecondary'
          }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
        {errors.name && <Text color="$red11" fontSize="$3">{errors.name}</Text>}
      </YStack>

      {/* Country Field */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Country <Text color="$red10">*</Text>
        </Label>
        <Select 
          value={formData.country} 
          onValueChange={(value) => updateField('country', value)}
          disabled={isLoading || loadingCountries}
        >
          <Select.Trigger 
            width="100%" 
            iconAfter={loadingCountries ? <Spinner size="small" /> : <ChevronDown size="$1" />}
            borderWidth={2}
            borderColor={errors.country ? '$error' : '$textTertiary'}
            backgroundColor="$background"
            focusStyle={{
              borderColor: errors.country ? '$error' : '$primary',
              borderWidth: 2
            }}
            hoverStyle={{
              borderColor: errors.country ? '$error' : '$textSecondary'
            }}
            paddingHorizontal="$3"
            paddingVertical="$2.5"
          >
            <Select.Value>
              {selectedCountryName || 'Select country'}
            </Select.Value>
          </Select.Trigger>
          <Select.Content zIndex={200000}>
            <Select.ScrollUpButton />
            <Select.Viewport>
              {countries.map((country, idx) => (
                <Select.Item key={country.code} index={idx} value={country.code}>
                  <Select.ItemText>{country.name}</Select.ItemText>
                  <Select.ItemIndicator marginLeft="auto">
                    <Text>✓</Text>
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
        {errors.country && <Text color="$red11" fontSize="$3">{errors.country}</Text>}
      </YStack>

      {/* Province Field */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          {formData.country === 'CA' ? 'Province' : 'State'} <Text color="$red10">*</Text>
        </Label>
        <Select 
          value={formData.province} 
          onValueChange={(value) => updateField('province', value)}
          disabled={isLoading || loadingProvinces || !formData.country}
        >
          <Select.Trigger 
            width="100%" 
            iconAfter={loadingProvinces ? <Spinner size="small" /> : <ChevronDown size="$1" />}
            borderWidth={2}
            borderColor={errors.province ? '$error' : '$textTertiary'}
            backgroundColor="$background"
            focusStyle={{
              borderColor: errors.province ? '$error' : '$primary',
              borderWidth: 2
            }}
            hoverStyle={{
              borderColor: errors.province ? '$error' : '$textSecondary'
            }}
            paddingHorizontal="$3"
            paddingVertical="$2.5"
          >
            <Select.Value>
              {selectedProvinceName || `Select ${formData.country === 'CA' ? 'province' : 'state'}`}
            </Select.Value>
          </Select.Trigger>
          <Select.Content zIndex={200000}>
            <Select.ScrollUpButton />
            <Select.Viewport>
              {provinces.length > 0 ? (
                provinces.map((province, idx) => (
                  <Select.Item key={province.code} index={idx} value={province.code}>
                    <Select.ItemText>{province.name}</Select.ItemText>
                    <Select.ItemIndicator marginLeft="auto">
                      <Text>✓</Text>
                    </Select.ItemIndicator>
                  </Select.Item>
                ))
              ) : (
                <Select.Item value="" index={0} disabled>
                  <Select.ItemText>
                    {loadingProvinces ? 'Loading...' : 'No provinces available'}
                  </Select.ItemText>
                </Select.Item>
              )}
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
        {errors.province && <Text color="$red11" fontSize="$3">{errors.province}</Text>}
      </YStack>

      {/* City Field */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          City <Text color="$red10">*</Text>
        </Label>
        <Input
          value={formData.city}
          onChangeText={(text) => updateField('city', text)}
          placeholder="Enter city name"
          borderWidth={2}
          borderColor={errors.city ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{
            borderColor: errors.city ? '$error' : '$primary',
            borderWidth: 2
          }}
          hoverStyle={{
            borderColor: errors.city ? '$error' : '$textSecondary'
          }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
        {errors.city && <Text color="$red11" fontSize="$3">{errors.city}</Text>}
      </YStack>

      {/* Address Field (Optional) */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Address (Optional)
        </Label>
        <Input
          value={formData.address}
          onChangeText={(text) => updateField('address', text)}
          placeholder="e.g., 975 Cosburn Avenue"
          borderWidth={2}
          borderColor="$textTertiary"
          backgroundColor="$background"
          focusStyle={{
            borderColor: '$primary',
            borderWidth: 2
          }}
          hoverStyle={{
            borderColor: '$textSecondary'
          }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
      </YStack>

      {/* Action Buttons */}
      <XStack gap="$3" justifyContent="flex-end" paddingTop="$2">
        <Button 
          size="$4" 
          variant="outlined" 
          borderWidth={2}
          borderColor="$textTertiary"
          onPress={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          size="$4"
          theme="blue"
          borderWidth={2}
          onPress={handleSubmit}
          disabled={!isValid || isLoading}
          opacity={!isValid || isLoading ? 0.5 : 1}
        >
          {isLoading ? 'Adding...' : 'Add Ecclesia'}
        </Button>
      </XStack>
    </YStack>
  )
}