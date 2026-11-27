import { DynamoDBDocument, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../email/sesClient'
import {
  ecclesiaIdOf,
  findEcclesiaByRecordingBrotherEmail,
  getEcclesiaById,
  getEcclesiaItems,
  listEcclesiaDirectory,
  projectionWritesEnabled,
  refreshEcclesiaProjections,
  removeEcclesiaProjections,
  slugifyEcclesia,
  batchGetItems,
} from '@my/app/provider/dynamodb/people-index'
import {
  deriveOfficeFlags,
  isTestAccountEmail,
  officeRepository,
  OFFICE_ROLES,
} from '@my/app/provider/dynamodb/repositories/office-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { PATTERNS, patternQuery } from '@my/app/provider/dynamodb/access-patterns'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import type { ScheduleTypeKey } from '@my/app/config/schedule-fields'
import { ClosedEcclesiaError, isActiveEcclesia, normalizeEcclesiaName, type EcclesiaStatus } from '@my/app/utils/ecclesia-name'

const dbClientConfig = getAwsDbConfig()
const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

const TABLE_NAME = 'tee-admin'

export interface LocationData {
  code: string
  name: string
  country: string
  type: 'country' | 'province' | 'state'
}

export type ServiceType = 'memorial' | 'bible_class' | 'cyc' | 'sunday_school' | 'other'

/**
 * @deprecated Use scheduleConfig with ServiceTimeDef instead.
 * Worship services are now derived from the schedule configuration system.
 * This type will be removed in a future cleanup pass.
 */
export interface EcclesiaService {
  id: string
  name: string
  type: ServiceType
  day?: string
  time?: string
  location?: string
}

export interface EcclesiaExternalLinks {
  newsletterUrl?: string
  youtube?: string
  facebook?: string
  otherLinks?: Array<{ label: string; url: string }>
}

/**
 * Per-ecclesia schedule configuration.
 * Controls which schedule types (tabs) are enabled and which fields are
 * visible/labeled for each type.  Stored as a JSON attribute on the
 * ECCLESIA# record so it round-trips with every ecclesia read/write.
 */
// One definition (packages/app/config/schedule-fields.ts); re-exported here
// for existing importers of this module.
export type { ScheduleTypeKey }

export interface ScheduleFieldConfig {
  key: string            // DB field name — consistent across all ecclesias
  label: string          // Display label — customizable per ecclesia
  enabled: boolean       // Whether to show this field
}

export interface ScheduleTypeConfig {
  enabled: boolean                // Show this tab?
  label: string                   // Tab display name (e.g. "Breaking of Bread" vs "Memorial Service")
  fields: ScheduleFieldConfig[]   // Ordered list of fields for this schedule type
  serviceTime?: {                 // When/where this service meets (per-ecclesia override)
    timezone: string              // IANA timezone, e.g. "America/Toronto"
    location: string              // "Main Hall", "Fellowship Hall", etc.
    schedule: Array<{             // Seasonal time periods (first = default, additional = overrides)
      label?: string              // "Regular", "Summer Hours"
      startMonth?: number         // 1=Jan, 12=Dec — omit for year-round default
      endMonth?: number           // 1=Jan, 12=Dec — omit for year-round default
      defaultTime: string         // "11:00" (24h format)
      displayTime: string         // "11:00 AM"
      expectedDayOfWeek: number   // 0=Sunday, 1=Monday, ..., 6=Saturday
    }>
  }
}

export type EcclesiaScheduleConfig = Record<ScheduleTypeKey, ScheduleTypeConfig>

export interface EcclesiaData {
  /**
   * Stable id (slug). Set at creation and carried across renames, so posts and
   * people can reference an ecclesia without depending on its display name.
   * Items written before ids existed read back with the slug of their name.
   */
  ecclesiaId?: string
  name: string
  country: string
  province: string
  city: string
  address?: string
  postalCode?: string
  venue?: string
  phone?: string
  contactEmail?: string
  // The Recording Brother is an OFFICE (`officeRepository`, R3), never a copied
  // name/email on this record. Read it with `recordingBrotherOf()` (utils/ecclesia-offices).
  /** @deprecated Use scheduleConfig instead — services are derived from schedule types */
  services?: EcclesiaService[]
  website?: string
  externalLinks?: EcclesiaExternalLinks
  region?: string
  newsletterEnabled?: boolean
  logoUrl?: string
  scheduleConfig?: EcclesiaScheduleConfig
  // Multi-tenant event sharing
  timezone?: string
  latitude?: number
  longitude?: number
  locationSource?: 'address' | 'city' | 'manual'
  sharingPreference?: 'open' | 'subscribers-only' | 'private'
  excludedEcclesias?: string[]
  rbAlertPreference?: 'all' | 'major' | 'none'
  sharingRadiusKm?: number  // 100–1000 in 100km steps, or omit for default (300km)
  nearbyEcclesias?: string[]
  /**
   * Closed ecclesias stay findable (directory, search, history) with a
   * "Closed {year}" badge, but are never chosen or sent to. Missing = active.
   */
  status?: EcclesiaStatus
  closedYear?: number
  closedNote?: string
  /**
   * A made-up TEST ecclesia for preview sign-in (#349). Hidden from every list,
   * picker, search, sharing and send; only a direct lookup by name finds it.
   */
  isTest?: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * Drop made-up test ecclesias (#349). Every ecclesia LIST (directory, pickers,
 * search, sharing, mailing-list owners) goes through `getEcclesiasFromIndex`
 * or the province/city queries, which call this. Lookup by exact name is not
 * filtered: the seed script and test sign-in need it.
 */
export function withoutTestEcclesias<T extends { isTest?: boolean }>(list: T[]): T[] {
  return list.filter((e) => e.isTest !== true)
}

/** Another ecclesia already has this name once generic endings are ignored ("Brantford" vs "Brantford Ecclesia"). */
export class EcclesiaNameConflictError extends Error {
  constructor(public readonly requestedName: string, public readonly existingName: string) {
    super(`An ecclesia named "${existingName}" already exists; "${requestedName}" would be a duplicate of it.`)
    this.name = 'EcclesiaNameConflictError'
  }
}

// Location functions
export async function createCountry(data: { code: string; name: string }): Promise<void> {
  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `LOCATION#COUNTRY`,
      skey: data.code,
      type: 'LOCATION',
      locationCode: data.code,
      locationName: data.name,
      locationType: 'country',
      createdAt: new Date(),
    },
  })
}

