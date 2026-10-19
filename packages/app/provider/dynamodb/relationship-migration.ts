import { chooseSignInHolder } from './repositories/person-repository'
import {
  INVERSE_RELATIONSHIP,
  buildRelationshipPair,
  isRelationshipType,
} from './repositories/relationship-repository'
import type { PersonEmailRecord, PersonRecord, RelationshipRecord, RelationshipType } from './types'

/**
 * Plan the move of legacy email-keyed relationship rows
 *   USER#<email> / RELATIONSHIP#<targetEmail>#<type>
 * to person-keyed rows
 *   PERSON#<personId> / REL#<targetPersonId>#<type>
 *
 * Pure (the address lookup is injected), so the resolution rules are tested
 * without DynamoDB. Used by scripts/migrate-relationships-to-person.ts.
 *
 * Resolution of an address to a person:
 *  - any address the person holds counts (primary, secondary, or a
 *    `@family.local` placeholder primary — the placeholder resolves to the
 *    person who holds it);
 *  - when several people hold an address, the other side of the relationship
 *    is never chosen (a spouse who shares the inbox is not their own spouse);
 *  - if several still remain, the deterministic sign-in rule
 *    (`chooseSignInHolder`) picks one: that is the person who saw this family
 *    when signing in with the address, so the result matches today's view.
 *    These are counted as `resolvedBySignInRule` so the owner can review them;
 *  - nobody holds it → the row is UNRESOLVED: listed, never written, and its
 *    legacy row is never deleted.
 */

export interface LegacyRelationshipRow {
  pkey: string // USER#<email>
  skey: string // RELATIONSHIP#<targetEmail>#<type>
  sourceEmail?: string
  targetEmail?: string
  relationshipType?: string
  status?: string
  createdAt?: string
}

export interface AddressHolders {
  persons: PersonRecord[]
  emailRows: Array<Pick<PersonEmailRecord, 'pkey' | 'email' | 'loginExcluded'>>
}

export type AddressLookup = (email: string) => Promise<AddressHolders>

export interface PlannedPair {
  sourcePersonId: string
  targetPersonId: string
  relationshipType: RelationshipType
  status: RelationshipRecord['status']
  createdAt: string
  rows: [RelationshipRecord, RelationshipRecord]
  /** The legacy rows this pair replaces (deleted only after a verified write). */
  legacyKeys: Array<{ pkey: string; skey: string }>
  resolvedBySignInRule: boolean
}

export interface UnresolvedRow {
  key: { pkey: string; skey: string }
  reason: 'source-not-found' | 'target-not-found' | 'same-person' | 'bad-row'
}

export interface RelationshipMigrationPlan {
  pairs: PlannedPair[]
  unresolved: UnresolvedRow[]
}

export function parseLegacyRow(row: LegacyRelationshipRow): {
  sourceEmail: string
  targetEmail: string
  type: RelationshipType
  status: RelationshipRecord['status']
} | null {
  if (!row.pkey?.startsWith('USER#') || !row.skey?.startsWith('RELATIONSHIP#')) return null
  const rest = row.skey.slice('RELATIONSHIP#'.length)
  const hash = rest.lastIndexOf('#')
  const skType = hash > 0 ? rest.slice(hash + 1) : ''
  const skTarget = hash > 0 ? rest.slice(0, hash) : ''
  const type = row.relationshipType || skType
  const sourceEmail = (row.sourceEmail || row.pkey.slice('USER#'.length)).toLowerCase().trim()
  const targetEmail = (row.targetEmail || skTarget).toLowerCase().trim()
  if (!sourceEmail || !targetEmail || !isRelationshipType(type)) return null
  const status = row.status === 'removed' || row.status === 'pending' ? row.status : 'active'
  return { sourceEmail, targetEmail, type, status }
}

function pick(
  email: string,
  holders: AddressHolders,
  excludeId: string | null
): { personId: string; bySignInRule: boolean } | null {
  const pool = holders.persons.filter((p) => p.personId !== excludeId)
  if (pool.length === 0) return null
  if (pool.length === 1) return { personId: pool[0].personId, bySignInRule: false }
  const chosen = chooseSignInHolder(email, pool, holders.emailRows)
  return chosen ? { personId: chosen.personId, bySignInRule: true } : null
}

