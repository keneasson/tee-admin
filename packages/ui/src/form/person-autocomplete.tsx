import { Search, X } from '@tamagui/lucide-icons'
import { useRef, useState, useMemo } from 'react'
import { Input, Label, Text, XStack, YStack, Spinner } from 'tamagui'
import { Button } from '../Button'

export interface PersonSuggestion {
  id: string
  name: string
  email: string
  emailType?: string
}

interface PersonAutocompleteProps {
  ecclesia: string
  value: string
  onChangeText: (text: string) => void
  onSelect: (person: PersonSuggestion) => void
  label?: string
  placeholder?: string
  disabled?: boolean
  size?: '$3' | '$4'
  /** When true, fetches all emails per member and shows each as a selectable option */
  showAllEmails?: boolean
}

// Cache member lists per ecclesia to avoid refetching
const memberCache = new Map<string, PersonSuggestion[]>()
const memberEmailCache = new Map<string, PersonSuggestion[]>()

export function PersonAutocomplete({
  ecclesia,
  value,
  onChangeText,
  onSelect,
  label,
  placeholder = 'Type to search members...',
  disabled = false,
  size = '$4',
  showAllEmails = false,
}: PersonAutocompleteProps) {
  const [members, setMembers] = useState<PersonSuggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const fetchMembers = async () => {
    if (!ecclesia) return

    const cacheKey = `${ecclesia.toLowerCase()}${showAllEmails ? ':emails' : ''}`
    const cache = showAllEmails ? memberEmailCache : memberCache
    if (cache.has(cacheKey)) {
      setMembers(cache.get(cacheKey)!)
      setHasFetched(true)
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        ecclesia,
        ...(showAllEmails ? { includeEmails: 'true' } : {}),
      })
      const response = await fetch(`/api/people?${params.toString()}`)
      const data = await response.json()

      if (data.success) {
        let results: PersonSuggestion[]

        if (showAllEmails) {
          // Flatten: each person with N emails produces N selectable options
          results = []
          for (const m of data.members || []) {
            const emails: Array<{ email: string; emailType: string }> = m.emails || []
            if (emails.length === 0) {
              // Fallback to primary email from the member record
              results.push({
                id: m.id,
                name: m.name,
                email: m.email,
                emailType: 'primary',
              })
            } else {
              for (const emailRecord of emails) {
                results.push({
                  id: m.id,
                  name: m.name,
                  email: emailRecord.email,
                  emailType: emailRecord.emailType,
                })
              }
            }
          }
        } else {
          results = (data.members || []).map(
            (m: { id: string; name: string; email: string }) => ({
              id: m.id,
              name: m.name,
              email: m.email,
            })
          )
        }

        cache.set(cacheKey, results)
        setMembers(results)
      }
    } catch (err) {
      console.error('Failed to fetch ecclesia members:', err)
    } finally {
      setIsLoading(false)
      setHasFetched(true)
    }
  }

  // Filter members client-side as user types
  const filtered = useMemo(() => {
    if (!value || value.length < 1) return members
    const q = value.toLowerCase()
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    )
  }, [value, members])

  const handleInputChange = (text: string) => {
    onChangeText(text)
    // Fetch on first keystroke if not yet fetched
    if (!hasFetched && !isLoading) {
      fetchMembers()
    }
    if (text.length >= 1) {
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
    }
  }

  const handleFocus = () => {
    if (!hasFetched && !isLoading) {
      fetchMembers()
    }
    if (value.length >= 1 || members.length > 0) {
      setShowDropdown(true)
    }
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowDropdown(false)
      }
    }, 200)
  }

  const handleSelect = (person: PersonSuggestion) => {
    onSelect(person)
    setShowDropdown(false)
  }

  const handleClear = () => {
    onChangeText('')
    setShowDropdown(false)
  }

  return (
    <YStack gap="$1" position="relative" flex={1} minWidth={140} ref={containerRef}>
      {label ? (
        <Label fontSize="$3" fontWeight="600">
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
          autoCapitalize="none"
          size={size}
          disabled={disabled}
          paddingRight={value ? '$8' : '$6'}
        />

        <XStack
          position="absolute"
          right="$2"
          top="50%"
          transform="translateY(-50%)"
          gap="$1"
        >
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
          {isLoading ? (
            <Spinner size="small" color="$gray11" />
          ) : (
            <Search size={14} color="$gray11" style={{ pointerEvents: 'none' }} />
          )}
        </XStack>

        {showDropdown && filtered.length > 0 ? (
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
            maxHeight={250}
            overflow="hidden"
            zIndex={99999}
            elevation={5}
            shadowColor="$shadowColor"
            shadowOffset={{ width: 0, height: 4 }}
            shadowOpacity={0.1}
            shadowRadius={8}
          >
            {filtered.map((person, index) => (
              <Button
                key={`${person.id}-${person.email}`}
                chromeless
                justifyContent="flex-start"
                paddingHorizontal="$3"
                paddingVertical="$2.5"
                borderRadius={0}
                backgroundColor="transparent"
                hoverStyle={{ backgroundColor: '$blue2' }}
                pressStyle={{ backgroundColor: '$blue3' }}
                onPress={() => handleSelect(person)}
                borderBottomWidth={index < filtered.length - 1 ? 1 : 0}
                borderBottomColor="$borderColor"
              >
                <YStack alignItems="flex-start" width="100%" gap="$0.5">
                  <Text fontSize="$3" fontWeight="600" color="$textPrimary">
                    {person.name}
                  </Text>
                  <Text fontSize="$2" color="$gray11">
                    {person.email}
                    {showAllEmails && person.emailType ? ` (${person.emailType})` : ''}
                  </Text>
                </YStack>
              </Button>
            ))}
          </YStack>
        ) : null}
      </YStack>
    </YStack>
  )
}
