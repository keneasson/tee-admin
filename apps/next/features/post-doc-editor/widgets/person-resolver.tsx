'use client'

/**
 * PersonResolver — the PROGRESSIVE Speaker/Person widget for the document-canvas
 * editor (Consolidated CMS 2R-2). The person analogue of {@link LocationResolver}:
 * NOT a form — a single resolving input over OUR member directory.
 *
 *   1. Pick "who is this" (role) — drives the published block header.
 *   2. Type a name → autocomplete against `/api/people?search=` → pick a match →
 *      it becomes a compact person chip (the 80% path). No internal match → "Add
 *      '<name>' as typed" captures a visiting speaker / off-directory person.
 *   3. Each person's honorific / sub-role / bio / contact hide behind a per-person
 *      "Details" expander (progressive disclosure), so the common case stays a
 *      name and a click.
 *
 * A person block is a SNAPSHOT (see person-resolve.ts) — the directory id is not
 * stored; picking copies the display fields. Web-only (fetch); the pure mapping
 * lives in {@link person-resolve.ts} (unit-tested there).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { YStack, XStack, Text, Button, Input, Spinner, Separator, TextArea } from '@my/ui'
import { Users, Search, UserPlus, X, ChevronDown, ChevronRight } from '@tamagui/lucide-icons'
import type { BlockPerson, PersonBlock } from '@my/app/types/post'
import { formatPersonName, personMetaLine } from '@my/ui/src/post-view/post-view-format'
import {
  type PersonSuggestion,
  PERSON_ROLES,
  addPerson,
  patchPerson,
  plainNameToPerson,
  removePerson,
  suggestionToPerson,
} from '@my/app/features/post-editor/resolvers/person-resolve'

export interface PersonResolverProps {
  block: PersonBlock
  onChange: (next: PersonBlock) => void
}

async function searchPeople(q: string): Promise<PersonSuggestion[]> {
  try {
    const res = await fetch(`/api/people?search=${encodeURIComponent(q)}`)
    const data = await res.json()
    if (!data?.success || !Array.isArray(data.members)) return []
    return (data.members as Array<{ id: string; name: string; ecclesia?: string }>)
      .slice(0, 6)
      .map((m) => ({ id: m.id, name: m.name, ecclesia: m.ecclesia }))
  } catch {
    return []
  }
}

export function PersonResolver({ block, onChange }: PersonResolverProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<PersonSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([])
      return
    }
    setSearching(true)
    setSuggestions(await searchPeople(q.trim()))
    setSearching(false)
  }, [])

  const onQueryChange = useCallback(
    (text: string) => {
      setQuery(text)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (text.trim().length < 2) {
        setSuggestions([])
        return
      }
      debounceRef.current = setTimeout(() => void runSearch(text), 300)
    },
    [runSearch]
  )

  const commitPerson = useCallback(
    (person: BlockPerson) => {
      onChange(addPerson(block, person))
      setQuery('')
      setSuggestions([])
    },
    [block, onChange]
  )

  const noMatch = query.trim().length >= 2 && !searching && suggestions.length === 0

  return (
    <YStack gap="$3">
      {/* WHO — role drives the published block header. */}
      <YStack gap="$1">
        <Text fontSize="$2" fontWeight="600" color="$color11">
          Who is this?
        </Text>
        <XStack gap="$1.5" flexWrap="wrap">
          {PERSON_ROLES.map((r) => {
            const on = block.role === r.value
            return (
              <Button
                key={r.value}
                size="$2"
                theme={on ? 'blue' : undefined}
                backgroundColor={on ? '$blue5' : undefined}
                hoverStyle={on ? { backgroundColor: '$blue6' } : undefined}
                onPress={() => onChange({ ...block, role: r.value })}
              >
                {r.label}
              </Button>
            )
          })}
        </XStack>
      </YStack>

      {/* Already-added people. */}
      {block.people.length > 0 ? (
        <YStack gap="$2">
          {block.people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              open={openDetailsId === person.id}
              onToggleDetails={() =>
                setOpenDetailsId((id) => (id === person.id ? null : person.id))
              }
              onPatch={(patch) => onChange(patchPerson(block, person.id, patch))}
              onRemove={() => {
                onChange(removePerson(block, person.id))
                if (openDetailsId === person.id) setOpenDetailsId(null)
              }}
            />
          ))}
        </YStack>
      ) : null}

      <Separator />

      {/* Resolving add-input. */}
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2">
          <Search size={16} color="$color10" />
          <Input
            flex={1}
            value={query}
            onChangeText={onQueryChange}
            placeholder={
              block.people.length > 0 ? 'Add another person…' : 'Search our directory, or type a name…'
            }
            autoComplete="off"
            autoCorrect={false}
            spellCheck={false}
          />
          {searching ? <Spinner size="small" /> : null}
        </XStack>

        {suggestions.length > 0 ? (
          <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$3" overflow="hidden">
            {suggestions.map((s, i) => (
              <Button
                key={s.id}
                chromeless
                justifyContent="flex-start"
                borderRadius={0}
                borderBottomWidth={i < suggestions.length - 1 ? 1 : 0}
                borderBottomColor="$borderColor"
                hoverStyle={{ backgroundColor: '$blue2' }}
                onPress={() => commitPerson(suggestionToPerson(s))}
              >
                <YStack alignItems="flex-start" width="100%">
                  <Text fontSize="$3" fontWeight="600">
                    {s.name}
                  </Text>
                  {s.ecclesia ? (
                    <Text fontSize="$2" color="$color10">
                      {s.ecclesia}
                    </Text>
                  ) : null}
                </YStack>
              </Button>
            ))}
          </YStack>
        ) : null}

        {noMatch ? (
          <Button
            size="$3"
            variant="outlined"
            icon={UserPlus}
            justifyContent="flex-start"
            onPress={() => commitPerson(plainNameToPerson(query))}
          >
            {`Add "${query.trim()}" as typed (not in our directory)`}
          </Button>
        ) : null}
      </YStack>
    </YStack>
  )
}

