/**
 * Pure block-mapping decisions for the {@link PersonResolver} (Consolidated CMS
 * 2R-2). Mirrors {@link location-resolve.ts}: the resolver COMPONENT owns fetch +
 * Tamagui; these owns the deterministic name → BlockPerson mapping so it is
 * unit-testable without React.
 *
 * A person block is a snapshot, NOT a live foreign key: picking a directory match
 * copies the display fields onto a fresh {@link BlockPerson} (its own `id`); the
 * directory person's id is deliberately NOT stored (the post must render even if
 * that record later changes, and PII redaction happens on the copied fields).
 */

import type { BlockPerson, PersonBlock } from '@my/app/types/post'
import { genId } from '@my/ui/src/post-editor/post-reducer'

/** A directory search hit (subset of `/api/people` member shape). */
export interface PersonSuggestion {
  id: string
  name: string
  ecclesia?: string
}

/**
 * Split a display name into `firstName` + optional `lastName`. First token is the
 * first name (the always-shown floor); everything after is the last name. Collapses
 * runs of whitespace. An empty/blank input yields an empty first name.
 */
export function splitPersonName(full: string): { firstName: string; lastName?: string } {
  const clean = (full ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return { firstName: '' }
  const [firstName, ...rest] = clean.split(' ')
  return rest.length > 0 ? { firstName, lastName: rest.join(' ') } : { firstName }
}

/** A directory match → a fresh BlockPerson entry (snapshot; directory id dropped). */
export function suggestionToPerson(s: PersonSuggestion): BlockPerson {
  const { firstName, lastName } = splitPersonName(s.name)
  return { id: genId(), firstName, lastName, ecclesia: s.ecclesia || undefined }
}

/** A typed, unresolved name → a plain BlockPerson (visiting speaker / off-directory). */
export function plainNameToPerson(name: string): BlockPerson {
  const { firstName, lastName } = splitPersonName(name)
  return { id: genId(), firstName, lastName }
}

/**
 * If the query resolves to EXACTLY one directory match whose name equals the query
 * (case-insensitive), return it — the seed path can auto-resolve without a click,
 * like {@link pickUniqueMatch} for locations.
 */
export function pickUniquePersonMatch(
  query: string,
  results: PersonSuggestion[]
): PersonSuggestion | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  const exact = results.filter((r) => r.name.trim().toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  if (results.length === 1) return results[0]
  return undefined
}

/** Roles for the block header. Labels read as the published header for that role. */
export const PERSON_ROLES: Array<{ value: PersonBlock['role']; label: string }> = [
  { value: 'speaker', label: 'Speaker' },
  { value: 'candidate', label: 'Baptism candidate' },
  { value: 'deceased', label: 'In loving memory of' },
  { value: 'bride', label: 'Bride' },
  { value: 'groom', label: 'Groom' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'contact', label: 'Contact' },
  { value: 'other', label: 'Person' },
]

// ---- Immutable list ops (keep the component declarative) ---------------------

export function addPerson(block: PersonBlock, person: BlockPerson): PersonBlock {
  return { ...block, people: [...block.people, person] }
}

export function removePerson(block: PersonBlock, id: string): PersonBlock {
  return { ...block, people: block.people.filter((p) => p.id !== id) }
}

export function patchPerson(
  block: PersonBlock,
  id: string,
  patch: Partial<BlockPerson>
): PersonBlock {
  return {
    ...block,
    people: block.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }
}