export async function createProvince(data: {
  code: string
  name: string
  countryCode: string
}): Promise<void> {
  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `LOCATION#PROVINCE#${data.countryCode}`,
      skey: data.code,
      type: 'LOCATION',
      locationCode: data.code,
      locationName: data.name,
      locationType: 'province',
      country: data.countryCode,
      createdAt: new Date(),
    },
  })
}

export async function getCountries(): Promise<LocationData[]> {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pkey = :pk',
      ExpressionAttributeValues: {
        ':pk': 'LOCATION#COUNTRY',
      },
    })

    if (!result.Items) return []

    return result.Items.map((item) => ({
      code: item.locationCode,
      name: item.locationName,
      country: item.locationCode,
      type: 'country' as const,
    })).sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Error getting countries:', error)
    return []
  }
}

export async function getProvinces(countryCode: string): Promise<LocationData[]> {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pkey = :pk',
      ExpressionAttributeValues: {
        ':pk': `LOCATION#PROVINCE#${countryCode}`,
      },
    })

    if (!result.Items) return []

    return result.Items.map((item) => ({
      code: item.locationCode,
      name: item.locationName,
      country: countryCode,
      type: 'province' as const,
    })).sort((a, b) => a.name.localeCompare(b.name))
  } catch (error) {
    console.error('Error getting provinces:', error)
    return []
  }
}

