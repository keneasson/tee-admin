import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../email/sesClient'

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
export type ScheduleTypeKey = 'memorial' | 'bibleClass' | 'sundaySchool' | 'cyc'

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
  name: string
  country: string
  province: string
  city: string
  address?: string
  postalCode?: string
  venue?: string
  phone?: string
  contactEmail?: string
  recordingBrotherEmail?: string
  recordingBrotherName?: string
  recordingBrotherPersonId?: string  // Hard link to PersonRecord
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
  createdAt: Date
  updatedAt: Date
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
    name: item.name,
    country: item.country,
    province: item.province,
    city: item.city,
    address: item.address,
    postalCode: item.postalCode,
    venue: item.venue,
    phone: item.phone,
    contactEmail: item.contactEmail,
    recordingBrotherEmail: item.recordingBrotherEmail,
    recordingBrotherName: item.recordingBrotherName,
    recordingBrotherPersonId: item.recordingBrotherPersonId,
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
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

// Ecclesia functions
export async function createEcclesia(data: {
  name: string
  country: string
  province: string
  city: string
  address?: string
  postalCode?: string
  venue?: string
}): Promise<EcclesiaData> {
  const now = new Date()
  const ecclesia: EcclesiaData = {
    ...data,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await client.put({
      TableName: TABLE_NAME,
      Item: {
        // New schema: Geographic hierarchy in PK for efficient geographic queries
        pkey: `ECCLESIA#${data.country}|${data.province}`,
        skey: `${data.city}#${data.name}`,
        type: 'ECCLESIA',
        // GSI1 for name-based lookups
        gsi1pk: `ECCLESIA#${data.name}`,
        gsi1sk: `${data.country}|${data.province}|${data.city}`,
        ...ecclesia,
      },
      ConditionExpression: 'attribute_not_exists(gsi1pk)', // Prevent duplicate names
    })

    invalidateEcclesiaCache()
    return ecclesia
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      // Ecclesia already exists - fetch and return the existing one
      const existing = await getEcclesiaByName(data.name)
      if (existing) {
        return existing
      }
      throw new Error(`Ecclesia "${data.name}" already exists but could not be retrieved`)
    }
    throw error
  }
}

// Helper function to get ecclesia by name using GSI1
// Falls back to fuzzy search if exact name match fails (handles typos like "Ecclesial" vs "Ecclesia")
export async function getEcclesiaByName(name: string): Promise<EcclesiaData | null> {
  try {
    // Try exact match first
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `ECCLESIA#${name}`,
      },
      Limit: 1
    })

    if (result.Items && result.Items.length > 0) {
      return mapItemToEcclesia(result.Items[0])
    }

    // Fallback: fuzzy search (handles minor name mismatches from Google Sheets)
    const fuzzyResults = await searchEcclesia(name, 1)
    if (fuzzyResults.length > 0) {
      console.log(`⚠️ Ecclesia "${name}" not found exactly, matched "${fuzzyResults[0].name}" via fuzzy search`)
      return fuzzyResults[0]
    }

    return null
  } catch (error) {
    console.error('Error getting ecclesia by name:', error)
    return null
  }
}

// Server-side cache for ecclesia list (avoids full table scan on every search)
let ecclesiaCacheData: EcclesiaData[] | null = null
let ecclesiaCacheExpiry = 0
const ECCLESIA_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function getAllEcclesiasWithCache(): Promise<EcclesiaData[]> {
  const now = Date.now()
  if (ecclesiaCacheData && now < ecclesiaCacheExpiry) {
    return ecclesiaCacheData
  }

  const result = await client.scan({
    TableName: TABLE_NAME,
    IndexName: 'gsi1',
    FilterExpression: 'begins_with(gsi1pk, :prefix)',
    ExpressionAttributeValues: {
      ':prefix': 'ECCLESIA#',
    },
  })

  ecclesiaCacheData = (result.Items || []).map(mapItemToEcclesia)
  ecclesiaCacheExpiry = now + ECCLESIA_CACHE_TTL_MS
  return ecclesiaCacheData
}

/** Invalidate the ecclesia search cache (call after add/update/delete) */
export function invalidateEcclesiaCache() {
  ecclesiaCacheData = null
  ecclesiaCacheExpiry = 0
}

export async function searchEcclesia(query: string, limit: number = 5): Promise<EcclesiaData[]> {
  try {
    const allEcclesias = await getAllEcclesiasWithCache()

    // Filter items by query (case-insensitive)
    const queryLower = query.toLowerCase()
    const filteredItems = allEcclesias
      .filter(item => item.name && item.name.toLowerCase().includes(queryLower))

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
    // Use scan with filter since begins_with on PK isn't supported in Query
    const result = await client.scan({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(pkey, :prefix) AND #type = :ecclesiaType',
      ExpressionAttributeValues: {
        ':prefix': `ECCLESIA#${country}`,
        ':ecclesiaType': 'ECCLESIA',
      },
      ExpressionAttributeNames: {
        '#type': 'type',
      },
    })

    if (!result.Items) return []

    return result.Items.map(mapItemToEcclesia)
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

    return result.Items.map(mapItemToEcclesia)
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

    return result.Items.map(mapItemToEcclesia)
  } catch (error) {
    console.error('Error getting ecclesia by city:', error)
    return []
  }
}

