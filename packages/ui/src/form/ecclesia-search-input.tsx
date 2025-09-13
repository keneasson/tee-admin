import { ChevronDown, Plus, Search } from '@tamagui/lucide-icons'
import { useEffect, useState } from 'react'
import { Control, FieldPath, FieldValues, useController } from 'react-hook-form'
import { Button, Card, Input, Label, Select, Text, XStack, YStack } from 'tamagui'

interface EcclesiaSuggestion {
  name: string
  country: string
  province: string
  city: string
  address?: string
}

interface LocationOption {
  code: string
  name: string
}

interface EcclesiaSearchInputProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

// API functions
const searchEcclesiae = async (query: string): Promise<EcclesiaSuggestion[]> => {
  if (query.length < 3) return []

  try {
    const response = await fetch(`/api/ecclesia/search?q=${encodeURIComponent(query)}&limit=5`)
    const data = await response.json()

    if (data.success) {
      return data.data
    }
    return []
  } catch (error) {
    console.error('Error searching ecclesiae:', error)
    return []
  }
}

const getCountries = async (): Promise<LocationOption[]> => {
  try {
    const response = await fetch('/api/locations/countries')
    
    // Check if response is OK and is JSON
    if (!response.ok) {
      console.error('Countries API returned error:', response.status, response.statusText)
      return []
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Countries API returned non-JSON response:', contentType)
      const text = await response.text()
      console.error('Response preview:', text.substring(0, 200))
      return []
    }
    
    const data = await response.json()
    
    // The API returns the array directly, not wrapped in { success, data }
    if (Array.isArray(data)) {
      return data
    }
    
    // Handle error response
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
    
    // Check if response is OK and is JSON
    if (!response.ok) {
      console.error('Provinces API returned error:', response.status, response.statusText)
      return []
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Provinces API returned non-JSON response:', contentType)
      const text = await response.text()
      console.error('Response preview:', text.substring(0, 200))
      return []
    }
    
    const data = await response.json()
    
    // The API returns the array directly, not wrapped in { success, data }
    if (Array.isArray(data)) {
      return data
    }
    
    // Handle error response
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

const saveNewEcclesia = async (data: {
  name: string
  country: string
  province: string
  city: string
  address?: string
}): Promise<boolean> => {
  try {
    const response = await fetch('/api/ecclesia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()
    return result.success
  } catch (error) {
    console.error('Error saving new ecclesia:', error)
    return false
  }
}

export function EcclesiaSearchInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Search ecclesiae...',
  required = false,
  disabled = false,
}: EcclesiaSearchInputProps<T>) {
  const {
    field: { value, onChange, onBlur },
    fieldState: { error },
  } = useController({
    name,
    control,
    rules: {
      required: required ? `${label} is required` : false,
    },
  })

  const [searchQuery, setSearchQuery] = useState<string>(value?.name || '')
  const [suggestions, setSuggestions] = useState<EcclesiaSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Progressive form state
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [countries, setCountries] = useState<LocationOption[]>([])
  const [provinces, setProvinces] = useState<LocationOption[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>('CA') // Default to Canada
  const [selectedProvince, setSelectedProvince] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [address, setAddress] = useState<string>('')

  // Load countries when location form is shown
  useEffect(() => {
    if (showLocationForm && countries.length === 0) {
      getCountries().then(setCountries)
    }
  }, [showLocationForm, countries.length])

  // Load provinces when country changes
  useEffect(() => {
    if (selectedCountry) {
      getProvinces(selectedCountry).then(setProvinces)
    }
  }, [selectedCountry])

  useEffect(() => {
    const searchEcclesiaes = async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true)
        setShowLocationForm(false) // Hide location form when searching
        try {
          const results = await searchEcclesiae(searchQuery)
          setSuggestions(results)
          setShowSuggestions(true)

          // If no results found, show location form after a short delay
          if (results.length === 0) {
            setTimeout(() => {
              setShowLocationForm(true)
              setShowSuggestions(false)
            }, 500)
          }
        } catch (error) {
          console.error('Error searching ecclesiae:', error)
          setSuggestions([])
          setShowLocationForm(true)
        }
        setIsSearching(false)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
        setShowLocationForm(false)
      }
    }

    const debounceTimer = setTimeout(searchEcclesiaes, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const handleInputChange = (text: string) => {
    setSearchQuery(text)
    // When user types, save as incomplete ecclesia (just name)
    if (text !== value?.name) {
      onChange({ name: text })
    }
  }

  const handleSelectEcclesia = (suggestion: EcclesiaSuggestion) => {
    const fullName = `${suggestion.name}, ${suggestion.city}, ${suggestion.province}, ${suggestion.country}`
    setSearchQuery(suggestion.name)
    // Save minimal ecclesia key data for denormalization
    onChange({
      name: suggestion.name,
      city: suggestion.city,
      province: suggestion.province,
      country: suggestion.country
    })
    setShowSuggestions(false)
    setShowLocationForm(false)
  }

  const handleAddNewEcclesia = async () => {
    // Require name, country, province, and city - address is optional
    if (searchQuery.trim() && selectedCountry && selectedProvince && city.trim()) {
      try {
        const success = await saveNewEcclesia({
          name: searchQuery.trim(),
          country: selectedCountry,
          province: selectedProvince,
          city: city.trim(),
          address: address.trim() || undefined,
        })

        if (success) {
          // Save minimal ecclesia key data for denormalization
          onChange({
            name: searchQuery.trim(),
            city: city.trim(),
            province: selectedProvince,
            country: selectedCountry
          })
          setShowLocationForm(false)
          setShowSuggestions(false)
          // Reset form
          setSelectedProvince('')
          setCity('')
          setAddress('')
        }
      } catch (error) {
        console.error('Error saving new ecclesia:', error)
      }
    }
  }

  const showAddOption =
    searchQuery.length >= 3 &&
    !suggestions.find((s) => s.name.toLowerCase() === searchQuery.toLowerCase()) &&
    searchQuery.trim() !== value

  return (
    <YStack space="$2" position="relative">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>

      <YStack position="relative">
        <Input
          id={name}
          value={searchQuery}
          onChangeText={handleInputChange}
          onBlur={() => {
            onBlur()
            // Delay hiding suggestions to allow selection
            setTimeout(() => setShowSuggestions(false), 150)
          }}
          onFocus={() => searchQuery.length >= 3 && setShowSuggestions(true)}
          placeholder={placeholder}
          borderColor={error ? '$red8' : '$borderColor'}
          focusStyle={{
            borderColor: error ? '$red10' : '$blue10',
          }}
          disabled={disabled}
          paddingLeft="$3"
          paddingRight="$5"
        />

        <XStack
          position="absolute"
          right="$2"
          top="50%"
          transform="translateY(-50%)"
          pointerEvents="none"
        >
          <Search size="$1" color="$gray11" />
        </XStack>

        {/* Suggestions dropdown */}
        {showSuggestions && (suggestions.length > 0 || showAddOption) && (
          <Card
            position="absolute"
            top="100%"
            left={0}
            right={0}
            zIndex={1000}
            borderWidth={1}
            borderColor="$borderColor"
            backgroundColor="$background"
            maxHeight={200}
            elevate
          >
            <YStack>
              {suggestions.map((suggestion, index) => (
                <Button
                  key={suggestion.name}
                  size="$3"
                  variant="ghost"
                  justifyContent="flex-start"
                  backgroundColor="transparent"
                  borderRadius={0}
                  borderBottomWidth={index < suggestions.length - 1 ? 1 : 0}
                  borderBottomColor="$gray5"
                  onPress={() => handleSelectEcclesia(suggestion)}
                  pressStyle={{ backgroundColor: '$gray2' }}
                >
                  <YStack alignItems="flex-start">
                    <Text fontSize="$3" fontWeight="500">
                      {suggestion.name}
                    </Text>
                    <Text fontSize="$2" color="$gray11">
                      {suggestion.city}, {suggestion.province}, {suggestion.country}
                    </Text>
                  </YStack>
                </Button>
              ))}

              {/* Add new ecclesia option */}
              {showAddOption && (
                <Button
                  size="$3"
                  variant="ghost"
                  justifyContent="flex-start"
                  backgroundColor="transparent"
                  borderRadius={0}
                  borderTopWidth={suggestions.length > 0 ? 1 : 0}
                  borderTopColor="$gray5"
                  onPress={handleAddNewEcclesia}
                  pressStyle={{ backgroundColor: '$blue2' }}
                  icon={Plus}
                >
                  <Text fontSize="$3" color="$blue11">
                    <Text>Add "{searchQuery}"</Text>
                  </Text>
                </Button>
              )}
            </YStack>
          </Card>
        )}

        {/* Loading indicator */}
        {isSearching && (
          <XStack
            position="absolute"
            right="$2"
            top="50%"
            transform="translateY(-50%)"
            pointerEvents="none"
          >
            <Text fontSize="$2" color="$gray11">
              Searching...
            </Text>
          </XStack>
        )}
      </YStack>

      {/* Progressive Location Form */}
      {showLocationForm && (
        <Card
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$borderColor"
          padding="$4"
          marginTop="$2"
          elevate
        >
          <YStack space="$3">
            <Text fontSize="$4" fontWeight="600" color="$blue11">
              <Text>{`Add "${searchQuery}" as a new ecclesia`}</Text>
            </Text>
            {/*
            {/* Country Selection */}
            <YStack space="$2">
              <Label fontSize="$3" fontWeight="500">
                Country
              </Label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <Select.Trigger width="100%" iconAfter={ChevronDown}>
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
            </YStack>

            {/* Province Selection */}
            {selectedCountry && (
              <YStack space="$2">
                <Label fontSize="$3" fontWeight="500">
                  {selectedCountry === 'CA' ? 'Province' : 'State'}
                </Label>
                <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                  <Select.Trigger width="100%" iconAfter={ChevronDown}>
                    <Select.Value
                      placeholder={selectedCountry === 'CA' ? 'Select province' : 'Select state'}
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
              </YStack>
            )}

            {/* City Input */}
            {selectedProvince ? (
              <YStack space="$2">
                <Label fontSize="$3" fontWeight="500">
                  City
                </Label>
                <Input
                  value={city}
                  onChangeText={setCity}
                  placeholder="Enter city name"
                  borderColor="$borderColor"
                  focusStyle={{ borderColor: '$blue10' }}
                />
              </YStack>
            ) : null}

            {/* Optional Address Input */}
            {city ? (
              <YStack space="$2">
                <Label fontSize="$3" fontWeight="500">
                  Address (Optional)
                </Label>
                <Input
                  value={address}
                  onChangeText={setAddress}
                  placeholder="975 Cosburn Avenue"
                  borderColor="$borderColor"
                  focusStyle={{ borderColor: '$blue10' }}
                />
              </YStack>
            ) : null}

            {/* Action Buttons */}
            <XStack space="$2" justifyContent="flex-end">
              <Button size="$3" variant="outlined" onPress={() => setShowLocationForm(false)}>
                Cancel
              </Button>
              <Button
                size="$3"
                theme="blue"
                onPress={handleAddNewEcclesia}
                disabled={!selectedCountry || !selectedProvince || !city.trim()}
                opacity={!selectedCountry || !selectedProvince || !city.trim() ? 0.5 : 1}
              >
                Add Ecclesia
              </Button>
            </XStack>
          </YStack>
        </Card>
      )}

      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}
