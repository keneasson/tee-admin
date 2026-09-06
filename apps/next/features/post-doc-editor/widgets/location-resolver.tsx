'use client'

/**
 * LocationResolver — the PROGRESSIVE Location widget for the document-canvas
 * editor (Consolidated CMS Phase 2R-1b). NOT a form: a single input that
 * RESOLVES, resolve-first, progressive-enhancement.
 *
 *   1. Type → autocomplete against OUR ecclesia directory (`/api/ecclesia/search`).
 *      Pick a match → the block becomes `mode:'ecclesia'`, shown as a compact
 *      resolved chip. This is the 80% path (~a few chars + a click).
 *   2. No internal match → offer "Search Google Places for '<query>'". When
 *      `GOOGLE_PLACES_API_KEY` is unset the affordance renders DISABLED
 *      ("Connect Google Places…") — the real call is wired behind the env check
 *      (see /api/places/*), so it lights up the day a key is added.
 *   3. Neither → "Use as plain text" → `mode:'plain'`.
 *   4. Progressive disclosure: directions / parking / online-meeting live behind
 *      an "Add details" expander, hidden up front.
 *   5. On a resolved ecclesia: "Not right? Edit {ecclesia}'s location →" — saves
 *      the draft and navigates to that ecclesia's edit page IF the viewer may edit
 *      it; otherwise a (stubbed) "Suggest a change".
 *
 * Web-only (next-auth + next/navigation + fetch): lives under apps/next; the pure
 * block-mapping decisions are in {@link location-resolve.ts} (unit-tested there).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { YStack, XStack, Text, Button, Input, Spinner, Separator, TextArea } from '@my/ui'
import { MapPin, Search, Pencil, ChevronDown, ChevronRight, Globe, Lock } from '@tamagui/lucide-icons'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/hooks/use-user-role'
import type { LocationBlock } from '@my/app/types/post'
import {
  type EcclesiaSuggestion,
  type ExternalPlaceAddress,
  ecclesiaToLocationBlock,
  plainLocationBlock,
  externalPlaceToLocationBlock,
  isLocationResolved,
  pickUniqueMatch,
  canEditEcclesiaClient,
} from '@my/app/features/post-editor/resolvers/location-resolve'

interface PlacePrediction {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

export interface LocationResolverProps {
  block: LocationBlock
  onChange: (next: LocationBlock) => void
  /**
   * Persist the in-progress draft before navigating away to an ecclesia's edit
   * page (the "Edit {ecclesia}'s location →" link). Optional — the /brand
   * showcase has nothing to persist; the real posts page wires a save here.
   */
  onBeforeNavigate?: () => void
}

// ---- Fetch seams (thin wrappers over the existing API routes) ---------------

async function searchDirectory(q: string): Promise<EcclesiaSuggestion[]> {
  try {
    const res = await fetch(`/api/ecclesia/search?q=${encodeURIComponent(q)}&limit=6`)
    const data = await res.json()
    return data?.success ? (data.data as EcclesiaSuggestion[]) : []
  } catch {
    return []
  }
}

/**
 * The external-place resolution seam. Returns whether Places is CONFIGURED (so
 * the UI can render the disabled "Connect Google Places…" state) plus any
 * predictions. Real Google traffic only flows when a key is present server-side.
 */
async function resolveExternalPlace(
  q: string
): Promise<{ configured: boolean; predictions: PlacePrediction[] }> {
  try {
    const res = await fetch('/api/places/autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: q, country: 'CA' }),
    })
    const data = await res.json()
    return {
      configured: !!data?.configured,
      predictions: (data?.predictions as PlacePrediction[]) ?? [],
    }
  } catch {
    return { configured: false, predictions: [] }
  }
}