// Helper to map a DynamoDB item to EcclesiaData
function mapItemToEcclesia(item: Record<string, any>): EcclesiaData {
  return {
    ecclesiaId: ecclesiaIdOf(item),
    name: item.name,
    country: item.country,
    province: item.province,
    city: item.city,
    address: item.address,
    postalCode: item.postalCode,
    venue: item.venue,
    phone: item.phone,
    contactEmail: item.contactEmail,
    services: item.services,
    website: item.website,
    externalLinks: item.externalLinks,
    region: item.region,
    newsletterEnabled: item.newsletterEnabled,
    logoUrl: item.logoUrl,
    scheduleConfig: item.scheduleConfig,
    timezone: item.timezone,
    latitude: item.latitude,
    longitude: item.longitude,
    locationSource: item.locationSource,
    sharingPreference: item.sharingPreference,
    excludedEcclesias: item.excludedEcclesias,
    rbAlertPreference: item.rbAlertPreference,
    sharingRadiusKm: item.sharingRadiusKm,
    nearbyEcclesias: item.nearbyEcclesias,
    status: item.status,
    closedYear: item.closedYear,
    closedNote: item.closedNote,
    isTest: item.isTest === true ? true : undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

/**
 * Keep the ecclesia projections (stable-id alias, directory entry, RB office
 * reference) in step with the ECCLESIA item just written. This module is the
 * ecclesia's only write path, so it is the projections' only writer.
 * Never fails the source write: drift is repaired by the next write or by
 * scripts/rebuild-people-projections.ts.
 */
async function syncEcclesiaProjections(key: { pkey: string; skey: string }): Promise<void> {
  if (!projectionWritesEnabled()) return
  try {
    await refreshEcclesiaProjections(key)
  } catch (error) {
    console.error(`people-index: ecclesia projection refresh failed for ${key.pkey} / ${key.skey}`, error)
  }
}

async function dropEcclesiaProjections(ecclesiaId: string, key: { pkey: string; skey: string }): Promise<void> {
  if (!projectionWritesEnabled()) return
  try {
    await removeEcclesiaProjections(ecclesiaId, key)
  } catch (error) {
    console.error(`people-index: ecclesia projection removal failed for ${ecclesiaId}`, error)
  }
}

const ecclesiaKey = (e: { country: string; province: string; city: string; name: string }) => ({
  pkey: `ECCLESIA#${e.country}|${e.province}`,
  skey: `${e.city}#${e.name}`,
})

/** Every ECCLESIA item through the directory index (Query + BatchGet). */
async function getEcclesiasFromIndex(filter: { country?: string } = {}): Promise<EcclesiaData[]> {
  const entries = await listEcclesiaDirectory(filter)
  const items = await getEcclesiaItems(entries)
  return withoutTestEcclesias(items.map(mapItemToEcclesia))
}

// Ecclesia functions
export async function createEcclesia(data: {
  ecclesiaId?: string
  name: string
  country: string
  province: string
  city: string
  address?: string
  postalCode?: string
  venue?: string
  /** A made-up test ecclesia (#349). */
  isTest?: boolean
}): Promise<EcclesiaData> {
  const now = new Date()
  const ecclesia: EcclesiaData = {
    ...data,
    ecclesiaId: data.ecclesiaId || slugifyEcclesia(data.name),
    createdAt: now,
    updatedAt: now,
  }

  // Last line of defence at the WRITE, not just at the route: these fields are
  // key material, and a record written with an empty one is invisible to every
  // read (they all filter on the geographic prefix) yet reports success. Fail
  // loudly here so a bad record can never reach the table again, whichever
  // caller is at fault.
  for (const [field, value] of [
    ['country', data.country],
    ['province', data.province],
    ['city', data.city],
    ['name', data.name],
  ] as const) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(
        `createEcclesia: '${field}' must be a non-empty string — it is part of the ` +
          `directory key, and an ecclesia saved without it cannot be listed or searched.`
      )
    }
  }

  // Duplicate prevention by MEANING, across every record: "Brantford" and
  // "Brantford Ecclesia" are one ecclesia, whatever city or province each was
  // filed under. (The key condition below only ever stopped an identical key.)
  const [duplicate] = await findEcclesiasMatchingName(data.name)
  if (duplicate) throw new EcclesiaNameConflictError(data.name, duplicate.name)

  await client.put({
    TableName: TABLE_NAME,
    Item: {
      ...sourceItemKeys(data),
      ...ecclesia,
    },
    ConditionExpression: 'attribute_not_exists(pkey)',
  })

  invalidateEcclesiaCache()
  await syncEcclesiaProjections(ecclesiaKey(data))
  return ecclesia
}

/** The key + index attributes of an ECCLESIA source item. */
function sourceItemKeys(e: { country: string; province: string; city: string; name: string }) {
  return {
    // Geographic hierarchy in the base key for geographic queries
    ...ecclesiaKey(e),
    type: 'ECCLESIA',
    // GSI1 for name-based lookups
    gsi1pk: PATTERNS.ecclesiaByName.pk({ name: e.name }),
    gsi1sk: `${e.country}|${e.province}|${e.city}`,
  }
}

/**
 * Every ecclesia whose name means the same as `name` once generic endings are
 * ignored (`normalizeEcclesiaName`). Reads the directory index fresh (not the
 * picker cache): duplicate checks and merges must see the latest records.
 */
export async function findEcclesiasMatchingName(
  name: string,
  opts: { excludeEcclesiaId?: string } = {}
): Promise<EcclesiaData[]> {
  const key = normalizeEcclesiaName(name)
  if (!key) return []
  const all = await getEcclesiasFromIndex()
  return all.filter(
    (e) => normalizeEcclesiaName(e.name) === key && (!opts.excludeEcclesiaId || ecclesiaIdOf(e) !== opts.excludeEcclesiaId)
  )
}

