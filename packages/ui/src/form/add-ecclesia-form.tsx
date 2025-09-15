import { useState, useEffect } from 'react'
import { YStack, XStack, Text, Button, Label, Input, Select } from 'tamagui'
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

// API functions (these could be moved to a shared utils file)
const getCountries = async (): Promise<LocationOption[]> => {
  try {
    const response = await fetch('/api/locations/countries')
    
    if (!response.ok) {
      console.error('Countries API returned error:', response.status, response.statusText)
      return []
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Countries API returned non-JSON response:', contentType)
      return []
    }
    
    const data = await response.json()
    
    if (Array.isArray(data)) {
      return data
    }
    
    if (data.error) {
      console.error('Countries API error:', data.error)
      return []
    }
    
    return []
  } catch (error) {
    console.error('Error fetching countries:', error)
    return []
  }
}

const getProvinces = async (countryCode: string): Promise<LocationOption[]> => {
  try {
    const response = await fetch(`/api/locations/${countryCode}/provinces`)
    
    if (!response.ok) {
      console.error('Provinces API returned error:', response.status, response.statusText)
      return []
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Provinces API returned non-JSON response:', contentType)
      return []
    }
    
    const data = await response.json()
    
    if (Array.isArray(data)) {
      return data
    }
    
    if (data.error) {
      console.error('Provinces API error:', data.error)
      return []
    }
    
    return []
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
    country: '',
    province: '',
    city: '',
    address: ''
  })
  
  const [countries, setCountries] = useState<LocationOption[]>([])
  const [provinces, setProvinces] = useState<LocationOption[]>([])
  const [errors, setErrors] = useState<Partial<EcclesiaFormData>>({})

  // Load countries when country select is opened
  const loadCountries = async () => {
    if (countries.length === 0) {
      const countryList = await getCountries()
      setCountries(countryList)
    }
  }

  // Load provinces when province select is opened or country changes
  const loadProvinces = async () => {
    if (formData.country && provinces.length === 0) {
      const provinceList = await getProvinces(formData.country)
      setProvinces(provinceList)
    }
  }

  // Clear provinces when country changes
  useEffect(() => {
    if (formData.country) {
      setProvinces([])
      // Clear province when country changes
      setFormData(prev => ({ ...prev, province: '' }))
    }
  }, [formData.country])

  const updateField = (field: keyof EcclesiaFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

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

  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    const success = await onSave({
      name: formData.name.trim(),
      country: formData.country,
      province: formData.province,
      city: formData.city.trim(),
      address: formData.address?.trim() || undefined
    })

    if (success) {
      // Form will be closed by parent component
    }
  }

  const isValid = formData.name.trim() && formData.country && formData.province && formData.city.trim()

  return (
    <YStack gap="$4" padding="$4" minWidth={400}>
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Ecclesia Name
          <Text color="$red10"> *</Text>
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
        />
        {errors.name && (
          <Text color="$red11" fontSize="$3">
            {errors.name}
          </Text>
        )}
      </YStack>

      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Country
          <Text color="$red10"> *</Text>
        </Label>
        <Select 
          value={formData.country} 
          onValueChange={(value) => updateField('country', value)}
          onOpenChange={(open) => {
            if (open) {
              loadCountries()
            }
          }}
        >
          <Select.Trigger 
            width="100%" 
            iconAfter={ChevronDown}
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
            <Select.Value placeholder="Select country" />
          </Select.Trigger>
          <Select.Content zIndex={200000}>
            <Select.ScrollUpButton />
            <Select.Viewport>
              {countries.map((country) => (
                <Select.Item key={country.code} index={country.code} value={country.code}>
                  <Select.ItemText>{country.name}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
            <Select.ScrollDownButton />
          </Select.Content>
        </Select>
        {errors.country && (
          <Text color="$red11" fontSize="$3">
            {errors.country}
          </Text>
        )}
      </YStack>

      {formData.country && (
        <YStack gap="$2">
          <Label fontSize="$4" fontWeight="600">
            {formData.country === 'CA' ? 'Province' : 'State'}
            <Text color="$red10"> *</Text>
          </Label>
          <Select 
            value={formData.province} 
            onValueChange={(value) => updateField('province', value)}
            onOpenChange={(open) => {
              if (open) {
                loadProvinces()
              }
            }}
          >
            <Select.Trigger 
              width="100%" 
              iconAfter={ChevronDown}
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
              <Select.Value
                placeholder={formData.country === 'CA' ? 'Select province' : 'Select state'}
              />
            </Select.Trigger>
            <Select.Content zIndex={200000}>
              <Select.ScrollUpButton />
              <Select.Viewport>
                {provinces.map((province) => (
                  <Select.Item
                    key={province.code}
                    index={province.code}
                    value={province.code}
                  >
                    <Select.ItemText>{province.name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
          {errors.province && (
            <Text color="$red11" fontSize="$3">
              {errors.province}
            </Text>
          )}
        </YStack>
      )}

      {formData.province && (
        <YStack gap="$2">
          <Label fontSize="$4" fontWeight="600">
            City
            <Text color="$red10"> *</Text>
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
          />
          {errors.city && (
            <Text color="$red11" fontSize="$3">
              {errors.city}
            </Text>
          )}
        </YStack>
      )}

      {formData.city && (
        <YStack gap="$2">
          <Label fontSize="$4" fontWeight="600">
            Address (Optional)
          </Label>
          <Input
            value={formData.address}
            onChangeText={(text) => updateField('address', text)}
            placeholder="975 Cosburn Avenue"
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
          />
        </YStack>
      )}

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