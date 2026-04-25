import { MapPin, X } from '@tamagui/lucide-icons'
import { useRef, useState } from 'react'
import { Input, Label, Text, XStack, YStack, Spinner } from 'tamagui'
import { Button } from '../Button'
import type { PlacePrediction, ParsedAddress } from '@my/app/types/address-autocomplete'

interface AddressAutocompleteProps {
  value: string
  onChangeText: (text: string) => void
  onAddressSelect: (address: ParsedAddress) => void
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  country?: string // e.g. 'CA', 'US', 'UK' - restricts results to this country
}

// Cache predictions to avoid redundant API calls
const predictionCache = new Map<string, PlacePrediction[]>()

function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function AddressAutocomplete({
  value,
  onChangeText,
  onAddressSelect,
  label = 'Address',
  placeholder = 'Start typing an address...',
  error,
  disabled = false,
  country,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isFetchingDetails, setIsFetchingDetails] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const sessionTokenRef = useRef<string>(generateSessionToken())

  const performSearch = async (query: string) => {
    if (query.length < 3) {
      setPredictions([])
      return
    }

    const cacheKey = `${country || 'all'}:${query.toLowerCase()}`
    if (predictionCache.has(cacheKey)) {
      setPredictions(predictionCache.get(cacheKey)!)
      return
    }

    setIsSearching(true)
    try {
      const response = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: query,
          sessionToken: sessionTokenRef.current,
          country,
        }),
      })
      const data = await response.json()

      if (data.success) {
        const results = data.predictions || []
        predictionCache.set(cacheKey, results)
        setPredictions(results)
      } else {
        setPredictions([])
      }
    } catch (err) {
      console.error('Address autocomplete error:', err)
      setPredictions([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleInputChange = (text: string) => {
    onChangeText(text)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (text.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(text)
        setShowDropdown(true)
      }, 300)
    } else {
      setPredictions([])
      setShowDropdown(false)
    }
  }

  const handleFocus = () => {
    if (value.length >= 3 || predictions.length > 0) {
      setShowDropdown(true)
      if (predictions.length === 0 && value.length >= 3) {
        performSearch(value)
      }
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowDropdown(false)
      }
    }, 200)
  }

  const handleSelect = async (prediction: PlacePrediction) => {
    setShowDropdown(false)
    // Show the main text (street portion) immediately while fetching details
    onChangeText(prediction.mainText)
    setIsFetchingDetails(true)

    try {
      const params = new URLSearchParams({
        placeId: prediction.placeId,
        sessionToken: sessionTokenRef.current,
      })
      const response = await fetch(`/api/places/details?${params.toString()}`)
      const data = await response.json()

      if (data.success && data.address) {
        // Update input with just the street address, not the full formatted address
        onChangeText(data.address.streetAddress || prediction.mainText)
        onAddressSelect(data.address)
      }
    } catch (err) {
      console.error('Place details fetch error:', err)
    } finally {
      setIsFetchingDetails(false)
      // Generate new session token for next search
      sessionTokenRef.current = generateSessionToken()
    }
  }

  const handleClear = () => {
    onChangeText('')
    setPredictions([])
    setShowDropdown(false)
  }

  return (
    <YStack gap="$2" position="relative" ref={containerRef}>
      {label ? (
        <Label fontSize="$4" fontWeight="600">
          {label}
        </Label>
      ) : null}

      <YStack position="relative">
        <Input
          value={value}
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
          disabled={disabled || isFetchingDetails}
          paddingLeft="$3"
          paddingRight={value ? '$9' : '$8'}
          paddingVertical="$2.5"
        />

        <XStack position="absolute" right="$2" top="50%" transform="translateY(-50%)" gap="$1">
          {value ? (
            <Button
              size="$2"
              circular
              icon={X}
              chromeless
              onPress={handleClear}
              hoverStyle={{ backgroundColor: '$gray3' }}
            />
          ) : null}
          {isSearching || isFetchingDetails ? (
            <Spinner size="small" color="$gray11" />
          ) : (
            <MapPin size="$1" color="$gray11" style={{ pointerEvents: 'none' }} />
          )}
        </XStack>

        {showDropdown && predictions.length > 0 ? (
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
            {predictions.map((prediction, index) => (
              <Button
                key={prediction.placeId}
                chromeless
                justifyContent="flex-start"
                paddingHorizontal="$4"
                paddingVertical="$3"
                borderRadius={0}
                backgroundColor="transparent"
                hoverStyle={{ backgroundColor: '$brandLight' }}
                pressStyle={{ backgroundColor: '$brandLight' }}
                onPress={() => handleSelect(prediction)}
                borderBottomWidth={index < predictions.length - 1 ? 1 : 0}
                borderBottomColor="$borderColor"
              >
                <YStack alignItems="flex-start" width="100%" gap="$1">
                  <Text fontSize="$4" fontWeight="600" color="$textPrimary">
                    {prediction.mainText}
                  </Text>
                  <Text fontSize="$3" color="$textTertiary">
                    {prediction.secondaryText}
                  </Text>
                </YStack>
              </Button>
            ))}
          </YStack>
        ) : null}
      </YStack>

      {error ? (
        <Text color="$red11" fontSize="$3">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}
