import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import { getCachedMembers, setCachedMembers, CACHE_TTL_MS } from './cache'
import { getEcclesiaByName } from '../../../utils/dynamodb/locations'

interface MemberListItem {
  id: string // personId (UUID) — used for routing instead of email
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

    // Require at least member role — guests must not see the contact list
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json(
        { error: 'Member access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const ecclesiaFilter = searchParams.get('ecclesia')
    const searchQuery = searchParams.get('search')?.toLowerCase()
    const noCache = searchParams.get('noCache') === 'true'
    const includeEmails = searchParams.get('includeEmails') === 'true'

    const viewerEmail = session.user.email

    // Look up viewer's ecclesia for default filter (try primary, then secondary email)
    let viewerPerson = await personRepository.getByEmail(viewerEmail)
    if (!viewerPerson) {
      const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
      viewerPerson = persons[0] || null
    }
    const viewerEcclesia = viewerPerson?.ecclesia || undefined

    const viewerRole = session.user.role
    const isAdminOrOwner = viewerRole === ROLES.ADMIN || viewerRole === ROLES.OWNER
    const isRecordingBrother = !!(session.user as any).isRecordingBrother
    const isRecorderOrRep = isRecordingBrother || viewerRole === ROLES.RECORDER || viewerRole === ROLES.REP

    // Check cache first (unless noCache is requested)
    const now = Date.now()
    const cached = getCachedMembers()
    let allMembers: MemberListItem[]
    let ecclesias: string[]
    let guestTotal: number
    let guestCounts: Array<{ ecclesia: string | undefined; count: number }>
    let fromCache = false

    if (!noCache && cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      allMembers = cached.members
      ecclesias = cached.ecclesias
      guestTotal = cached.guestTotal
      guestCounts = cached.guestCounts
      fromCache = true
    } else {
      // Fetch all PersonRecords (PROFILE items only)
      const allPersons: PersonRecord[] = []
      let lastKey: Record<string, any> | undefined

      do {
        const result = await personRepository.listAll({ lastEvaluatedKey: lastKey })
        allPersons.push(...result.items)
        lastKey = result.lastEvaluatedKey
      } while (lastKey)

      // Build member list - each person appears exactly once
      // Exclude guests from contact list; count them separately per ecclesia
      allMembers = []
      const ecclesiaSet = new Set<string>()
      const guestByEcclesia = new Map<string | undefined, number>()
      guestTotal = 0

      for (const person of allPersons) {
        // Skip placeholder/unknown records
        if (person.primaryEmail?.startsWith('unknown-')) continue

        // Count guests but exclude them from contact list
        if (person.role === ROLES.GUEST) {
          guestTotal++
          const ecc = person.ecclesia || undefined
          guestByEcclesia.set(ecc, (guestByEcclesia.get(ecc) || 0) + 1)
          continue
        }

        const firstName = person.firstName || ''
        const lastName = person.lastName || ''
        const name = person.displayName || [firstName, lastName].filter(Boolean).join(' ') || person.primaryEmail

        if (person.ecclesia) {
          ecclesiaSet.add(person.ecclesia)
        }

        allMembers.push({
          id: person.personId,
          email: person.primaryEmail,
          name,
          lastName: lastName.toLowerCase(),
          ecclesia: person.ecclesia || undefined,
        })
      }

      // Sort by last name, then first name
      allMembers.sort((a, b) => {
        const lastNameCompare = a.lastName.localeCompare(b.lastName)
        if (lastNameCompare !== 0) return lastNameCompare
        return a.name.localeCompare(b.name)
      })

      ecclesias = [...ecclesiaSet].sort()
      guestCounts = Array.from(guestByEcclesia.entries()).map(([ecclesia, count]) => ({ ecclesia, count }))

      // Update cache
      setCachedMembers({ members: allMembers, ecclesias, guestTotal, guestCounts, timestamp: now })
    }

    // Compute viewer-specific guest count
    const viewerGuestCount = isAdminOrOwner
      ? guestTotal
      : (isRecorderOrRep
        ? (guestCounts.find((g) => g.ecclesia === viewerEcclesia)?.count || 0)
        : 0)

    // Apply filters for response
    const filtered = applyFilters(allMembers, viewerEmail, searchQuery, ecclesiaFilter)

    // For admin/owner, enrich with privacy settings for all members
    // For recorder/rep, enrich with privacy settings for same-ecclesia members only
    let membersResponse: any[] = filtered.map(({ lastName, ...rest }) => rest)
    if (isAdminOrOwner || isRecorderOrRep) {
      const privacySettings = await Promise.all(
        filtered.map((m) => privacyRepository.getPrivacySettings(m.email))
      )
      membersResponse = filtered.map(({ lastName, ...rest }, i) => {
        // Recorder/Rep only see privacy indicators for same-ecclesia members
        if (isRecorderOrRep && rest.ecclesia !== viewerEcclesia) {
          return rest
        }
        return {
          ...rest,
          privacy: {
            showName: privacySettings[i].showName || 'private',
            showEmail: privacySettings[i].showEmail || 'private',
            showPhone: privacySettings[i].showPhone || 'private',
            showAddress: privacySettings[i].showAddress || 'private',
            showFamily: privacySettings[i].showFamily || 'private',
          },
        }
      })
    }

    // If filtering by ecclesia, check if it has a Recording Brother via EcclesiaRecord
    let hasRecordingBrother: boolean | undefined
    if (ecclesiaFilter) {
      const ecclesiaRecord = await getEcclesiaByName(ecclesiaFilter)
      hasRecordingBrother = !!ecclesiaRecord?.recordingBrotherEmail
    }

    // If includeEmails requested, fetch all emails for each member in the response
    if (includeEmails) {
      const emailPromises = membersResponse.map(async (member: any) => {
        const emails = await personRepository.getEmails(member.id)
        return {
          ...member,
          emails: emails.map((e) => ({ email: e.email, emailType: e.emailType })),
        }
      })
      membersResponse = await Promise.all(emailPromises)
    }

    return NextResponse.json({
      success: true,
      members: membersResponse,
      ecclesias,
      viewerEcclesia,
      viewerRole,
      total: filtered.length,
      guestCount: viewerGuestCount,
      cached: fromCache,
      ...(hasRecordingBrother !== undefined ? { hasRecordingBrother } : {}),
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
  _viewerEmail: string,
  searchQuery?: string | null,
  ecclesiaFilter?: string | null
): MemberListItem[] {
  return members.filter(member => {
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