const STATUS_RANK: Record<RelationshipRecord['status'], number> = { active: 0, pending: 1, removed: 2 }

export async function planRelationshipMigration(
  legacyRows: LegacyRelationshipRow[],
  lookup: AddressLookup,
  now: string = new Date().toISOString()
): Promise<RelationshipMigrationPlan> {
  const cache = new Map<string, Promise<AddressHolders>>()
  const holdersOf = (email: string) => {
    if (!cache.has(email)) cache.set(email, lookup(email))
    return cache.get(email)!
  }

  const byPair = new Map<string, Omit<PlannedPair, 'rows'>>()
  const unresolved: UnresolvedRow[] = []

  for (const row of legacyRows) {
    const key = { pkey: row.pkey, skey: row.skey }
    const parsed = parseLegacyRow(row)
    if (!parsed) {
      unresolved.push({ key, reason: 'bad-row' })
      continue
    }
    const [src, tgt] = await Promise.all([holdersOf(parsed.sourceEmail), holdersOf(parsed.targetEmail)])
    if (src.persons.length === 0) {
      unresolved.push({ key, reason: 'source-not-found' })
      continue
    }
    if (tgt.persons.length === 0) {
      unresolved.push({ key, reason: 'target-not-found' })
      continue
    }

    // Fix the side with a single holder first, then exclude it from the other.
    let s: ReturnType<typeof pick>
    let t: ReturnType<typeof pick>
    if (tgt.persons.length === 1) {
      t = pick(parsed.targetEmail, tgt, null)
      s = pick(parsed.sourceEmail, src, t?.personId ?? null)
    } else {
      s = pick(parsed.sourceEmail, src, null)
      t = pick(parsed.targetEmail, tgt, s?.personId ?? null)
    }
    if (!s || !t || s.personId === t.personId) {
      unresolved.push({ key, reason: 'same-person' })
      continue
    }

    // One pair per relationship, whichever direction's row we met first.
    const forward = s.personId < t.personId
    const sourcePersonId = forward ? s.personId : t.personId
    const targetPersonId = forward ? t.personId : s.personId
    const relationshipType = forward ? parsed.type : INVERSE_RELATIONSHIP[parsed.type]
    const id = `${sourcePersonId}|${targetPersonId}|${relationshipType}`
    const existing = byPair.get(id)
    const createdAt = row.createdAt || now
    if (existing) {
      existing.legacyKeys.push(key)
      // Keep the family visible: active wins over removed.
      if (STATUS_RANK[parsed.status] < STATUS_RANK[existing.status]) existing.status = parsed.status
      if (createdAt < existing.createdAt) existing.createdAt = createdAt
      existing.resolvedBySignInRule ||= s.bySignInRule || t.bySignInRule
    } else {
      byPair.set(id, {
        sourcePersonId,
        targetPersonId,
        relationshipType,
        status: parsed.status,
        createdAt,
        legacyKeys: [key],
        resolvedBySignInRule: s.bySignInRule || t.bySignInRule,
      })
    }
  }

  const pairs: PlannedPair[] = [...byPair.values()]
    .sort((a, b) =>
      `${a.sourcePersonId}|${a.targetPersonId}|${a.relationshipType}`.localeCompare(
        `${b.sourcePersonId}|${b.targetPersonId}|${b.relationshipType}`
      )
    )
    .map((p) => ({
      ...p,
      rows: buildRelationshipPair(p.sourcePersonId, p.targetPersonId, p.relationshipType, p.status, now, p.createdAt),
    }))

  return { pairs, unresolved }
}

/** True when a stored row already says what the planned row says. */
export function relationshipRowMatches(
  stored: Partial<RelationshipRecord> | null | undefined,
  planned: RelationshipRecord
): boolean {
  return (
    !!stored &&
    stored.pkey === planned.pkey &&
    stored.skey === planned.skey &&
    stored.sourcePersonId === planned.sourcePersonId &&
    stored.targetPersonId === planned.targetPersonId &&
    stored.relationshipType === planned.relationshipType &&
    stored.status === planned.status
  )
}