/**
 * The ecclesia called `name`. An exact stored name wins (GSI1); otherwise the
 * ONE ecclesia whose normalized name matches ("Barrie" finds "Barrie
 * Ecclesia"). Never a partial match: "Brant" does not find "Brantford" or
 * "Brant County". Two normalized matches are ambiguous → null (and logged), so
 * a caller can never silently act on the wrong record.
 */
export async function getEcclesiaByName(name: string): Promise<EcclesiaData | null> {
  try {
    if (!name || !name.trim()) return null
    const result = await client.query({
      ...patternQuery(PATTERNS.ecclesiaByName, { name }),
      Limit: 1,
    })

    if (result.Items && result.Items.length > 0) {
      return mapItemToEcclesia(result.Items[0])
    }

    const key = normalizeEcclesiaName(name)
    const matches = (await getAllEcclesiasWithCache()).filter((e) => normalizeEcclesiaName(e.name) === key)
    if (matches.length === 1) return matches[0]
    if (matches.length > 1) {
      console.warn(
        `getEcclesiaByName: "${name}" matches ${matches.length} ecclesias (${matches.map((m) => m.name).join(', ')}); refusing to guess`
      )
    }
    return null
  } catch (error) {
    console.error('Error getting ecclesia by name:', error)
    return null
  }
}

/**
 * `getEcclesiaByName` for a write that attaches a person, office or content to
 * the ecclesia: null if it doesn't exist, and a `ClosedEcclesiaError` if it is
 * closed. A name that matches no record is not this function's business (free
 * text ecclesia names are allowed for visitors); callers decide.
 */
export async function getAssignableEcclesia(name: string): Promise<EcclesiaData | null> {
  const ecclesia = await getEcclesiaByName(name)
  if (ecclesia && !isActiveEcclesia(ecclesia)) throw new ClosedEcclesiaError(ecclesia.name)
  return ecclesia
}

// Server-side cache for the ecclesia list (pickers and search)
let ecclesiaCacheData: EcclesiaData[] | null = null
let ecclesiaCacheExpiry = 0
const ECCLESIA_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function getAllEcclesiasWithCache(): Promise<EcclesiaData[]> {
  const now = Date.now()
  if (ecclesiaCacheData && now < ecclesiaCacheExpiry) {
    return ecclesiaCacheData
  }

  ecclesiaCacheData = await getEcclesiasFromIndex()
  ecclesiaCacheExpiry = now + ECCLESIA_CACHE_TTL_MS
  return ecclesiaCacheData
}

/** Every ecclesia, from the 5-minute server cache (mailing-list owner names and pickers). */
export async function listEcclesiasCached(): Promise<EcclesiaData[]> {
  return getAllEcclesiasWithCache()
}

/** Invalidate the ecclesia search cache (call after add/update/delete) */
export function invalidateEcclesiaCache() {
  ecclesiaCacheData = null
  ecclesiaCacheExpiry = 0
}

/**
 * Type-ahead over ecclesia names. Closed ecclesias are left out unless
 * `includeClosed` — pickers that ASSIGN people/content must never offer one;
 * the directory (finding an ecclesia, including that it closed) passes true.
 */
export async function searchEcclesia(
  query: string,
  limit: number = 5,
  opts: { includeClosed?: boolean } = {}
): Promise<EcclesiaData[]> {
  try {
    const allEcclesias = await getAllEcclesiasWithCache()

    // Filter items by query (case-insensitive)
    const queryLower = query.toLowerCase()
    const filteredItems = allEcclesias
      .filter(item => item.name && item.name.toLowerCase().includes(queryLower))
      .filter(item => opts.includeClosed || isActiveEcclesia(item))

    // Sort results: exact matches first, then prefix matches, then contains
    filteredItems.sort((a, b) => {
      const aLower = a.name.toLowerCase()
      const bLower = b.name.toLowerCase()

      // Exact match
      if (aLower === queryLower) return -1
      if (bLower === queryLower) return 1

      // Starts with query
      if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) return -1
      if (bLower.startsWith(queryLower) && !aLower.startsWith(queryLower)) return 1

      // Default to alphabetical
      return a.name.localeCompare(b.name)
    })

    return filteredItems.slice(0, limit)
  } catch (error) {
    console.error('Error searching ecclesia:', error)
    return []
  }
}