export async function getAllEcclesia(): Promise<EcclesiaData[]> {
  try {
    const result = await client.scan({
      TableName: TABLE_NAME,
      FilterExpression: '#type = :ecclesiaType',
      ExpressionAttributeValues: {
        ':ecclesiaType': 'ECCLESIA',
      },
      ExpressionAttributeNames: {
        '#type': 'type',
      },
    })

    if (!result.Items) return []

    return result.Items.map(mapItemToEcclesia)
  } catch (error) {
    console.error('Error getting all ecclesia:', error)
    return []
  }
}

export async function deleteEcclesia(name: string): Promise<boolean> {
  try {
    // First, get the ecclesia to find its key
    const ecclesia = await getEcclesiaByName(name)
    if (!ecclesia) {
      throw new Error(`Ecclesia "${name}" not found`)
    }

    // Delete the record
    await client.delete({
      TableName: TABLE_NAME,
      Key: {
        pkey: `ECCLESIA#${ecclesia.country}|${ecclesia.province}`,
        skey: `${ecclesia.city}#${ecclesia.name}`,
      },
    })

    return true
  } catch (error) {
    console.error('Error deleting ecclesia:', error)
    throw error
  }
}

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
    // First, get the original ecclesia to find its key
    const original = await getEcclesiaByName(originalName)
    if (!original) {
      throw new Error(`Ecclesia "${originalName}" not found`)
    }

    // If the key fields changed, we need to delete and recreate
    const keyChanged =
      original.country !== data.country ||
      original.province !== data.province ||
      original.city !== data.city ||
      original.name !== data.name

    if (keyChanged) {
      // Delete old record
      await client.delete({
        TableName: TABLE_NAME,
        Key: {
          pkey: `ECCLESIA#${original.country}|${original.province}`,
          skey: `${original.city}#${original.name}`,
        },
      })

      // Create new record with updated data
      return await createEcclesia(data)
    } else {
      // Only address/postalCode changed - can update in place
      const now = new Date()
      await client.update({
        TableName: TABLE_NAME,
        Key: {
          pkey: `ECCLESIA#${original.country}|${original.province}`,
          skey: `${original.city}#${original.name}`,
        },
        UpdateExpression: 'SET address = :address, postalCode = :postalCode, venue = :venue, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':address': data.address || '',
          ':postalCode': data.postalCode || '',
          ':venue': data.venue || '',
          ':updatedAt': now.toISOString(),
        },
      })

      invalidateEcclesiaCache()
      return {
        ...original,
        address: data.address,
        postalCode: data.postalCode,
        venue: data.venue,
        updatedAt: now,
      }
    }
  } catch (error) {
    console.error('Error updating ecclesia:', error)
    throw error
  }
}

export async function updateEcclesiaFields(
  name: string,
  updates: {
    recordingBrotherEmail?: string
    recordingBrotherName?: string
    recordingBrotherPersonId?: string
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
      { key: 'recordingBrotherEmail', attr: ':rbEmail' },
      { key: 'recordingBrotherName', attr: ':rbName' },
      { key: 'recordingBrotherPersonId', attr: ':rbPersonId' },
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
    ]

    for (const { key, attr } of fieldMap) {
      if ((updates as any)[key] !== undefined) {
        expressions.push(`${key} = ${attr}`)
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
    return {
      ...ecclesia,
      ...updates,
      updatedAt: new Date(),
    }
  } catch (error) {
    console.error('Error updating ecclesia fields:', error)
    throw error
  }
}

/**
 * Look up an ecclesia by its Recording Brother email.
 * Used during sign-in to auto-assign role and ecclesia for RBs.
 */
export async function getEcclesiaByRecordingBrotherEmail(email: string): Promise<EcclesiaData | null> {
  try {
    const result = await client.scan({
      TableName: TABLE_NAME,
      FilterExpression: '#type = :ecclesiaType AND recordingBrotherEmail = :email',
      ExpressionAttributeValues: {
        ':ecclesiaType': 'ECCLESIA',
        ':email': email.toLowerCase(),
      },
      ExpressionAttributeNames: {
        '#type': 'type',
      },
    })

    if (!result.Items || result.Items.length === 0) return null

    const item = result.Items[0]
    return mapItemToEcclesia(item)
  } catch (error) {
    console.error('Error looking up ecclesia by recording brother email:', error)
    return null
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