async function fetchPlaceDetails(placeId: string): Promise<ExternalPlaceAddress | null> {
  try {
    const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`)
    const data = await res.json()
    return data?.success ? (data.address as ExternalPlaceAddress) : null
  } catch {
    return null
  }
}

// ---- Component --------------------------------------------------------------

export function LocationResolver({ block, onChange, onBeforeNavigate }: LocationResolverProps) {
  const router = useRouter()
  const { role, isRecordingBrother, session } = useUserRole()
  const homeEcclesia = (session?.user as { ecclesia?: string } | undefined)?.ecclesia ?? null

  // View: a resolved block shows a compact chip; otherwise the resolving input.
  const [view, setView] = useState<'chip' | 'input'>(() =>
    isLocationResolved(block) ? 'chip' : 'input'
  )
  const [query, setQuery] = useState(() => (view === 'input' ? block.venueName ?? '' : ''))
  const [suggestions, setSuggestions] = useState<EcclesiaSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Places state: `configured` is null until first probed.
  const [placesConfigured, setPlacesConfigured] = useState<boolean | null>(null)
  const [placesPredictions, setPlacesPredictions] = useState<PlacePrediction[]>([])
  const [placesSearching, setPlacesSearching] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const seededRef = useRef(false)

  // Run a directory search (debounced by the caller). Returns the results so the
  // seed path can decide on a unique auto-resolution.
  const runSearch = useCallback(async (q: string): Promise<EcclesiaSuggestion[]> => {
    if (q.trim().length < 2) {
      setSuggestions([])
      return []
    }
    setSearching(true)
    const results = await searchDirectory(q.trim())
    setSuggestions(results)
    setSearching(false)
    return results
  }, [])

  const chooseEcclesia = useCallback(
    (e: EcclesiaSuggestion) => {
      onChange(ecclesiaToLocationBlock(e, block))
      setView('chip')
      setSuggestions([])
      setPlacesPredictions([])
    },
    [block, onChange]
  )

  // SEED path: on first mount of a seeded input, auto-search and — if the seed
  // resolves UNIQUELY — pre-fill the ecclesia ref (jump straight to the chip).
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    const seed = view === 'input' ? (block.venueName ?? '').trim() : ''
    if (seed.length < 2) return
    void (async () => {
      const results = await runSearch(seed)
      const unique = pickUniqueMatch(seed, results)
      if (unique) chooseEcclesia(unique)
    })()
    // Intentionally mount-once (seed is read once); deps kept minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onQueryChange = useCallback(
    (text: string) => {
      setQuery(text)
      setPlacesPredictions([])
      setPlacesConfigured(null)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (text.trim().length < 2) {
        setSuggestions([])
        return
      }
      debounceRef.current = setTimeout(() => {
        void runSearch(text)
      }, 300)
    },
    [runSearch]
  )

  const choosePlain = useCallback(() => {
    onChange(plainLocationBlock(query, block))
    setView('chip')
  }, [block, onChange, query])

  // Probe Places config lazily, once we reach "no internal match".
  const noInternalMatch = query.trim().length >= 2 && !searching && suggestions.length === 0
  useEffect(() => {
    if (!noInternalMatch || placesConfigured !== null) return
    void resolveExternalPlace('').then((r) => setPlacesConfigured(r.configured))
  }, [noInternalMatch, placesConfigured])

  const runExternalSearch = useCallback(async () => {
    setPlacesSearching(true)
    const { configured, predictions } = await resolveExternalPlace(query.trim())
    setPlacesConfigured(configured)
    setPlacesPredictions(predictions)
    setPlacesSearching(false)
  }, [query])

  const choosePlace = useCallback(
    async (p: PlacePrediction) => {
      const addr = await fetchPlaceDetails(p.placeId)
      if (addr) {
        onChange(externalPlaceToLocationBlock(addr, block))
      } else {
        // Details lookup failed — fall back to the prediction text as plain.
        onChange(plainLocationBlock(p.mainText || p.description, block))
      }
      setView('chip')
      setPlacesPredictions([])
    },
    [block, onChange]
  )

  const editEcclesia = useCallback(() => {
    if (!block.ecclesiaRef) return
    onBeforeNavigate?.()
    router.push(`/directory/ecclesias/${encodeURIComponent(block.ecclesiaRef)}?edit=true`)
  }, [block.ecclesiaRef, onBeforeNavigate, router])

  const updateDetail = useCallback(
    (patch: Partial<LocationBlock>) => onChange({ ...block, ...patch }),
    [block, onChange]
  )

  const canEdit = canEditEcclesiaClient({
    ecclesiaRef: block.ecclesiaRef,
    role: role as string | undefined,
    ecclesia: homeEcclesia,
    isRecordingBrother,
  })

  // ---- CHIP VIEW ------------------------------------------------------------
  if (view === 'chip') {
    const primary =
      block.mode === 'ecclesia'
        ? block.venueName || block.ecclesiaRef || 'Ecclesia'
        : block.venueName || 'Location'
    const secondary = [block.city, block.province].filter(Boolean).join(', ')
    return (
      <YStack gap="$2">
        <XStack alignItems="center" gap="$2" flexWrap="wrap">
          <XStack
            alignItems="center"
            gap="$2"
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius="$10"
            backgroundColor="$blue3"
            borderWidth={1}
            borderColor="$blue6"
          >
            <MapPin size={14} color="$blue10" />
            <Text fontSize="$3" fontWeight="700" color="$blue11">
              {primary}
            </Text>
            {secondary ? (
              <Text fontSize="$2" color="$blue10">
                · {secondary}
              </Text>
            ) : null}
          </XStack>
          <Button
            size="$2"
            chromeless
            icon={Search}
            onPress={() => {
              setView('input')
              setQuery(block.venueName ?? '')
              setSuggestions([])
            }}
          >
            Change
          </Button>
        </XStack>

        {block.mode === 'ecclesia' ? (
          canEdit ? (
            <Button
              size="$2"
              chromeless
              icon={Pencil}
              justifyContent="flex-start"
              onPress={editEcclesia}
            >
              {`Not right? Edit ${block.ecclesiaRef}'s location →`}
            </Button>
          ) : (
            // TODO(2R-x): wire the suggest-a-change / approval flow. Disabled stub
            // for now — a viewer who can't edit an ecclesia proposes a correction.
            <Button size="$2" chromeless icon={Lock} disabled opacity={0.6} justifyContent="flex-start">
              Suggest a change (coming soon)
            </Button>
          )
        ) : null}

        <DetailsExpander
          block={block}
          open={showDetails}
          onToggle={() => setShowDetails((s) => !s)}
          onPatch={updateDetail}
        />
      </YStack>
    )
  }

  // ---- INPUT VIEW -----------------------------------------------------------
  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$2">
        <Search size={16} color="$color10" />
        <Input
          flex={1}
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search our directory, or type a venue…"
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
              key={`${s.name}-${s.city ?? ''}`}
              chromeless
              justifyContent="flex-start"
              borderRadius={0}
              borderBottomWidth={i < suggestions.length - 1 ? 1 : 0}
              borderBottomColor="$borderColor"
              hoverStyle={{ backgroundColor: '$blue2' }}
              onPress={() => chooseEcclesia(s)}
            >
              <YStack alignItems="flex-start" width="100%">
                <Text fontSize="$3" fontWeight="600">
                  {s.name}
                </Text>
                {s.city || s.province ? (
                  <Text fontSize="$2" color="$color10">
                    {[s.city, s.province, s.country].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
              </YStack>
            </Button>
          ))}
        </YStack>
      ) : null}

      {noInternalMatch ? (
        <YStack gap="$2">
          <Separator />
          {/* External (Google Places) seam — disabled until a key is configured. */}
          {placesConfigured === false ? (
            <Button
              size="$3"
              disabled
              opacity={0.6}
              icon={Globe}
              justifyContent="flex-start"
              theme="alt2"
            >
              Connect Google Places to search external locations
            </Button>
          ) : placesConfigured ? (
            <Button
              size="$3"
              icon={Globe}
              justifyContent="flex-start"
              onPress={runExternalSearch}
            >
              {placesSearching ? 'Searching Google Places…' : `Search Google Places for "${query.trim()}"`}
            </Button>
          ) : (
            <XStack alignItems="center" gap="$2" paddingVertical="$1">
              <Spinner size="small" />
              <Text fontSize="$2" color="$color10">
                Checking external search…
              </Text>
            </XStack>
          )}

          {placesPredictions.length > 0 ? (
            <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$3" overflow="hidden">
              {placesPredictions.map((p, i) => (
                <Button
                  key={p.placeId}
                  chromeless
                  justifyContent="flex-start"
                  borderRadius={0}
                  borderBottomWidth={i < placesPredictions.length - 1 ? 1 : 0}
                  borderBottomColor="$borderColor"
                  hoverStyle={{ backgroundColor: '$blue2' }}
                  onPress={() => void choosePlace(p)}
                >
                  <YStack alignItems="flex-start" width="100%">
                    <Text fontSize="$3" fontWeight="600">
                      {p.mainText}
                    </Text>
                    <Text fontSize="$2" color="$color10">
                      {p.secondaryText}
                    </Text>
                  </YStack>
                </Button>
              ))}
            </YStack>
          ) : null}

          <Button
            size="$3"
            variant="outlined"
            icon={MapPin}
            justifyContent="flex-start"
            onPress={choosePlain}
          >
            {`Use "${query.trim()}" as plain text`}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  )
}

