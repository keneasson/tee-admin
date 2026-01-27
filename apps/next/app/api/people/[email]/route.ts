import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { auth } from '../../../../utils/auth'
import { getAwsDbConfig } from '../../../../utils/email/sesClient'

const dbClientConfig = getAwsDbConfig()
const SCHEDULES_TABLE = 'tee-schedules'

// Cache for directory members - shared across requests
interface DirectoryMember {
  email: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  ecclesia?: string
}
interface DirectoryCache {
  members: Map<string, DirectoryMember>
  timestamp: number
}
let directoryCache: DirectoryCache | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface MemberProfile {
  email: string
  name?: string
  ecclesia?: string
  phones?: Array<{
    type: string
    number: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  addresses?: Array<{
    type: string
    label?: string
    street1: string
    street2?: string
    city: string
    province: string
    postalCode: string
    country: string
    isPrimary: boolean
    isHousehold: boolean
  }>
  family?: Array<{
    email: string
    name?: string
    relationshipType: string
  }>
  permissions: {
    canViewName: boolean
    canViewPhone: boolean
    canViewAddress: boolean
    canViewEmail: boolean
    canViewFamily: boolean
    canRequestContact: boolean
  }
}

/**
 * Load and cache all directory members for fast lookups
 */
async function getDirectoryCache(): Promise<Map<string, DirectoryMember>> {
  const now = Date.now()

  // Return cached data if fresh
  if (directoryCache && (now - directoryCache.timestamp) < CACHE_TTL_MS) {
    return directoryCache.members
  }

  // Fetch all members from DynamoDB
  const dbClient = new DynamoDBClient(dbClientConfig)
  const docClient = DynamoDBDocumentClient.from(dbClient)

  const queryCommand = new QueryCommand({
    TableName: SCHEDULES_TABLE,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'DIRECTORY#MEMBERS',
    },
  })

  const result = await docClient.send(queryCommand)
  const members = new Map<string, DirectoryMember>()

  if (result.Items) {
    for (const item of result.Items) {
      if (item.email) {
        // Keep best record per email (prefer ones with more data)
        const existing = members.get(item.email)
        if (!existing || (item.ecclesia && !existing.ecclesia)) {
          members.set(item.email, {
            email: item.email,
            firstName: item.firstName || '',
            lastName: item.lastName || '',
            phone: item.phone || undefined,
            address: item.address || undefined,
            ecclesia: item.ecclesia || undefined,
          })
        }
      }
    }
  }

  // Update cache
  directoryCache = { members, timestamp: now }
  return members
}

/**
 * GET /api/people/[email] - Get a member's profile
 * Uses cached directory data from DynamoDB (tee-schedules)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { email: targetEmail } = await params
    const decodedEmail = decodeURIComponent(targetEmail)
    const viewerEmail = session.user.email
    const isOwnProfile = viewerEmail === decodedEmail

    // Get cached directory (single query, shared across all requests)
    const directory = await getDirectoryCache()
    const targetMember = directory.get(decodedEmail)

    if (!targetMember) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Build display name
    const displayName = [targetMember.firstName, targetMember.lastName]
      .filter(Boolean)
      .join(' ') || decodedEmail

    // For now, all authenticated users can see all data (simplified privacy)
    // Own profile always has full access, others get default "authenticated" access
    const permissions: MemberProfile['permissions'] = {
      canViewName: true,
      canViewPhone: true,
      canViewAddress: true,
      canViewEmail: true,
      canViewFamily: true,
      canRequestContact: !isOwnProfile, // Can't request contact from yourself
    }

    // Build profile - all from cached directory data
    const profile: MemberProfile = {
      email: decodedEmail,
      name: displayName,
      ecclesia: targetMember.ecclesia,
      permissions,
    }

    // Add phone from directory if available
    if (targetMember.phone) {
      profile.phones = [{
        type: 'mobile',
        number: targetMember.phone,
        isPrimary: true,
        isHousehold: false,
      }]
    }

    // Add address from directory if available
    if (targetMember.address) {
      profile.addresses = [{
        type: 'home',
        street1: targetMember.address,
        city: '',
        province: '',
        postalCode: '',
        country: 'Canada',
        isPrimary: true,
        isHousehold: false,
      }]
    }

    // Family members would require relationship data - skip for now
    // (relationships are stored in tee-admin, not directory)
    profile.family = []

    return NextResponse.json({
      success: true,
      profile,
      cached: directoryCache?.timestamp === (await getDirectoryCache()).size ? false : true,
    })
  } catch (error) {
    console.error('Get member profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
