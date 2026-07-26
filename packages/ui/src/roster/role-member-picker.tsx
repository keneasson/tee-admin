import { useCallback, useEffect, useRef, useState } from 'react'
import { YStack, XStack, Text, Input, Spinner } from 'tamagui'
import { Button } from '../Button'
import { User, X } from '@tamagui/lucide-icons'

/**
 * RoleMemberPicker (#110, Slice B) — a typeahead over directory members for a
 * single roster role (Preside/Exhort/Organist/…).
 *
 * SHARED UI: this lives in `packages/ui` and is used by both web and (eventually)
 * native, so it MUST NOT import `next-auth` or `next/navigation`. It talks to the
 * read-only candidate endpoint with a plain same-origin `fetch` (cookies ride
 * along for the owner/admin gate); callers on other platforms can inject their own
 * `fetchCandidates`.
 *
 * Selecting a member fills the display name AND surfaces the chosen `personId` to
 * the parent (via `onSelectMember`) — but the DISPLAY VALUE is still what renders /
 * gets redacted downstream. Free-typing a name that isn't in the directory stays
 * fully supported (visiting speakers etc.); typing clears any prior member link.
 */

export interface RosterCandidate {
  personId: string
  displayName: string
  ecclesia?: string
}

export interface RoleMemberPickerProps {
  /** Current display value (the free-text/synced name shown in the field). */
  value: string
  /** Ecclesia to scope the directory search to. */
  ecclesia: string
  /** personId of a currently-linked member, if the value came from a pick. */
  selectedPersonId?: string
  placeholder?: string
  disabled?: boolean
  /** Free-text edit — clears any member link in the parent. */
  onChangeText: (text: string) => void
  /** A directory member was picked from the typeahead. */
  onSelectMember: (member: RosterCandidate) => void
  /** Unlink the member but keep the typed display value. */
  onClearMember?: () => void
  /**
   * Optional injected fetcher (native/testing). Defaults to a same-origin GET
   * against `/api/roster/resolve-candidates`.
   */
  fetchCandidates?: (q: string, ecclesia: string) => Promise<RosterCandidate[]>
}

const DEBOUNCE_MS = 250

async function defaultFetchCandidates(q: string, ecclesia: string): Promise<RosterCandidate[]> {
  const params = new URLSearchParams({ q, ecclesia })
  const res = await fetch(`/api/roster/resolve-candidates?${params.toString()}`, {
    cache: 'no-store',
  })
  if (!res.ok) return []
  const json = await res.json()
  return Array.isArray(json?.candidates) ? (json.candidates as RosterCandidate[]) : []
}

export function RoleMemberPicker({
  value,
  ecclesia,
  selectedPersonId,
  placeholder,
  disabled,
  onChangeText,
  onSelectMember,
  onClearMember,
  fetchCandidates = defaultFetchCandidates,
}: RoleMemberPickerProps) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<RosterCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blurRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against a stale in-flight request overwriting fresher results.
  const requestSeq = useRef(0)

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim()
      if (trimmed.length < 1) {
        setCandidates([])
        setLoading(false)
        return
      }
      const seq = ++requestSeq.current
      setLoading(true)
      fetchCandidates(trimmed, ecclesia)
        .then((results) => {
          if (seq !== requestSeq.current) return
          setCandidates(results)
        })
        .catch(() => {
          if (seq !== requestSeq.current) return
          setCandidates([])
        })
        .finally(() => {
          if (seq !== requestSeq.current) return
          setLoading(false)
        })
    },
    [ecclesia, fetchCandidates]
  )

  // Debounced search as the query changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!open) return
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open, runSearch])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (blurRef.current) clearTimeout(blurRef.current)
    }
  }, [])

  const handleChangeText = (text: string) => {
    setQuery(text)
    setOpen(true)
    // Any manual edit means the field no longer reflects the previously picked
    // member — the parent drops the ref link.
    onChangeText(text)
  }

  const handleSelect = (candidate: RosterCandidate) => {
    onSelectMember(candidate)
    setOpen(false)
    setCandidates([])
    setQuery('')
  }

  const handleFocus = () => {
    if (blurRef.current) clearTimeout(blurRef.current)
    setOpen(true)
    // Seed the dropdown from the current display value so a click-in searches.
    if (value.trim().length > 0 && candidates.length === 0) {
      setQuery(value)
    }
  }

  const handleBlur = () => {
    // Delay so an item press registers before the list unmounts.
    blurRef.current = setTimeout(() => setOpen(false), 150)
  }

  const showDropdown = open && !disabled && (loading || candidates.length > 0)

  return (
    <YStack position="relative" space="$1">
      <Input
        value={value}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
      />

      {selectedPersonId ? (
        <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
          <User size={12} color="$blue10" />
          <Text fontSize="$1" color="$blue11">
            Linked to directory member
          </Text>
          {onClearMember ? (
            <Button
              size="$1"
              chromeless
              icon={X}
              onPress={onClearMember}
              accessibilityLabel="Unlink directory member"
            >
              Unlink
            </Button>
          ) : null}
        </XStack>
      ) : null}

      {showDropdown ? (
        <YStack
          position="absolute"
          top="100%"
          left={0}
          right={0}
          zIndex={1000}
          marginTop="$1"
          backgroundColor="$background"
          borderWidth={1}
          borderColor="$borderColor"
          borderRadius="$3"
          elevation="$2"
          overflow="hidden"
          maxHeight={240}
        >
          {loading ? (
            <XStack padding="$3" alignItems="center" gap="$2">
              <Spinner size="small" width={14} height={14} />
              <Text fontSize="$2" color="$colorSecondary">
                Searching directory…
              </Text>
            </XStack>
          ) : candidates.length === 0 ? (
            <XStack padding="$3">
              <Text fontSize="$2" color="$colorSecondary">
                No directory match — the typed name is kept as-is.
              </Text>
            </XStack>
          ) : (
            <YStack>
              {candidates.map((c) => (
                <XStack
                  key={c.personId}
                  padding="$3"
                  gap="$2"
                  alignItems="center"
                  cursor="pointer"
                  backgroundColor="$background"
                  hoverStyle={{ backgroundColor: '$blue3' }}
                  pressStyle={{ backgroundColor: '$blue4' }}
                  // onPress fires before the input's blur timeout closes the list.
                  onPress={() => handleSelect(c)}
                >
                  <User size={14} color="$colorSecondary" />
                  <Text fontSize="$3" flex={1}>
                    {c.displayName}
                  </Text>
                  {c.ecclesia ? (
                    <Text fontSize="$1" color="$colorSecondary">
                      {c.ecclesia}
                    </Text>
                  ) : null}
                </XStack>
              ))}
            </YStack>
          )}
        </YStack>
      ) : null}
    </YStack>
  )
}
