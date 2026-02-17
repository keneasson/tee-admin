import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import { getCachedMembers, setCachedMembers, CACHE_TTL_MS } from './cache'

interface MemberListItem {
  email: string
  name: string
  lastName: string // For sorting
  ecclesia?: string
}

/**
 * GET /api/people - List all ecclesia members
 * Sources from PersonRecords (tee-admin PERSON# items via scan with skey=PROFILE)
 * Each person appears exactly once regardless of how many emails they have.
 * Results are cached for 5 minutes for performance.
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

    // Look up viewer's ecclesia for default filter
    const viewerPerson = await personRepository.getByEmail(viewerEmail)
    const viewerEcclesia = viewerPerson?.ecclesia || undefined

    // Check cache first (unless noCache is requested)
    const now = Date.now()
    const cached = getCachedMembers()
    if (!noCache && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      const filtered = applyFilters(cached.members, viewerEmail, searchQuery, ecclesiaFilter)
      return NextResponse.json({
        success: true,
        members: filtered.map(({ lastName, ...rest }) => rest),
        ecclesias: cached.ecclesias,
        viewerEcclesia,
        total: filtered.length,
        cached: true,
      })
    }

    // Fetch all PersonRecords (PROFILE items only)
    const allPersons: PersonRecord[] = []
    let lastKey: Record<string, any> | undefined

    do {
      const result = await personRepository.listAll({ lastEvaluatedKey: lastKey })
      allPersons.push(...result.items)
      lastKey = result.lastEvaluatedKey
    } while (lastKey)

    // Build member list - each person appears exactly once
    const members: MemberListItem[] = []
    const ecclesiaSet = new Set<string>()

    for (const person of allPersons) {
      // Skip placeholder/unknown records
      if (person.primaryEmail?.startsWith('unknown-')) continue

      const firstName = person.firstName || ''
      const lastName = person.lastName || ''
      const name = person.displayName || [firstName, lastName].filter(Boolean).join(' ') || person.primaryEmail

      if (person.ecclesia) {
        ecclesiaSet.add(person.ecclesia)
      }

      members.push({
        email: person.primaryEmail,
        name,
        lastName: lastName.toLowerCase(),
        ecclesia: person.ecclesia || undefined,
      })
    }

    // Sort by last name, then first name
    members.sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName)
      if (lastNameCompare !== 0) return lastNameCompare
      return a.name.localeCompare(b.name)
    })

    const ecclesias = [...ecclesiaSet].sort()

    // Update cache
    setCachedMembers({ members, ecclesias, timestamp: now })

    // Apply filters for response
    const filtered = applyFilters(members, viewerEmail, searchQuery, ecclesiaFilter)

    return NextResponse.json({
      success: true,
      members: filtered.map(({ lastName, ...rest }) => rest),
      ecclesias,
      viewerEcclesia,
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