// ---- Progressive-disclosure details -----------------------------------------

function DetailsExpander({
  block,
  open,
  onToggle,
  onPatch,
}: {
  block: LocationBlock
  open: boolean
  onToggle: () => void
  onPatch: (patch: Partial<LocationBlock>) => void
}) {
  return (
    <YStack gap="$2">
      <Button
        size="$2"
        chromeless
        icon={open ? ChevronDown : ChevronRight}
        justifyContent="flex-start"
        onPress={onToggle}
      >
        Add details (directions, parking, online meeting)
      </Button>
      {open ? (
        <YStack gap="$2" paddingLeft="$2">
          <FieldRow label="Label">
            <Input
              value={block.label ?? ''}
              onChangeText={(t) => onPatch({ label: t || undefined })}
              placeholder="e.g. Service, Reception"
            />
          </FieldRow>
          <FieldRow label="Directions">
            <TextArea
              value={block.directions ?? ''}
              onChangeText={(t) => onPatch({ directions: t || undefined })}
              placeholder="How to find it once on site"
            />
          </FieldRow>
          <FieldRow label="Parking">
            <TextArea
              value={block.parkingInfo ?? ''}
              onChangeText={(t) => onPatch({ parkingInfo: t || undefined })}
              placeholder="Parking notes"
            />
          </FieldRow>
          <FieldRow label="Online meeting link">
            <Input
              value={block.onlineMeeting?.link ?? ''}
              onChangeText={(t) =>
                onPatch({ onlineMeeting: t ? { ...block.onlineMeeting, link: t } : undefined })
              }
              placeholder="https://zoom.us/j/…"
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
