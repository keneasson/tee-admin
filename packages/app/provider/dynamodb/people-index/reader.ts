/**
 * READERS for the people/ecclesia projections (see `keys.ts`). Every one is a
 * GetItem, Query or BatchGetItem — no Scan (ADR-0006 §8).
 *
 * Callers switch to these only when `peopleIndexReady()` is true: the
 * projections exist for every person only once the backfill has run and
 * written the build marker. Until then the legacy read stays in charge, so a
 * deploy that lands before the backfill can never show a short list.
 */
import { BatchGetCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, tableNames } from '../config'
import {
  type OfficeKind,
  type PersonCard,
  CARD_SK,
  ECCLESIA_ALIAS_SK,
  ECCLESIA_DIRECTORY_PK,
  INDEX_META_PK,
  INDEX_META_SK,
  OFFICE_PREFIX,
  ecclesiaIdPk,
  ecclesiaPeoplePk,
  nameTokens,
  namePrefixPk,
  peopleRosterPk,
  rbEmailPk,
} from './keys'

const TABLE = tableNames.admin

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

let markerCache: { ready: boolean; expires: number } | null = null
// Once built the index stays built, so "ready" is cached longer; "not ready"
// is re-checked every minute so readers switch soon after the backfill runs.
const READY_TTL_MS = 5 * 60 * 1000
const NOT_READY_TTL_MS = 60 * 1000

/** Test hook. */
export function resetPeopleIndexReadyCache() {
  markerCache = null
}

/**
 * True when the projections can be trusted for reads: the backfill marker
 * exists and the `PEOPLE_INDEX_READS=off` kill switch is not set.
 */
export async function peopleIndexReady(): Promise<boolean> {
  if (process.env.PEOPLE_INDEX_READS === 'off') return false
  if (markerCache && markerCache.expires > Date.now()) return markerCache.ready
  let ready = false
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: TABLE, Key: { pkey: INDEX_META_PK, skey: INDEX_META_SK } })
    )
    ready = !!result?.Item
  } catch (error) {
    console.error('people-index: could not read the build marker; using legacy reads', error)
  }
  markerCache = { ready, expires: Date.now() + (ready ? READY_TTL_MS : NOT_READY_TTL_MS) }
  return ready
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function queryAll<T>(input: ConstructorParameters<typeof QueryCommand>[0]): Promise<T[]> {
  const out: T[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const result = await docClient.send(new QueryCommand({ ...input, ExclusiveStartKey: lastKey }))
    out.push(...((result?.Items || []) as T[]))
    lastKey = result?.LastEvaluatedKey
  } while (lastKey)
  return out
}

/** BatchGetItem in chunks of 100, retrying unprocessed keys. Order is not preserved. */
export async function batchGetItems<T = Record<string, any>>(
  keys: Array<{ pkey: string; skey: string }>
): Promise<T[]> {
  const out: T[] = []
  const unique = [...new Map(keys.map((k) => [`${k.pkey}\u0000${k.skey}`, k])).values()]
  for (let i = 0; i < unique.length; i += 100) {
    let pending: Array<Record<string, any>> = unique.slice(i, i + 100).map((k) => ({ pkey: k.pkey, skey: k.skey }))
    for (let attempt = 0; pending.length > 0 && attempt < 5; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt))
      const result = await docClient.send(
        new BatchGetCommand({ RequestItems: { [TABLE]: { Keys: pending } } })
      )
      out.push(...((result?.Responses?.[TABLE] || []) as T[]))
      pending = (result?.UnprocessedKeys?.[TABLE]?.Keys as Array<Record<string, any>>) || []
    }
    if (pending.length > 0) throw new Error(`people-index: ${pending.length} keys unprocessed after retries`)
  }
  return out
}

// ---------------------------------------------------------------------------
// People (patterns 3, 4, 10)
// ---------------------------------------------------------------------------

/** Pattern 4, everyone: every person card, sorted by last then first name. */
export async function listPeopleCards(): Promise<PersonCard[]> {
  return queryAll<PersonCard>({
    TableName: TABLE,
    IndexName: 'gsi4',
    KeyConditionExpression: 'gsi4pk = :pk',
    ExpressionAttributeValues: { ':pk': peopleRosterPk() },
  })
}

/** Pattern 4, one ecclesia (by its stable id). */
export async function listPeopleCardsByEcclesiaId(ecclesiaId: string): Promise<PersonCard[]> {
  return queryAll<PersonCard>({
    TableName: TABLE,
    IndexName: 'gsi2',
    KeyConditionExpression: 'gsi2pk = :pk',
    ExpressionAttributeValues: { ':pk': ecclesiaPeoplePk(ecclesiaId) },
  })
}

/** Pattern 10: the cards for a set of people (e.g. a post's smart references), one round trip per 100. */
export async function getPeopleCards(personIds: string[]): Promise<Map<string, PersonCard>> {
  const items = await batchGetItems<PersonCard>(personIds.map((id) => ({ pkey: `PERSON#${id}`, skey: CARD_SK })))
  return new Map(items.map((c) => [c.personId, c]))
}

export interface NameMatch {
  personId: string
  displayName: string
  ecclesia: string
  role?: string
}

