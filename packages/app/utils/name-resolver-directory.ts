/**
 * Directory adapter for the schedule name resolver (keystone — see
 * project_name_member_resolver, increment 2).
 *
 * Bridges the pure matcher in `./name-resolver` to the app's real data:
 *   - `toDirectoryPerson` maps a DynamoDB `PersonRecord` down to the minimal
 *     `DirectoryPerson` shape the matcher needs.
 *   - `resolveNames` takes the free-text names harvested from a schedule (role
 *     columns + the memorial "Visiting Speakers" tab), dedupes them, drops
 *     placeholders, resolves each against the directory, and groups the outcome.
 *
 * PURE + I/O-free by design: the caller supplies both the raw names and the
 * directory candidates, so this unit-tests cleanly and can run in an admin
 * diagnostic route, a sync hook, or a cron without touching DynamoDB or Sheets.
 */
import type { PersonRecord } from '../provider/dynamodb/types'
import {
  normalizeName,
  isPlaceholderName,
  resolveScheduleName,
  type DirectoryPerson,
  type NameMatch,
} from './name-resolver'

export type { DirectoryPerson } from './name-resolver'

/** Map a full PersonRecord to the minimal shape the matcher consumes. */
export function toDirectoryPerson(p: PersonRecord): DirectoryPerson {
  return {
    personId: p.personId,
    firstName: p.firstName,
    lastName: p.lastName,
    ecclesia: p.ecclesia,
    displayName: p.displayName,
  }
}

/** One matched name and the directory person it resolved to. */
export interface MatchedName {
  input: string
  person: DirectoryPerson
}

/** A name with no exact match but ≥1 close candidate (likely a typo). */
export interface TypoName {
  input: string
  suggestions: Array<{ person: DirectoryPerson; distance: number }>
}

/** A name that matches more than one directory person. */
export interface AmbiguousName {
  input: string
  candidates: DirectoryPerson[]
}

/** A name that matched nothing close — a visitor to add, or bad data. */
export interface NotFoundName {
  input: string
}

export interface ResolveNamesResult {
  matched: MatchedName[]
  typos: TypoName[]
  ambiguous: AmbiguousName[]
  notFound: NotFoundName[]
}

/**
 * Resolve a batch of free-text schedule names against directory candidates.
 *
 * Dedupes on the normalized name (a person named in many cells is resolved
 * once, keyed by their first-seen raw spelling) and skips placeholders
 * ("TBD", "attendees", blanks) so they never surface as people to add.
 */
export function resolveNames(names: string[], candidates: DirectoryPerson[]): ResolveNamesResult {
  const result: ResolveNamesResult = { matched: [], typos: [], ambiguous: [], notFound: [] }

  // Dedupe by normalized full name, keeping the first raw spelling seen.
  const seen = new Map<string, string>()
  for (const raw of names) {
    if (!raw || isPlaceholderName(raw)) continue
    const key = normalizeName(raw).full
    if (!key || seen.has(key)) continue
    seen.set(key, raw.trim())
  }

  for (const raw of seen.values()) {
    const match: NameMatch = resolveScheduleName(raw, candidates)
    switch (match.status) {
      case 'matched':
        result.matched.push({ input: raw, person: match.person })
        break
      case 'typo':
        result.typos.push({ input: raw, suggestions: match.suggestions })
        break
      case 'ambiguous':
        result.ambiguous.push({ input: raw, candidates: match.candidates })
        break
      case 'not-found':
        result.notFound.push({ input: raw })
        break
    }
  }

  return result
}
