/**
 * Pure resolver logic for the document-canvas Location widget (Consolidated CMS
 * Phase 2R-1b). This is the DEPENDENCY-LIGHT half of the progressive Location
 * resolver: block factories + directory/place → {@link LocationBlock} mappers +
 * the "did this seed resolve uniquely?" rule. It imports ONLY types + the pure
 * `genId` helper (never React / Tamagui / Lexical / next-auth) so it is
 * unit-testable in a plain node vitest environment — the same discipline as
 * doc-serialization.ts.
 *
 * The stateful React shell ({@link location-resolver.tsx}) drives fetches and
 * view state; ALL the "what block does this produce" decisions live here so they
 * can be tested without mounting the editor.
 */

import type { LocationBlock } from '@my/app/types/post'
import { genId } from '@my/ui/src/post-editor/post-reducer'

/** Directory search result shape (subset of EcclesiaData the search API returns). */
export interface EcclesiaSuggestion {
  name: string
  city?: string
  province?: string
  country?: string
  address?: string
  postalCode?: string
  venue?: string
}

/** Parsed external place (subset of the /api/places/details ParsedAddress shape). */
export interface ExternalPlaceAddress {
  name?: string
  streetAddress?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  lat?: number
  lng?: number
}

/**
 * Fresh, blank Location block for the armed-tool insert at an empty caret — the
 * resolver opens in its input state with nothing to resolve.
 */
export function makeLocationBlock(id: string = genId()): LocationBlock {
  return { id, kind: 'location', mode: 'plain' }
}

/**
 * SEED block for the convert-selection path: the selected text becomes the
 * resolver's initial query (parked on `venueName`, which keeps the block a valid
 * plain LocationBlock so the round-trip stays green). The resolver reads this on
 * mount, pre-fills its input, and immediately attempts a directory resolution.
 */
export function makeSeededLocationBlock(text: string, id: string = genId()): LocationBlock {
  return { id, kind: 'location', mode: 'plain', venueName: text.trim() }
}

/**
 * A picked directory ecclesia → a resolved `mode:'ecclesia'` block. Preserves the
 * author's progressive-disclosure extras (label / directions / parking /
 * onlineMeeting) carried on `base`; replaces the location identity.
 */
export function ecclesiaToLocationBlock(e: EcclesiaSuggestion, base: LocationBlock): LocationBlock {
  return {
    ...base,
    mode: 'ecclesia',
    ecclesiaRef: e.name,
    venueName: e.venue || e.name,
    city: e.city,
    province: e.province,
    country: e.country,
    address: e.address,
    postalCode: e.postalCode,
  }
}

/** "Use as plain text" → a resolved `mode:'plain'` block with the typed venue name. */
export function plainLocationBlock(text: string, base: LocationBlock): LocationBlock {
  return { ...base, mode: 'plain', ecclesiaRef: undefined, venueName: text.trim() }
}

/** A picked Google Places result → a resolved `mode:'geo'` block. */
export function externalPlaceToLocationBlock(a: ExternalPlaceAddress, base: LocationBlock): LocationBlock {
  return {
    ...base,
    mode: 'geo',
    ecclesiaRef: undefined,
    venueName: a.name || base.venueName,
    address: a.streetAddress || undefined,
    city: a.city || undefined,
    province: a.province || undefined,
    postalCode: a.postalCode || undefined,
    country: a.country || undefined,
    lat: a.lat,
    lng: a.lng,
  }
}

/**
 * Does a resolver open as a compact CHIP (already resolved) or as the INPUT
 * (needs resolving)? A seed block (`plain` + a bare `venueName`, no geo context)
 * and a blank block both open as INPUT so the resolver attempts resolution; an
 * ecclesia ref, a geo result, or a plain venue WITH city/province/country is a
 * committed identity and opens as a chip.
 */
export function isLocationResolved(block: LocationBlock): boolean {
  if (block.mode === 'ecclesia') return !!block.ecclesiaRef
  if (block.mode === 'geo') return !!(block.venueName || block.address || block.lat != null)
  // plain: committed only when it carries geo context beyond the bare venue name.
  return !!(block.venueName && (block.city || block.province || block.country))
}

/**
 * Unique-resolution rule for the SEED path: an exact case-insensitive name match
 * wins; otherwise a sole result is taken; anything ambiguous returns null (the
 * resolver then shows the suggestion list rather than auto-committing).
 */
export function pickUniqueMatch(
  query: string,
  results: EcclesiaSuggestion[]
): EcclesiaSuggestion | null {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return null
  const exact = results.filter((r) => r.name.trim().toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  if (results.length === 1) return results[0]
  return null
}

/**
 * Client mirror of the server `checkEcclesiaEditPermission` rule, computed from
 * session claims (role / home ecclesia / RB designation) so the resolver can show
 * "Edit {ecclesia}'s location →" only when the viewer may actually edit it. The
 * server route re-checks on write; this only gates the affordance.
 */
export function canEditEcclesiaClient(opts: {
  ecclesiaRef?: string
  role?: string
  ecclesia?: string | null
  isRecordingBrother?: boolean
}): boolean {
  const { ecclesiaRef, role, ecclesia, isRecordingBrother } = opts
  if (!ecclesiaRef) return false
  const r = (role || '').toUpperCase()
  if (r === 'OWNER') return true
  const same = !!ecclesia && ecclesia === ecclesiaRef
  if (same && (r === 'ADMIN' || r === 'RECORDER' || r === 'REP')) return true
  if (same && isRecordingBrother) return true
  return false
}