/**
 * Pattern 3: name typeahead for the smart-contact picker. Matches a prefix of
 * ANY of a person's name words, and every typed word must prefix-match one of
 * them: "jo sm" finds "John Smith" and "Smith, Joanna". Needs two letters.
 */
export async function searchPeopleByNamePrefix(query: string, limit = 10): Promise<NameMatch[]> {
  const typed = nameTokens(query)
  if (typed.length === 0) return []
  // Query on the longest typed word (most selective) that has two letters.
  const anchor = typed.slice().sort((a, b) => b.length - a.length)[0]
  if (anchor.length < 2) return []
  const rows = await queryAll<{ personId: string; displayName: string; ecclesia: string; role?: string; tokens?: string[] }>({
    TableName: TABLE,
    IndexName: 'gsi3',
    KeyConditionExpression: 'gsi3pk = :pk AND begins_with(gsi3sk, :sk)',
    ExpressionAttributeValues: { ':pk': namePrefixPk(anchor), ':sk': anchor },
  })
  const seen = new Set<string>()
  const out: NameMatch[] = []
  for (const row of rows) {
    if (seen.has(row.personId)) continue
    const tokens = row.tokens || []
    if (!typed.every((t) => tokens.some((tok) => tok.startsWith(t)))) continue
    seen.add(row.personId)
    out.push({ personId: row.personId, displayName: row.displayName, ecclesia: row.ecclesia, role: row.role })
  }
  out.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return out.slice(0, limit)
}

// ---------------------------------------------------------------------------
// Ecclesias (patterns 7, 8, 9, 11)
// ---------------------------------------------------------------------------

export interface EcclesiaDirectoryEntry {
  ecclesiaId: string
  name: string
  country: string
  province: string
  city: string
  ecclesiaPkey: string
  ecclesiaSkey: string
}

/** Pattern 9: every ecclesia, optionally within a country or province. */
export async function listEcclesiaDirectory(filter: { country?: string; province?: string } = {}): Promise<EcclesiaDirectoryEntry[]> {
  const prefix = filter.country ? `${filter.country}|${filter.province ? `${filter.province}|` : ''}` : ''
  return queryAll<EcclesiaDirectoryEntry>({
    TableName: TABLE,
    IndexName: 'gsi2',
    KeyConditionExpression: prefix ? 'gsi2pk = :pk AND begins_with(gsi2sk, :sk)' : 'gsi2pk = :pk',
    ExpressionAttributeValues: prefix ? { ':pk': ECCLESIA_DIRECTORY_PK, ':sk': prefix } : { ':pk': ECCLESIA_DIRECTORY_PK },
  })
}

/** Directory entries → the full ECCLESIA source items (BatchGet). */
export async function getEcclesiaItems(entries: EcclesiaDirectoryEntry[]): Promise<Record<string, any>[]> {
  const items = await batchGetItems(entries.map((e) => ({ pkey: e.ecclesiaPkey, skey: e.ecclesiaSkey })))
  return items.filter((i) => i.type === 'ECCLESIA')
}

/** Pattern 7: a stable ecclesia id → its directory entry (and so its key). */
export async function getEcclesiaById(ecclesiaId: string): Promise<EcclesiaDirectoryEntry | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE, Key: { pkey: ecclesiaIdPk(ecclesiaId), skey: ECCLESIA_ALIAS_SK } })
  )
  return (result?.Item as EcclesiaDirectoryEntry) || null
}

export interface OfficeRef {
  office: OfficeKind
  ecclesiaId: string
  personId: string
}

/** Pattern 8 / 12: who holds each office of an ecclesia (BatchGet the cards for names). */
export async function getEcclesiaOffices(ecclesiaId: string, office?: OfficeKind): Promise<OfficeRef[]> {
  return queryAll<OfficeRef>({
    TableName: TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :sk)',
    ExpressionAttributeValues: { ':pk': ecclesiaIdPk(ecclesiaId), ':sk': `${OFFICE_PREFIX}${office ? `${office}#` : ''}` },
  })
}

/** Pattern 11: the offices a person holds. */
export async function getOfficesHeldBy(personId: string): Promise<OfficeRef[]> {
  return queryAll<OfficeRef>({
    TableName: TABLE,
    KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :sk)',
    ExpressionAttributeValues: { ':pk': `PERSON#${personId}`, ':sk': OFFICE_PREFIX },
  })
}

/**
 * Sign-in: the ecclesia whose Recording Brother address this is, for an
 * address that has no PersonRecord yet (so pattern 11 cannot answer).
 * Replaces the full-table Scan in `getEcclesiaByRecordingBrotherEmail`.
 */
export async function findEcclesiaByRecordingBrotherEmail(email: string): Promise<EcclesiaDirectoryEntry | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
      ExpressionAttributeValues: { ':pk': rbEmailPk(email), ':sk': ECCLESIA_ALIAS_SK },
    })
  )
  const rows = ((result?.Items || []) as EcclesiaDirectoryEntry[]).sort((a, b) => a.ecclesiaId.localeCompare(b.ecclesiaId))
  return rows[0] || null
}