// ---- One added person: chip + progressive details ---------------------------

const TITLES: Array<{ label: string; value: string | undefined }> = [
  { label: 'None', value: undefined },
  { label: 'Brother', value: 'Brother' },
  { label: 'Sister', value: 'Sister' },
]

function PersonRow({
  person,
  open,
  onToggleDetails,
  onPatch,
  onRemove,
}: {
  person: BlockPerson
  open: boolean
  onToggleDetails: () => void
  onPatch: (patch: Partial<BlockPerson>) => void
  onRemove: () => void
}) {
  const meta = personMetaLine(person)
  const name = formatPersonName(person) || person.firstName || 'Unnamed'
  return (
    <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$3" padding="$2" gap="$2">
      <XStack alignItems="center" gap="$2">
        <Users size={14} color="$color10" />
        <YStack flex={1}>
          <Text fontSize="$3" fontWeight="700" color="$color12">
            {name}
          </Text>
          {meta ? (
            <Text fontSize="$2" color="$color10">
              {meta}
            </Text>
          ) : null}
        </YStack>
        <Button
          size="$2"
          chromeless
          icon={open ? ChevronDown : ChevronRight}
          onPress={onToggleDetails}
        >
          Details
        </Button>
        <Button size="$2" chromeless icon={X} aria-label={`Remove ${name}`} onPress={onRemove} />
      </XStack>

      {open ? (
        <YStack gap="$2" paddingLeft="$2">
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Honorific
            </Text>
            <XStack gap="$1.5">
              {TITLES.map((t) => {
                const on = (person.title ?? undefined) === t.value
                return (
                  <Button
                    key={t.label}
                    size="$2"
                    theme={on ? 'blue' : undefined}
                    backgroundColor={on ? '$blue5' : undefined}
                    hoverStyle={on ? { backgroundColor: '$blue6' } : undefined}
                    onPress={() => onPatch({ title: t.value })}
                  >
                    {t.label}
                  </Button>
                )
              })}
            </XStack>
          </YStack>
          <FieldRow label="Role in this post (optional)">
            <Input
              value={person.label ?? ''}
              onChangeText={(t) => onPatch({ label: t || undefined })}
              placeholder="e.g. best man, proposer"
            />
          </FieldRow>
          <FieldRow label="About (bio, testimony) — members only">
            <TextArea
              value={person.bio ?? ''}
              onChangeText={(t) => onPatch({ bio: t || undefined })}
              placeholder="Shown to members; hidden from the public"
            />
          </FieldRow>
          <FieldRow label="Contact (phone / email) — members only">
            <Input
              value={person.contact ?? ''}
              onChangeText={(t) => onPatch({ contact: t || undefined })}
              placeholder="Shown to members; hidden from the public"
              autoCapitalize="none"
            />
          </FieldRow>
        </YStack>
      ) : null}
    </YStack>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <YStack gap="$1">
      <Text fontSize="$2" fontWeight="600" color="$color11">
        {label}
      </Text>
      {children}
    </YStack>
  )
}
