import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { peopleIndexReady, searchPeopleByNamePrefix } from '@my/app/provider/dynamodb/people-index'

/**
 * GET /api/people/typeahead?q=jo%20sm — name-prefix search for the smart-contact
 * picker (retirement plan §7 pattern 3). One gsi3 Query of the NAMETOK# items.
 *
 * Member+ only (the same gate as the contact list). Returns the name floor
 * only — id, display name, ecclesia — never contact details; the picker
 * resolves a chosen person through the server-side redaction like any
 * other smart reference (ADR-0005).
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const role = ((session.user as any).role as string) || ROLES.GUEST
  if (role === ROLES.GUEST || role === ROLES.DECEASED || role === ROLES.SUSPICIOUS) {
    return NextResponse.json({ error: 'Member access required' }, { status: 403 })
  }

  const q = (new URL(request.url).searchParams.get('q') || '').slice(0, 80)
  if (!(await peopleIndexReady())) {
    return NextResponse.json({ results: [], indexReady: false })
  }
  try {
    const matches = await searchPeopleByNamePrefix(q, 10)
    const results = matches
      .filter((m) => m.role !== ROLES.SUSPICIOUS && m.role !== ROLES.DECEASED)
      .map(({ personId, displayName, ecclesia }) => ({ personId, displayName, ecclesia }))
    return NextResponse.json({ results, indexReady: true })
  } catch (error) {
    console.error('people typeahead failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
