import { NextRequest, NextResponse } from 'next/server'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { auth } from '../../../utils/auth'
import { getAwsDbConfig } from '../../../utils/email/sesClient'

const dbClientConfig = getAwsDbConfig()
const SCHEDULES_TABLE = 'tee-schedules'

// In-memory cache for member list
interface CachedMembers {
  members: MemberListItem[]
  ecclesias: string[]
  timestamp: number
}
let membersCache: CachedMembers | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface MemberListItem {
  email: string
  name: string
  lastName: string // For sorting
  ecclesia?: string
}

/**
 * GET /api/people - List all ecclesia members
 * Returns basic info (name, ecclesia) for all members in the directory
 * Queries DIRECTORY#MEMBERS from tee-schedules table (synced from Google Sheets)
 * Results are cached for 5 minutes for performance
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ecclesiaFilter = searchParams.get('ecclesia')
    const searchQuery = searchParams.get('search')?.toLowerCase()
    const noCache = searchParams.get('noCache') === 'true'

    const viewerEmail = session.user.email

    // Check cache first (unless noCache is requested)
    const now = Date.now()
    if (!noCache && membersCache && (now - membersCache.timestamp) < CACHE_TTL_MS) {
      // Use cached data, apply filters
      const filtered = applyFilters(membersCache.members, viewerEmail, searchQuery, ecclesiaFilter)
      return NextResponse.json({
        success: true,
        members: filtered.map(({ lastName, ...rest }) => rest), // Remove lastName from response
        ecclesias: membersCache.ecclesias,
        total: filtered.length,
        cached: true,
      })
    }

    // Query directory members from tee-schedules table
    const dbClient = new DynamoDBClient(dbClientConfig)
    const docClient = DynamoDBDocumentClient.from(dbClient)

    // Query all members with PK = DIRECTORY#MEMBERS
    const params = {
      TableName: SCHEDULES_TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'DIRECTORY#MEMBERS',
      },
    }

    const queryCommand = new QueryCommand(params)
    const result = await docClient.send(queryCommand)

    if (!result.Items) {
      return NextResponse.json({
        success: true,
        members: [],
        ecclesias: [],
        total: 0,
      })
    }

    // Process and deduplicate members
    const members: MemberListItem[] = []
    const seenEmails = new Map<string, MemberListItem>() // Track best record per email

    for (const item of result.Items) {
      // Skip records without email
      if (!item.email) continue

      const firstName = item.firstName || ''
      const lastName = item.lastName || ''
      const name = [firstName, lastName].filter(Boolean).join(' ') || item.email
      const memberEcclesia = item.ecclesia || undefined

      const member: MemberListItem = {
        email: item.email,
        name,
        lastName: lastName.toLowerCase(), // For sorting
        ecclesia: memberEcclesia,
      }

      // Deduplicate: keep the record with more data (prefer ones with ecclesia)
      const existing = seenEmails.get(item.email)
      if (!existing) {
        seenEmails.set(item.email, member)
      } else if (memberEcclesia && !existing.ecclesia) {
        // Prefer record with ecclesia
        seenEmails.set(item.email, member)
      }
    }

    // Convert map to array
    for (const member of seenEmails.values()) {
      members.push(member)
    }

    // Sort by last name, then first name
    members.sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName)
      if (lastNameCompare !== 0) return lastNameCompare
      return a.name.localeCompare(b.name)
    })

    // Get unique ecclesias for filter dropdown
    const ecclesias = [...new Set(result.Items
      .filter(item => item.ecclesia && item.ecclesia !== '')
      .map(item => item.ecclesia as string)
    )].sort()

    // Update cache
    membersCache = {
      members,
      ecclesias,
      timestamp: now,
    }

    // Apply filters for response
    const filtered = applyFilters(members, viewerEmail, searchQuery, ecclesiaFilter)

    return NextResponse.json({
      success: true,
      members: filtered.map(({ lastName, ...rest }) => rest), // Remove lastName from response
      ecclesias,
      total: filtered.length,
      cached: false,
    })
  } catch (error) {
    console.error('Get people list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function applyFilters(
  members: MemberListItem[],
  viewerEmail: string,
  searchQuery?: string | null,
  ecclesiaFilter?: string | null
): MemberListItem[] {
  const viewerEmailLower = viewerEmail.toLowerCase()
  return members.filter(member => {
    // Skip current user from the list (case-insensitive comparison)
    if (member.email.toLowerCase() === viewerEmailLower) return false

    // Apply ecclesia filter if provided
    if (ecclesiaFilter && member.ecclesia !== ecclesiaFilter) return false

    // Apply search filter if provided
    if (searchQuery) {
      const nameMatch = member.name.toLowerCase().includes(searchQuery)
      const ecclesiaMatch = member.ecclesia?.toLowerCase().includes(searchQuery)
      const emailMatch = member.email.toLowerCase().includes(searchQuery)
      if (!nameMatch && !ecclesiaMatch && !emailMatch) return false
    }

    return true
  })
}