// New geographic query functions enabled by the new schema
export async function getEcclesiaByCountry(country: string): Promise<EcclesiaData[]> {
  try {
    return await getEcclesiasFromIndex({ country })
  } catch (error) {
    console.error('Error getting ecclesia by country:', error)
    return []
  }
}

export async function getEcclesiaByProvince(country: string, province: string): Promise<EcclesiaData[]> {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pkey = :pk',
      ExpressionAttributeValues: {
        ':pk': `ECCLESIA#${country}|${province}`,
      },
    })

    if (!result.Items) return []

    return withoutTestEcclesias(result.Items.map(mapItemToEcclesia))
  } catch (error) {
    console.error('Error getting ecclesia by province:', error)
    return []
  }
}

export async function getEcclesiaByCity(country: string, province: string, city: string): Promise<EcclesiaData[]> {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'pkey = :pk AND begins_with(skey, :city)',
      ExpressionAttributeValues: {
        ':pk': `ECCLESIA#${country}|${province}`,
        ':city': `${city}#`,
      },
    })

    if (!result.Items) return []

    return withoutTestEcclesias(result.Items.map(mapItemToEcclesia))
  } catch (error) {
    console.error('Error getting ecclesia by city:', error)
    return []
  }
}

export async function getAllEcclesia(): Promise<EcclesiaData[]> {
  try {
    return await getEcclesiasFromIndex()
  } catch (error) {
    console.error('Error getting all ecclesia:', error)
    return []
  }
}

/**
 * Remove a DUPLICATE ecclesia record after it has been merged into another.
 *
 * We never delete an ecclesia: one that stops meeting is CLOSED (status), so
 * its history keeps resolving. The only record ever removed is a merged
 * duplicate, and only the merge (utils/ecclesia-merge-service.ts) calls this.
 * It refuses unless the merge really happened: `mergedInto` must be another
 * existing ecclesia, and nothing may still point at this one (no people, no
 * offices). There is no API route or UI that reaches it.
 */
export async function deleteMergedEcclesia(name: string, opts: { mergedInto: string }): Promise<boolean> {
  try {
    // Exact stored name only: never a normalized match for a delete.
    const result = await client.query({ ...patternQuery(PATTERNS.ecclesiaByName, { name }), Limit: 1 })
    const ecclesia = result.Items?.[0] ? mapItemToEcclesia(result.Items[0]) : null
    if (!ecclesia) {
      throw new Error(`Ecclesia "${name}" not found`)
    }
    const target = opts?.mergedInto ? await getEcclesiaByName(opts.mergedInto) : null
    if (!target || ecclesiaIdOf(target) === ecclesiaIdOf(ecclesia)) {
      throw new Error(`Refusing to delete "${name}": ecclesias are closed, not deleted; only a merged duplicate is removed`)
    }
    const { personRepository } = await import('@my/app/provider/dynamodb/repositories/person-repository')
    const [people, offices] = await Promise.all([
      personRepository.listByEcclesia(ecclesia.name, { limit: 1 }),
      officeRepository.listOffices(ecclesiaIdOf(ecclesia)),
    ])
    if (people.items.length > 0 || offices.length > 0) {
      throw new Error(`Refusing to delete "${name}": people or offices still point at it; merge it first`)
    }

    // Delete the record
    await client.delete({
      TableName: TABLE_NAME,
      Key: {
        pkey: `ECCLESIA#${ecclesia.country}|${ecclesia.province}`,
        skey: `${ecclesia.city}#${ecclesia.name}`,
      },
    })

    invalidateEcclesiaCache()
    await dropEcclesiaProjections(ecclesiaIdOf(ecclesia), ecclesiaKey(ecclesia))
    return true
  } catch (error) {
    console.error('Error deleting ecclesia:', error)
    throw error
  }
}

/**
 * Edit an ecclesia's name/location (and address/postal code/venue).
 *
 * A change to name, city, province or country moves the record to a new key.
 * That is ONE TransactWrite — Put the new item (every attribute of the old one
 * carried over, plus the changed fields) and Delete the old key, both
 * conditioned — so the record can never be lost half-way, and nothing on it
 * (phone, website, schedule config, sharing, closed status…) is dropped. The
 * stable id is persisted on the new item (`ecclesiaId` = the id it had), so
 * offices, people cards, mailing lists and the schedule registry keep
 * resolving. Any other edit updates in place; it never deletes anything.
 */
