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

export interface EcclesiaData {
  name: string
  country: string
  province: string
  city: string
  address?: string
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

// Ecclesia functions
export async function createEcclesia(data: {
  name: string
  country: string
  province: string
  city: string
  address?: string
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
export async function getEcclesiaByName(name: string): Promise<EcclesiaData | null> {
  try {
    const result = await client.query({
      TableName: TABLE_NAME,
      IndexName: 'gsi1', // Query the GSI1 for name-based lookups
      KeyConditionExpression: 'gsi1pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `ECCLESIA#${name}`,
      },
      Limit: 1
    })

    if (!result.Items || result.Items.length === 0) {
      return null
    }

    const item = result.Items[0]
    return {
      name: item.name,
      country: item.country,
      province: item.province,
      city: item.city,
      address: item.address,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  } catch (error) {
    console.error('Error getting ecclesia by name:', error)
    return null
  }
}

export async function searchEcclesia(query: string, limit: number = 5): Promise<EcclesiaData[]> {
  try {
    // Search using GSI1 for efficient name-based searches
    const result = await client.scan({
      TableName: TABLE_NAME,
      IndexName: 'gsi1',
      FilterExpression: 'begins_with(gsi1pk, :query)',
      ExpressionAttributeValues: {
        ':query': `ECCLESIA#${query}`,
      },
      Limit: limit,
    })

    if (!result.Items) return []

    return result.Items.map((item) => ({
      name: item.name,
      country: item.country,
      province: item.province,
      city: item.city,
      address: item.address,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
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

    return result.Items.map((item) => ({
      name: item.name,
      country: item.country,
      province: item.province,
      city: item.city,
      address: item.address,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
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

    return result.Items.map((item) => ({
      name: item.name,
      country: item.country,
      province: item.province,
      city: item.city,
      address: item.address,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
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

    return result.Items.map((item) => ({
      name: item.name,
      country: item.country,
      province: item.province,
      city: item.city,
      address: item.address,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
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

    return result.Items.map((item) => ({
      name: item.name,
      country: item.country,
      province: item.province,
      city: item.city,
      address: item.address,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))
  } catch (error) {
    console.error('Error getting all ecclesia:', error)
    return []
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