import { useEffect, useState } from 'react'
import { YStack, XStack, Text, Button, Input } from '@my/ui'
import { Check } from '@tamagui/lucide-icons'
import { callApi } from './api'
import { matchEcclesias } from './invitee-search'

/**
 * Ecclesia autocomplete (docs/SPEAKER_INVITATIONS.md §9a), used for the new
 * invitee's home ecclesia and the owner's ecclesia selector. Case-insensitive
 * substring match over `/api/ecclesia` names:
 *  - exactly one match → shown as the suggestion; one tap or Enter accepts it
 *  - several → listed to pick from
 *  - none → "Use '{typed}' (not in our list)"
 * `value` is the ACCEPTED name ('' until one is accepted); typing clears it.
 */
export interface EcclesiaAutocompleteProps {
  value: string
  onChange: (name: string) => void
  placeholder?: string
  testID?: string
  /** Offer "Use '{typed}' (not in our list)" when nothing matches (default true). */
  allowUnlisted?: boolean
}

let cachedNames: Promise<string[]> | null = null
function loadNames(): Promise<string[]> {
  if (!cachedNames) {
    cachedNames = callApi<{ data?: Array<{ name?: string }> }>('/api/ecclesia').then((res) => {
      if (!res.ok) {
        cachedNames = null
        return []
      }
      return (res.data.data ?? []).map((e) => e.name ?? '').filter(Boolean).sort()
    })
  }
  return cachedNames
}

export function EcclesiaAutocomplete({ value, onChange, placeholder = 'Ecclesia name', testID, allowUnlisted = true }: EcclesiaAutocompleteProps) {
  const [names, setNames] = useState<string[]>([])
  const [text, setText] = useState(value)
  useEffect(() => {
    let cancelled = false
    void loadNames().then((n) => {
      if (!cancelled) setNames(n)
    })
    return () => {
      cancelled = true
    }
  }, [])
  // An accepted value set from outside (e.g. a pick) shows in the field.
  useEffect(() => {
    if (value) setText(value)
  }, [value])

  const accepted = !!value && value === text.trim()
  const match = accepted ? null : matchEcclesias(text, names)
  const accept = (name: string) => {
    setText(name)
    onChange(name)
  }

  return (
    <YStack gap="$2">
      <XStack gap="$2" alignItems="center">
        <Input
          flex={1}
          value={text}
          placeholder={placeholder}
          testID={testID}
          onChangeText={(t) => {
            setText(t)
            if (value) onChange('')
          }}
          onSubmitEditing={() => {
            if (match?.kind === 'one' || match?.kind === 'exact') accept(match.name)
          }}
        />
        {accepted ? <Check size={18} color="$green10" aria-label="Ecclesia chosen" /> : null}
      </XStack>
      {match?.kind === 'exact' || match?.kind === 'one' ? (
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <Button size="$3" variant="outlined" onPress={() => accept(match.name)} testID={testID ? `${testID}-suggestion` : undefined}>
            {match.name}
          </Button>
          <Text fontSize="$2" color="$colorSecondary">
            Tap or press Enter to use it.
          </Text>
        </XStack>
      ) : null}
      {match?.kind === 'many' ? (
        <XStack gap="$2" flexWrap="wrap">
          {match.names.map((n) => (
            <Button key={n} size="$2" variant="outlined" onPress={() => accept(n)}>
              {n}
            </Button>
          ))}
        </XStack>
      ) : null}
      {match?.kind === 'none' && allowUnlisted ? (
        <XStack>
          <Button size="$2" variant="outlined" onPress={() => accept(match.typed)} testID={testID ? `${testID}-unlisted` : undefined}>
            {`Use ‘${match.typed}’ (not in our list)`}
          </Button>
        </XStack>
      ) : null}
      {match?.kind === 'none' && !allowUnlisted ? (
        <Text fontSize="$2" color="$colorSecondary">
          No ecclesia by that name.
        </Text>
      ) : null}
    </YStack>
  )
}
