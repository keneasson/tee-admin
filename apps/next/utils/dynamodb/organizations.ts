import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'
import { DynamoDB } from '@aws-sdk/client-dynamodb'
import { getAwsDbConfig } from '../email/sesClient'
import type { OrganizationRecord, OrganizationType } from '@my/app/provider/dynamodb/types'

const dbClientConfig = getAwsDbConfig()
const client = DynamoDBDocument.from(new DynamoDB(dbClientConfig), {
  marshallOptions: {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
})

const TABLE_NAME = 'tee-admin'

export interface OrganizationData {
  name: string
  type: OrganizationType
  description?: string
  country: string
  province: string
  city: string
  contactEmail?: string
  website?: string
  memberEcclesias: string[]
  externalLinks?: {
    newsletterUrl?: string
    youtube?: string
    facebook?: string
    otherLinks?: Array<{ label: string; url: string }>
  }
  logoUrl?: string
  timezone?: string
  latitude?: number
  longitude?: number
  createdAt: string
  lastUpdated: string
}

function mapItemToOrganization(item: Record<string, any>): OrganizationData {
  return {
    name: item.name,
    type: item.type || 'other',
    description: item.description,
    country: item.country,
    province: item.province,
    city: item.city,
    contactEmail: item.contactEmail,
    website: item.website,
    memberEcclesias: item.memberEcclesias || [],
    externalLinks: item.externalLinks,
    logoUrl: item.logoUrl,
    timezone: item.timezone,
    latitude: item.latitude,
    longitude: item.longitude,
    createdAt: item.createdAt,
    lastUpdated: item.lastUpdated,
  }
}

export async function createOrganization(data: {
  name: string
  type: OrganizationType
  description?: string
  country: string
  province: string
  city: string
  contactEmail?: string
  website?: string
  memberEcclesias?: string[]
}): Promise<OrganizationData> {
  const now = new Date().toISOString()
  const org: OrganizationData = {
    ...data,
    memberEcclesias: data.memberEcclesias || [],
    createdAt: now,
    lastUpdated: now,
  }

  await client.put({
    TableName: TABLE_NAME,
    Item: {
      pkey: `ORGANIZATION#${data.country}|${data.province}`,
      skey: `${data.city}#${data.name}`,
      gsi1pk: `ORGANIZATION#${data.name}`,
      gsi1sk: `${data.country}|${data.province}|${data.city}`,
      ...org,
    },
    ConditionExpression: 'attribute_not_exists(gsi1pk)',
  })

  invalidateOrgCache()
  return org
}

export async function getOrganizationByName(name: string): Promise<OrganizationData | null> {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `ORGANIZATION#${name}`,
      },
      Limit: 1,
    })

    if (result.Items && result.Items.length > 0) {
      return mapItemToOrganization(result.Items[0])
    }
    return null
  } catch (error) {
    console.error('Error getting organization by name:', error)
    return null
  }
}

// Server-side cache for organization list
let orgCacheData: OrganizationData[] | null = null
let orgCacheExpiry = 0
const ORG_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function invalidateOrgCache() {
  orgCacheData = null
  orgCacheExpiry = 0
}

export async function getAllOrganizations(): Promise<OrganizationData[]> {
  const now = Date.now()
  if (orgCacheData && now < orgCacheExpiry) {
    return orgCacheData
  }

  try {
    const result = await client.scan({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      FilterExpression: 'begins_with(gsi1pk, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'ORGANIZATION#',
      },
    })

    const orgs = (result.Items || []).map(mapItemToOrganization)
      .sort((a, b) => a.name.localeCompare(b.name))

    orgCacheData = orgs
    orgCacheExpiry = now + ORG_CACHE_TTL_MS
    return orgs
  } catch (error) {
    console.error('Error listing organizations:', error)
    return []
  }
}

export async function updateOrganizationFields(
  name: string,
  fields: Partial<Omit<OrganizationData, 'name' | 'country' | 'province' | 'city' | 'createdAt'>>
): Promise<boolean> {
  const org = await getOrganizationByName(name)
  if (!org) return false

  // Build the DynamoDB key from stored org data
  const pkey = `ORGANIZATION#${org.country}|${org.province}`
  const skey = `${org.city}#${org.name}`

  const updateFields = { ...fields, lastUpdated: new Date().toISOString() }
  const fieldEntries = Object.entries(updateFields).filter(([_, v]) => v !== undefined)

  if (fieldEntries.length === 0) return false

  const expressionParts: string[] = []
  const exprNames: Record<string, string> = {}
  const exprValues: Record<string, any> = {}

  fieldEntries.forEach(([key, value], i) => {
    const nameAlias = `#f${i}`
    const valueAlias = `:v${i}`
    expressionParts.push(`${nameAlias} = ${valueAlias}`)
    exprNames[nameAlias] = key
    exprValues[valueAlias] = value
  })

  try {
    await client.update({
      TableName: TABLE_NAME,
      Key: { pkey, skey },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: exprNames,
      ExpressionAttributeValues: exprValues,
    })

    invalidateOrgCache()
    return true
  } catch (error) {
    console.error('Error updating organization:', error)
    return false
  }
}

export async function deleteOrganization(name: string): Promise<boolean> {
  const org = await getOrganizationByName(name)
  if (!org) return false

  const pkey = `ORGANIZATION#${org.country}|${org.province}`
  const skey = `${org.city}#${org.name}`

  try {
    await client.delete({
      TableName: TABLE_NAME,
      Key: { pkey, skey },
    })
    invalidateOrgCache()
    return true
  } catch (error) {
    console.error('Error deleting organization:', error)
    return false
  }
}
