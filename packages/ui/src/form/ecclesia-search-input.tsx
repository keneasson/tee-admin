import { Plus, Search, X } from '@tamagui/lucide-icons'
import { useEffect, useState, useRef, useMemo } from 'react'
import { Control, FieldPath, FieldValues, useController } from 'react-hook-form'
import { Button, Input, Label, Text, XStack, YStack, Spinner } from 'tamagui'
import { AddEcclesiaModal } from './add-ecclesia-modal'

interface EcclesiaSuggestion {
  name: string
  country: string
  province: string
  city: string
  address?: string
}

interface EcclesiaSearchInputProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

// Cache for search results to avoid redundant API calls
// Clear cache on hot reload to pick up backend changes
const searchCache = new Map<string, EcclesiaSuggestion[]>()
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Clear cache in development for testing
  searchCache.clear()
}

export function EcclesiaSearchInput<T extends FieldValues>({
  control,
  name,
  label,
  placeholder = 'Type ecclesia name...',
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

  console.log('EcclesiaSearchInput', { name, value })

  // Initialize searchQuery from value on mount
  const [searchQuery, setSearchQuery] = useState<string>(() => value?.name || '')
  const [suggestions, setSuggestions] = useState<EcclesiaSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  // Update searchQuery when value changes externally
  useEffect(() => {
    if (value?.name && value.name !== searchQuery) {
      setSearchQuery(value.name)
    }
  }, [value?.name, searchQuery])

  // Perform search with caching
  const performSearch = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([])
      return
    }

    // Check cache first
    const cacheKey = query.toLowerCase()
    if (searchCache.has(cacheKey)) {
      setSuggestions(searchCache.get(cacheKey)!)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch(`/api/ecclesia/search?q=${encodeURIComponent(query)}&limit=5`)
      const data = await response.json()

      if (data.success) {
        const results = data.data || []
        console.log('search for', query, 'results', results)
        searchCache.set(cacheKey, results)
        setSuggestions(results)
      } else {
        setSuggestions([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }

  // Handle input change with debounced search
  const handleInputChange = (text: string) => {
    setSearchQuery(text)

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Update form value immediately with partial data
    if (text !== value?.name) {
      onChange({ name: text })
    }

    // Debounce search
    if (text.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(text)
        setShowDropdown(true)
      }, 300)
    } else {
      setSuggestions([])
      setShowDropdown(false)
    }
  }

  // Handle focus - show dropdown if we have a valid query or existing suggestions
  const handleFocus = () => {
    if (searchQuery.length >= 3 || suggestions.length > 0) {
      setShowDropdown(true)
      // Trigger search if we don't have suggestions
      if (suggestions.length === 0 && searchQuery.length >= 3) {
        performSearch(searchQuery)
      }
    }
  }

  // Handle blur - hide dropdown after a delay
  const handleBlur = () => {
    onBlur()
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowDropdown(false)
      }
    }, 200)
  }

  // Handle selecting an ecclesia
  const handleSelectEcclesia = (suggestion: EcclesiaSuggestion) => {
    setSearchQuery(suggestion.name)
    onChange({
      name: suggestion.name,
      city: suggestion.city,
      province: suggestion.province,
      country: suggestion.country,
    })
    setShowDropdown(false)
  }

  // Handle adding a new ecclesia
  const handleEcclesiaAdded = (ecclesiaData: {
    name: string
    city: string
    province: string
    country: string
  }) => {
    setSearchQuery(ecclesiaData.name)
    onChange(ecclesiaData)
    setShowDropdown(false)
    // Clear cache for this ecclesia name
    searchCache.delete(ecclesiaData.name.toLowerCase())
  }

  // Handle clearing the input
  const handleClear = () => {
    setSearchQuery('')
    onChange(null)
    setSuggestions([])
    setShowDropdown(false)
  }

  // Check if we should show the add option
  const showAddOption = useMemo(() => {
    return (
      searchQuery.length >= 3 &&
      !suggestions.find((s) => s.name.toLowerCase() === searchQuery.toLowerCase())
    )
  }, [searchQuery, suggestions])

  return (
    <YStack gap="$2" position="relative" ref={containerRef}>
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10"> *</Text>}
      </Label>

      <YStack position="relative">
        <Input
          id={name}
          value={searchQuery}
          onChangeText={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
          borderWidth={2}
          borderColor={error ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{
            borderColor: error ? '$error' : '$primary',
            borderWidth: 2,
          }}
          hoverStyle={{
            borderColor: error ? '$error' : '$textSecondary',
          }}
          disabled={disabled}
          paddingLeft="$3"
          paddingRight={searchQuery ? '$9' : '$8'}
          paddingVertical="$2.5"
        />

        {/* Icons */}
        <XStack position="absolute" right="$2" top="50%" transform="translateY(-50%)" gap="$1">
          {searchQuery && (
            <Button
              size="$2"
              circular
              icon={X}
              variant="ghost"
              onPress={handleClear}
              hoverStyle={{ backgroundColor: '$gray3' }}
            />
          )}
          {isSearching ? (
            <Spinner size="small" color="$gray11" />
          ) : (
            <Search size="$1" color="$gray11" style={{ pointerEvents: 'none' }} />
          )}
        </XStack>

        {/* Dropdown */}
        {showDropdown && (suggestions.length > 0 || showAddOption) && (
          <YStack
            position="absolute"
            top="100%"
            left={0}
            right={0}
            marginTop="$1"
            backgroundColor="$background"
            borderWidth={2}
            borderColor="$textTertiary"
            borderRadius="$3"
            maxHeight={300}
            overflow="hidden"
            zIndex={99999}
            elevation={5}
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.1}
            shadowRadius={8}
          >
            {/* Existing ecclesias */}
            {suggestions.map((suggestion, index) => (
              <Button
                key={`${suggestion.name}-${suggestion.city}`}
                variant="ghost"
                justifyContent="flex-start"
                paddingHorizontal="$4"
                paddingVertical="$3"
                borderRadius={0}
                backgroundColor="transparent"
                hoverStyle={{ backgroundColor: '$brandLight' }}
                pressStyle={{ backgroundColor: '$brandLight' }}
                onPress={() => handleSelectEcclesia(suggestion)}
                borderBottomWidth={index < suggestions.length - 1 || showAddOption ? 1 : 0}
                borderBottomColor="$borderColor"
              >
                <YStack alignItems="flex-start" width="100%" gap="$1">
                  <Text fontSize="$4" fontWeight="600" color="$textPrimary">
                    {suggestion.name}
                  </Text>
                  <Text fontSize="$3" color="$textTertiary">
                    {suggestion.city}, {suggestion.province}, {suggestion.country}
                  </Text>
                </YStack>
              </Button>
            ))}

            {/* Add new option */}
            {showAddOption && (
              <Button
                variant="ghost"
                justifyContent="flex-start"
                paddingHorizontal="$4"
                paddingVertical="$3"
                borderRadius={0}
                backgroundColor="$blue1"
                hoverStyle={{ backgroundColor: '$blue2' }}
                pressStyle={{ backgroundColor: '$blue3' }}
                onPress={() => {
                  setShowDropdown(false)
                  setShowModal(true)
                }}
                icon={Plus}
                gap="$2"
              >
                <Text fontSize="$4" color="$primary" fontWeight="600">
                  Add "{searchQuery}" as new ecclesia
                </Text>
              </Button>
            )}
          </YStack>
        )}
      </YStack>

      {/* Error message */}
      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}

      {/* Add Ecclesia Modal */}
      <AddEcclesiaModal
        isOpen={showModal}
        onOpenChange={setShowModal}
        initialName={searchQuery}
        onEcclesiaAdded={handleEcclesiaAdded}
      />
    </YStack>
  )
}