export async function updateEcclesia(
  originalName: string,
  data: {
    name: string
    country: string
    province: string
    city: string
    address?: string
    postalCode?: string
    venue?: string
  }
): Promise<EcclesiaData | null> {
  try {
    const original = await getEcclesiaByName(originalName)
    if (!original) {
      throw new Error(`Ecclesia "${originalName}" not found`)
    }

    for (const [field, value] of [
      ['country', data.country],
      ['province', data.province],
      ['city', data.city],
      ['name', data.name],
    ] as const) {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`updateEcclesia: '${field}' must be a non-empty string — it is part of the directory key.`)
      }
    }

    const oldKey = ecclesiaKey(original)
    const keyChanged =
      original.country !== data.country ||
      original.province !== data.province ||
      original.city !== data.city ||
      original.name !== data.name
    const now = new Date()

    if (!keyChanged) {
      await client.update({
        TableName: TABLE_NAME,
        Key: oldKey,
        UpdateExpression: 'SET address = :address, postalCode = :postalCode, venue = :venue, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':address': data.address || '',
          ':postalCode': data.postalCode || '',
          ':venue': data.venue || '',
          ':updatedAt': now.toISOString(),
        },
      })

      invalidateEcclesiaCache()
      await syncEcclesiaProjections(oldKey)
      return { ...original, address: data.address, postalCode: data.postalCode, venue: data.venue, updatedAt: now }
    }

    const ecclesiaId = ecclesiaIdOf(original)
    if (original.name !== data.name) {
      const [duplicate] = await findEcclesiasMatchingName(data.name, { excludeEcclesiaId: ecclesiaId })
      if (duplicate) throw new EcclesiaNameConflictError(data.name, duplicate.name)
    }

    // The whole stored item, not the mapped view: attributes the app no longer
    // maps (legacy copies, anything added later) must survive the move too.
    const stored = (await client.get({ TableName: TABLE_NAME, Key: oldKey })).Item
    if (!stored) throw new Error(`Ecclesia "${originalName}" not found`)

    const moved: Record<string, any> = {
      ...stored,
      ...sourceItemKeys(data),
      name: data.name,
      country: data.country,
      province: data.province,
      city: data.city,
      ecclesiaId,
      updatedAt: now.toISOString(),
    }
    if (data.address !== undefined) moved.address = data.address
    if (data.postalCode !== undefined) moved.postalCode = data.postalCode
    if (data.venue !== undefined) moved.venue = data.venue

    await client.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE_NAME, Item: moved, ConditionExpression: 'attribute_not_exists(pkey)' } },
          { Delete: { TableName: TABLE_NAME, Key: oldKey, ConditionExpression: 'attribute_exists(pkey)' } },
        ],
      })
    )

    invalidateEcclesiaCache()
    // The alias follows the stable id to the new key.
    await syncEcclesiaProjections(ecclesiaKey(data))
    return mapItemToEcclesia(moved)
  } catch (error) {
    console.error('Error updating ecclesia:', error)
    throw error
  }
}

