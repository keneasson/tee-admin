/**
 * The WRITER for every people/ecclesia projection (see `keys.ts`).
 *
 * Two entry points, one per source entity:
 *   - `refreshPersonProjections(personId)` — called by `PersonRepository` after
 *     every write to a PROFILE / EMAIL# / PHONE# item, and by the backfill.
 *   - `refreshEcclesiaProjections(key)` / `removeEcclesiaProjections(id)` —
 *     called by the ecclesia write path in `apps/next/utils/dynamodb/locations.ts`,
 *     and by the backfill.
 *
 * Both re-derive the projection from the source as it is NOW (consistent
 * read) and apply only the difference, so they are idempotent and self-healing:
 * a missed or failed refresh is repaired by the next write or by the backfill.
 *
 * They never write a source item: every put/delete goes through
 * `assertProjectionKey`.
 */
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { docClient, tableNames } from '../config'
import {
  type EcclesiaSource,
  type ProjectionDiff,
  type ProjectionItem,
  type ProfileSource,
  ECCLESIA_ALIAS_SK,
  INDEX_META_PK,
  INDEX_META_SK,
  OFFICE_PREFIX,
  PROJECTION_SCHEMA_VERSION,
  deriveEcclesiaProjections,
  derivePersonProjections,
  diffProjections,
  ecclesiaIdOf,
  ecclesiaIdPk,
  isEcclesiaWriterItem,
  isPersonWriterItem,
  isProjectionKey,
  slugifyEcclesia,
} from './keys'

const TABLE = tableNames.admin

export function projectionWritesEnabled(): boolean {
  return process.env.PEOPLE_INDEX_WRITES !== 'off'
}

function assertProjectionKey(item: { pkey: string; skey: string }) {
  if (!isProjectionKey(item)) {
    throw new Error(`people-index: refusing to write non-projection key ${item.pkey} / ${item.skey}`)
  }
}

async function queryPartition(pkey: string, skPrefix?: string): Promise<ProjectionItem[]> {
  const out: ProjectionItem[] = []
  let lastKey: Record<string, any> | undefined
  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: skPrefix ? 'pkey = :pk AND begins_with(skey, :sk)' : 'pkey = :pk',
        ExpressionAttributeValues: skPrefix ? { ':pk': pkey, ':sk': skPrefix } : { ':pk': pkey },
        ConsistentRead: true,
        ExclusiveStartKey: lastKey,
      })
    )
    out.push(...((result?.Items || []) as ProjectionItem[]))
    lastKey = result?.LastEvaluatedKey
  } while (lastKey)
  return out
}

async function getItem(pkey: string, skey: string): Promise<ProjectionItem | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE, Key: { pkey, skey }, ConsistentRead: true })
  )
  return (result?.Item as ProjectionItem) || null
}

export async function applyProjectionDiff(diff: ProjectionDiff): Promise<void> {
  const projectedAt = new Date().toISOString()
  for (const item of diff.puts) {
    assertProjectionKey(item)
    await docClient.send(new PutCommand({ TableName: TABLE, Item: { ...item, projectedAt } }))
  }
  for (const key of diff.deletes) {
    assertProjectionKey(key)
    await docClient.send(new DeleteCommand({ TableName: TABLE, Key: { pkey: key.pkey, skey: key.skey } }))
  }
}

// ---------------------------------------------------------------------------
// Ecclesia name → stable id
// ---------------------------------------------------------------------------

const ID_CACHE_TTL_MS = 60 * 1000
const idCache = new Map<string, { id: string; expires: number }>()

export function clearEcclesiaIdCache() {
  idCache.clear()
}

/**
 * Resolve a person's free-text `ecclesia` to the ecclesia's stable id. A name
 * that is not (or no longer) an ECCLESIA item resolves to its slug, which is
 * also what an ecclesia created under that name was given as its id.
 */
export async function resolveEcclesiaId(name: string | undefined | null): Promise<string> {
  const key = (name || '').trim()
  if (!key) return slugifyEcclesia('')
  const hit = idCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.id
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: { ':pk': `ECCLESIA#${key}` },
    })
  )
  const item = (result?.Items || []).find((i: any) => i.type === 'ECCLESIA') as
    | { ecclesiaId?: string; name?: string }
    | undefined
  const id = item ? ecclesiaIdOf(item) : slugifyEcclesia(key)
  idCache.set(key, { id, expires: Date.now() + ID_CACHE_TTL_MS })
  return id
}

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------

