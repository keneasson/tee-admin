import { NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { loadDirectoryPeople } from '../load-directory'
import { getCachedGuests, setCachedGuests, GUEST_CACHE_TTL_MS } from './cache'
import { personForSessionEmail } from '@/utils/session-person'

interface GuestListItem {
  id: string
  email: string
  name: string
  lastName: string
  ecclesia?: string
  createdAt: string
}

/**
 * GET /api/people/guests - List all guest users
 * Access: recorder+ only. Recorder gets filtered to their ecclesia server-side.
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const viewerRole = session.user.role as string
    const viewerIsRB = !!(session.user as any).isRecordingBrother
    const isRecorderOrHigher =
      viewerIsRB ||
      viewerRole === ROLES.RECORDER ||
      viewerRole === ROLES.ADMIN ||
      viewerRole === ROLES.OWNER

    if (!isRecorderOrHigher) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Look up viewer's ecclesia for recorder filtering
    const viewerEmail = session.user.email
    let viewerPerson = await personForSessionEmail(viewerEmail)
    if (!viewerPerson) {
      const persons = await personRepository.getAllPersonsByEmail(viewerEmail)
      viewerPerson = persons[0] || null
    }
    const viewerEcclesia = viewerPerson?.ecclesia || undefined
    const isAdminOrOwner = viewerRole === ROLES.ADMIN || viewerRole === ROLES.OWNER

    // Check cache
    const now = Date.now()
    const cached = getCachedGuests()
    let allGuests: GuestListItem[]

    if (cached && (now - cached.timestamp) < GUEST_CACHE_TTL_MS) {
      allGuests = cached.guests
    } else {
      // Everyone (one card Query once the people index is built), then keep guests
      const { people: allPersons } = await loadDirectoryPeople()

      allGuests = []
      for (const person of allPersons) {
        if (person.role !== ROLES.GUEST) continue
        if (person.primaryEmail?.startsWith('unknown-')) continue

        const firstName = person.firstName || ''
        const lastName = person.lastName || ''
        const name = person.displayName || [firstName, lastName].filter(Boolean).join(' ') || person.primaryEmail

        allGuests.push({
          id: person.personId,
          email: person.primaryEmail,
          name,
          lastName: lastName.toLowerCase(),
          ecclesia: person.ecclesia || undefined,
          createdAt: person.createdAt || '',
        })
      }

      // Sort by createdAt descending (newest first)
      allGuests.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0
        if (!a.createdAt) return 1
        if (!b.createdAt) return -1
        return b.createdAt.localeCompare(a.createdAt)
      })

      setCachedGuests({ guests: allGuests, timestamp: now })
    }

    // Recorder: filter to their ecclesia only
    const filteredGuests = isAdminOrOwner
      ? allGuests
      : allGuests.filter((g) => g.ecclesia === viewerEcclesia)

    return NextResponse.json({
      success: true,
      guests: filteredGuests.map(({ lastName, ...rest }) => rest),
      total: filteredGuests.length,
    })
  } catch (error) {
    console.error('Get guest list error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
