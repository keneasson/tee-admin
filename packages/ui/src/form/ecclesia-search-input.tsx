import { Plus, Search } from '@tamagui/lucide-icons'
import { useEffect, useState, useRef } from 'react'
import { Control, FieldPath, FieldValues, useController } from 'react-hook-form'
import { Button, Input, Label, Text, XStack, YStack } from 'tamagui'
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

// API function for searching ecclesiae
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
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Don't close if clicking on a button or interactive element
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        return
      }
      
      // Don't close if clicking within our container
      if (containerRef.current && !containerRef.current.contains(target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Search for ecclesiae when query changes
  useEffect(() => {
    const searchEcclesiaes = async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true)
        try {
          const results = await searchEcclesiae(searchQuery)
          setSuggestions(results)
          setShowSuggestions(true)
        } catch (error) {
          console.error('Error searching ecclesiae:', error)
          setSuggestions([])
        }
        setIsSearching(false)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
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
    setSearchQuery(suggestion.name)
    // Save minimal ecclesia key data for denormalization
    onChange({
      name: suggestion.name,
      city: suggestion.city,
      province: suggestion.province,
      country: suggestion.country
    })
    setShowSuggestions(false)
  }

  const handleEcclesiaAdded = (ecclesiaData: { name: string; city: string; province: string; country: string }) => {
    // Update the form with the new ecclesia
    setSearchQuery(ecclesiaData.name)
    onChange(ecclesiaData)
    setShowSuggestions(false)
  }

  const showAddOption =
    searchQuery.length >= 3 &&
    !suggestions.find((s) => s.name.toLowerCase() === searchQuery.toLowerCase())

  return (
    <YStack gap="$2" position="relative" ref={containerRef} overflow="visible">
      <Label htmlFor={name} fontSize="$4" fontWeight="600">
        {label}
        {required && <Text color="$red10">*</Text>}
      </Label>

      <YStack position="relative" overflow="visible">
        <Input
          ref={inputRef}
          id={name}
          value={searchQuery}
          onChangeText={handleInputChange}
          onBlur={() => {
            onBlur()
            // Only hide suggestions if not interacting with them
            setTimeout(() => {
              if (!document.activeElement?.closest('[data-suggestions-container]')) {
                setShowSuggestions(false)
              }
            }, 150)
          }}
          onFocus={() => {
            if (searchQuery.length >= 3) {
              setShowSuggestions(true)
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect={false}
          spellCheck={false}
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
          disabled={disabled}
          paddingLeft="$3"
          paddingRight="$5"
          paddingVertical="$2.5"
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
          <YStack
            position="absolute"
            top="100%"
            left={0}
            right={0}
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
            data-suggestions-container
          >
            {suggestions.map((suggestion, index) => (
              <Button
                key={suggestion.name}
                variant="ghost"
                justifyContent="flex-start"
                paddingHorizontal="$5"
                paddingVertical="$4"
                borderRadius={0}
                backgroundColor="transparent"
                hoverStyle={{
                  backgroundColor: '$blue2'
                }}
                pressStyle={{
                  backgroundColor: '$blue3'
                }}
                onPress={() => handleSelectEcclesia(suggestion)}
                borderBottomWidth={index < suggestions.length - 1 ? 1 : 0}
                borderBottomColor="$borderColor"
                minHeight="$6"
              >
                <YStack alignItems="flex-start" width="100%" gap="$3">
                  <Text fontSize="$5" fontWeight="600" color="$textPrimary">
                    {suggestion.name}
                  </Text>
                  <Text fontSize="$3" color="$textTertiary">
                    {suggestion.city}, {suggestion.province}, {suggestion.country}
                  </Text>
                </YStack>
              </Button>
            ))}

            {/* Add new ecclesia option */}
            {showAddOption && (
              <Button
                variant="ghost"
                justifyContent="flex-start"
                paddingHorizontal="$5"
                paddingVertical="$5"
                borderRadius={0}
                borderTopWidth={suggestions.length > 0 ? 2 : 0}
                borderTopColor="$primary"
                backgroundColor="$blue1"
                hoverStyle={{
                  backgroundColor: '$blue2'
                }}
                pressStyle={{
                  backgroundColor: '$blue3'
                }}
                onPress={() => setShowModal(true)}
                icon={Plus}
                iconAfter={false}
                minHeight="$6"
                gap="$3"
              >
                <Text fontSize="$4" color="$primary" fontWeight="600">
                  Add "{searchQuery}" as new ecclesia
                </Text>
              </Button>
            )}
          </YStack>
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

      {/* Add Ecclesia Modal */}
      <AddEcclesiaModal
        isOpen={showModal}
        onOpenChange={setShowModal}
        initialName={searchQuery}
        onEcclesiaAdded={handleEcclesiaAdded}
      />

      {error && (
        <Text color="$red11" fontSize="$3">
          {error.message}
        </Text>
      )}
    </YStack>
  )
}