export async function refreshPersonProjections(
  personId: string,
  opts: { dryRun?: boolean } = {}
): Promise<ProjectionDiff> {
  const pkey = `PERSON#${personId}`
  const partition = await queryPartition(pkey)
  const profile = (partition.find((i) => i.skey === 'PROFILE') as unknown as ProfileSource) || null
  const emails = partition.filter((i) => i.skey.startsWith('EMAIL#')) as any[]
  const phones = partition.filter((i) => i.skey.startsWith('PHONE#')) as any[]

  const existing = partition.filter(isPersonWriterItem)
  // The ECCLESIA-side half of each REP reference this person holds (or held):
  // read it rather than assume it, so a half-written pair is repaired.
  const repInverse = existing.filter((i) => i.skey.startsWith(OFFICE_PREFIX))
  const ecclesiaIds = new Set(repInverse.map((i) => i.ecclesiaId as string))

  const ecclesiaId = await resolveEcclesiaId(profile?.ecclesia)
  const desired = derivePersonProjections({
    profile: profile ? { ...profile, personId: profile.personId || personId } : null,
    emails,
    phones,
    ecclesiaId,
  })
  if (profile?.isInterEcclesiaRep) ecclesiaIds.add(ecclesiaId)

  for (const eid of ecclesiaIds) {
    const forward = await getItem(ecclesiaIdPk(eid), `${OFFICE_PREFIX}REP#${personId}`)
    if (forward) existing.push(forward)
  }

  const diff = diffProjections(existing, desired)
  if (!opts.dryRun) await applyProjectionDiff(diff)
  return diff
}

// ---------------------------------------------------------------------------
// Ecclesia
// ---------------------------------------------------------------------------

export interface EcclesiaRefreshResult extends ProjectionDiff {
  ecclesiaId: string | null
  /** Another ecclesia already holds this id; nothing was written. */
  collision?: { ecclesiaPkey: string; ecclesiaSkey: string }
}

async function existingEcclesiaWriterItems(ecclesiaId: string, extraRbPersonIds: string[] = []) {
  const own = (await queryPartition(ecclesiaIdPk(ecclesiaId))).filter(isEcclesiaWriterItem)
  const rbPersonIds = new Set<string>(extraRbPersonIds)
  for (const i of own) {
    if (i.skey.startsWith(`${OFFICE_PREFIX}RB#`)) rbPersonIds.add(i.personId as string)
  }
  const items = [...own]
  for (const pid of rbPersonIds) {
    const inverse = await getItem(`PERSON#${pid}`, `${OFFICE_PREFIX}${ecclesiaId}#RB`)
    if (inverse) items.push(inverse)
  }
  return items
}

/** Re-derive one ecclesia's projections from its ECCLESIA item. */
export async function refreshEcclesiaProjections(
  key: { pkey: string; skey: string },
  opts: { dryRun?: boolean } = {}
): Promise<EcclesiaRefreshResult> {
  clearEcclesiaIdCache()
  const source = (await getItem(key.pkey, key.skey)) as unknown as EcclesiaSource | null
  if (!source || (source as any).type !== 'ECCLESIA') {
    return { ecclesiaId: null, puts: [], deletes: [], unchanged: 0 }
  }
  const ecclesiaId = ecclesiaIdOf(source)

  const alias = await getItem(ecclesiaIdPk(ecclesiaId), ECCLESIA_ALIAS_SK)
  if (alias && (alias.ecclesiaPkey !== key.pkey || alias.ecclesiaSkey !== key.skey)) {
    // The id is taken. If the ecclesia it points at still exists this is a
    // real collision (two names with one slug): refuse rather than steal it.
    const other = await getItem(alias.ecclesiaPkey, alias.ecclesiaSkey)
    if (other) {
      console.error(`people-index: ecclesia id "${ecclesiaId}" is already held by another ecclesia; not re-pointing`)
      return {
        ecclesiaId,
        puts: [],
        deletes: [],
        unchanged: 0,
        collision: { ecclesiaPkey: alias.ecclesiaPkey, ecclesiaSkey: alias.ecclesiaSkey },
      }
    }
  }

  const desired = deriveEcclesiaProjections(source, ecclesiaId)
  const newRb = source.recordingBrotherPersonId ? [source.recordingBrotherPersonId] : []
  const existing = await existingEcclesiaWriterItems(ecclesiaId, newRb)
  const diff = diffProjections(existing, desired)
  if (!opts.dryRun) await applyProjectionDiff(diff)
  return { ecclesiaId, ...diff }
}

/**
 * Remove an ecclesia's projections after its ECCLESIA item is deleted. Only
 * when the alias still points at the deleted item — a rename has already
 * re-pointed it at the new one.
 */
export async function removeEcclesiaProjections(
  ecclesiaId: string,
  deletedKey: { pkey: string; skey: string }
): Promise<ProjectionDiff> {
  clearEcclesiaIdCache()
  const alias = await getItem(ecclesiaIdPk(ecclesiaId), ECCLESIA_ALIAS_SK)
  if (alias && (alias.ecclesiaPkey !== deletedKey.pkey || alias.ecclesiaSkey !== deletedKey.skey)) {
    return { puts: [], deletes: [], unchanged: 0 }
  }
  const existing = await existingEcclesiaWriterItems(ecclesiaId)
  const diff = diffProjections(existing, [])
  await applyProjectionDiff(diff)
  return diff
}

// ---------------------------------------------------------------------------
// Build marker
// ---------------------------------------------------------------------------

export async function writeIndexMarker(counts: Record<string, number>): Promise<void> {
  const item = {
    pkey: INDEX_META_PK,
    skey: INDEX_META_SK,
    type: 'PEOPLE_INDEX_META',
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    builtAt: new Date().toISOString(),
    counts,
  }
  assertProjectionKey(item)
  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }))
}