export async function updateEcclesiaFields(
  name: string,
  updates: {
    phone?: string
    contactEmail?: string
    address?: string
    venue?: string
    postalCode?: string
    services?: EcclesiaService[]
    website?: string
    externalLinks?: EcclesiaExternalLinks
    region?: string
    newsletterEnabled?: boolean
    logoUrl?: string
    scheduleConfig?: EcclesiaScheduleConfig
    timezone?: string
    latitude?: number
    longitude?: number
    locationSource?: 'address' | 'city' | 'manual'
    sharingPreference?: 'open' | 'subscribers-only' | 'private'
    excludedEcclesias?: string[]
    rbAlertPreference?: 'all' | 'major' | 'none'
    sharingRadiusKm?: number
    nearbyEcclesias?: string[]
    /** Owner/admin only (the route enforces it). Reopen with status 'active' + nulls. */
    status?: EcclesiaStatus
    closedYear?: number | null
    closedNote?: string | null
  }
): Promise<EcclesiaData | null> {
  try {
    const ecclesia = await getEcclesiaByName(name)
    if (!ecclesia) {
      throw new Error(`Ecclesia "${name}" not found`)
    }

    const expressions: string[] = ['updatedAt = :updatedAt']
    const values: Record<string, any> = { ':updatedAt': new Date().toISOString() }
    const names: Record<string, string> = {}

    const fieldMap: Array<{ key: string; attr: string; exprName?: string }> = [
      { key: 'phone', attr: ':phone' },
      { key: 'contactEmail', attr: ':contactEmail' },
      { key: 'address', attr: ':address' },
      { key: 'venue', attr: ':venue' },
      { key: 'postalCode', attr: ':postalCode' },
      { key: 'services', attr: ':services' },
      { key: 'website', attr: ':website' },
      { key: 'externalLinks', attr: ':externalLinks' },
      { key: 'region', attr: ':region' },
      { key: 'newsletterEnabled', attr: ':newsletterEnabled' },
      { key: 'logoUrl', attr: ':logoUrl' },
      { key: 'scheduleConfig', attr: ':scheduleConfig' },
      { key: 'timezone', attr: ':timezone' },
      { key: 'latitude', attr: ':latitude' },
      { key: 'longitude', attr: ':longitude' },
      { key: 'locationSource', attr: ':locationSource' },
      { key: 'sharingPreference', attr: ':sharingPreference' },
      { key: 'excludedEcclesias', attr: ':excludedEcclesias' },
      { key: 'rbAlertPreference', attr: ':rbAlertPreference' },
      { key: 'sharingRadiusKm', attr: ':sharingRadiusKm' },
      { key: 'nearbyEcclesias', attr: ':nearbyEcclesias' },
      { key: 'status', attr: ':status', exprName: '#status' },
      { key: 'closedYear', attr: ':closedYear' },
      { key: 'closedNote', attr: ':closedNote' },
    ]

    for (const { key, attr, exprName } of fieldMap) {
      if ((updates as any)[key] !== undefined) {
        // `status` is a DynamoDB reserved word: it needs a name placeholder.
        if (exprName) names[exprName] = key
        expressions.push(`${exprName || key} = ${attr}`)
        values[attr] = (updates as any)[key] ?? null
      }
    }

    await client.update({
      TableName: TABLE_NAME,
      Key: {
        pkey: `ECCLESIA#${ecclesia.country}|${ecclesia.province}`,
        skey: `${ecclesia.city}#${ecclesia.name}`,
      },
      UpdateExpression: `SET ${expressions.join(', ')}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
    })

    invalidateEcclesiaCache()
    await syncEcclesiaProjections(ecclesiaKey(ecclesia))
    return {
      ...ecclesia,
      ...updates,
      closedYear: updates.closedYear === null ? undefined : (updates.closedYear ?? ecclesia.closedYear),
      closedNote: updates.closedNote === null ? undefined : (updates.closedNote ?? ecclesia.closedNote),
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('Error updating ecclesia fields:', error)
    throw error
  }
}

/**
 * PRE-CUTOVER ONLY: the Recording Brother name/email that older code copied
 * onto ECCLESIA items. Nothing writes these any more; the office is the source
 * (R3). `recordingBrotherOf()` reads this only for an ecclesia that has no
 * Recording Brother office yet AND only before the owner-confirmed office
 * assignments are applied (`OFFICES#META / ASSIGNED`). Deleted with the data in R8.
 */
export interface LegacyRecordingBrotherCopy {
  email?: string
  name?: string
  personId?: string
}

export async function legacyRecordingBrotherCopies(
  ecclesias: EcclesiaData[]
): Promise<Map<string, LegacyRecordingBrotherCopy>> {
  const out = new Map<string, LegacyRecordingBrotherCopy>()
  const keyed = ecclesias.filter((e) => e.country && e.province && e.city && e.name)
  if (keyed.length === 0) return out
  const items = await batchGetItems<Record<string, any>>(keyed.map((e) => ecclesiaKey(e)))
  for (const item of items) {
    const copy = legacyCopyOf(item)
    if (copy) out.set(ecclesiaIdOf(item), copy)
  }
  return out
}

function legacyCopyOf(item: Record<string, any>): LegacyRecordingBrotherCopy | null {
  const email = String(item.recordingBrotherEmail || '').trim().toLowerCase() || undefined
  const name = String(item.recordingBrotherName || '').trim() || undefined
  const personId = String(item.recordingBrotherPersonId || '').trim() || undefined
  if (!email && !name && !personId) return null
  if (email && isTestAccountEmail(email)) return null
  return { email, name, personId }
}

/** Pre-cutover sign-in fallback: the copied RB email, by its RBEMAIL# index entry. */
async function legacyEcclesiaByRecordingBrotherEmail(email: string): Promise<RecordingBrotherEcclesia | null> {
  const entry = await findEcclesiaByRecordingBrotherEmail(email)
  if (!entry) return null
  const result = await client.get({ TableName: TABLE_NAME, Key: { pkey: entry.ecclesiaPkey, skey: entry.ecclesiaSkey } })
  return result.Item ? { ...mapItemToEcclesia(result.Item), rbHolderName: legacyCopyOf(result.Item)?.name } : null
}

/** An ecclesia found by a Recording Brother address, plus the RB's name when one is known. */
export type RecordingBrotherEcclesia = EcclesiaData & { rbHolderName?: string }

/**
 * Sign-in's Recording Brother check for an address with no PersonRecord.
 *
 * Launch-dark behind `people_index_signin` (released to everyone): the
 * Recording Brother OFFICE whose own inbox is this address decides — whoever
 * can read the inbox can sign in with it. Once the owner-confirmed assignments
 * are applied (offices marker) the offices are the only source; before that the
 * legacy RB-email index entry is the fallback; it is also what is used with the
 * flag off or on any error. A wrong answer makes a Recording Brother a guest.
 */
export async function findRecordingBrotherEcclesia(email: string): Promise<RecordingBrotherEcclesia | null> {
  if (isTestAccountEmail(email)) return null
  try {
    if (await checkFeatureFlagFromDB(FEATURE_FLAGS.PEOPLE_INDEX_SIGNIN, null)) {
      const offices = (await officeRepository.findOfficesByEmail(email))
        .filter((o) => o.kind === OFFICE_ROLES.RECORDING_BROTHER)
        .sort((a, b) => a.ecclesiaId.localeCompare(b.ecclesiaId))
      for (const office of offices) {
        const entry = await getEcclesiaById(office.ecclesiaId)
        if (!entry) continue
        const found = await client.get({ TableName: TABLE_NAME, Key: { pkey: entry.ecclesiaPkey, skey: entry.ecclesiaSkey } })
        if (!found.Item) continue
        const view = await officeRepository.getOfficeWithHolder(office.ecclesiaId, office.role)
        return { ...mapItemToEcclesia(found.Item), rbHolderName: view?.holder?.displayName?.trim() || undefined }
      }
      if (await officeRepository.officesAssigned()) return null
    }
  } catch (error) {
    console.error('offices: sign-in RB lookup failed; using the legacy RB-email index', error)
  }
  try {
    return await legacyEcclesiaByRecordingBrotherEmail(email)
  } catch (error) {
    console.error('Error looking up ecclesia by recording brother email:', error)
    return null
  }
}

/**
 * Sign-in's Recording Brother / Rep designation for a known person.
 *
 * Launch-dark, like `findRecordingBrotherEcclesia`: offices decide only when
 * the `people_index_signin` flag is on for everyone AND the owner-confirmed
 * assignments have been applied (the offices marker). Then the flags are
 * DERIVED from the offices the person holds plus any office whose own inbox is
 * the address they signed in with (whoever can read the inbox can sign in with
 * it). Otherwise — or on any error — the stored person flags are used, as today.
 */
export async function signInOfficeFlags(
  person: { personId: string; isRecordingBrother?: boolean; isInterEcclesiaRep?: boolean },
  signInEmail: string
): Promise<{ isRecordingBrother: boolean; isInterEcclesiaRep: boolean }> {
  const legacy = { isRecordingBrother: !!person.isRecordingBrother, isInterEcclesiaRep: !!person.isInterEcclesiaRep }
  try {
    if (
      !(await checkFeatureFlagFromDB(FEATURE_FLAGS.PEOPLE_INDEX_SIGNIN, null)) ||
      !(await officeRepository.officesAssigned())
    ) {
      return legacy
    }
    if (isTestAccountEmail(signInEmail)) return { isRecordingBrother: false, isInterEcclesiaRep: false }
    const [held, byInbox] = await Promise.all([
      officeRepository.listOfficesHeldBy(person.personId),
      officeRepository.findOfficesByEmail(signInEmail),
    ])
    const { isRecordingBrother, isInterEcclesiaRep } = deriveOfficeFlags([...held, ...byInbox])
    return { isRecordingBrother, isInterEcclesiaRep }
  } catch (error) {
    console.error('offices: sign-in office lookup failed; using stored person flags', error)
    return legacy
  }
}

// Initialization function to populate Canadian provinces
export async function initializeCanadianProvinces(): Promise<void> {
  const provinces = [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'YT', name: 'Yukon' },
  ]

  // First create Canada country
  await createCountry({ code: 'CA', name: 'Canada' })

  // Then create all provinces
  for (const province of provinces) {
    await createProvince({
      code: province.code,
      name: province.name,
      countryCode: 'CA',
    })
  }

  console.log('✅ Canadian provinces initialized in DynamoDB')
}