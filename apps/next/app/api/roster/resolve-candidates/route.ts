import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'

/**
 * READ-ONLY roster member-picker candidate endpoint (#110, Slice B).
 *
 * GET /api/roster/resolve-candidates?q=<typeahead>&ecclesia=<name>
 *
 * Backs the `RoleMemberPicker` typeahead: given a partial name, returns directory
 * members (PersonRecords) whose name matches, so an admin can pick a real member
 * for a roster role instead of free-typing. ZERO mutations — no writes anywhere.
 *
 * Matching strategy: substring filter over `listByEcclesia`. `searchByName` (GSI3)
 * is an EXACT last-name lookup (`NAME#{lastname}` partition, first-name prefix on
 * the sort key), which can't answer the partial/any-token queries a typeahead
 * emits, so a directory-scoped substring scan is the correct primary path here.
 * The ecclesia set is small (a few hundred people), so this is a single cheap GSI2
 * partition read.
 *
 * TODO(multi-tenant, #110): the ecclesia is currently clamped to HOME_ECCLESIA and
 * gated on the GLOBAL admin/owner role. When multi-tenant lands, authorize the
 * requested `ecclesia` against the caller's managedRegions before returning members
 * from a foreign ecclesia (cross-ecclesia visiting speakers get their own create
 * path in Slice C).
 */

const MAX_RESULTS = 15

export interface RosterCandidate {
  personId: string
  displayName: string
  ecclesia?: string
}

export async function GET(request: NextRequest) {
  // --- Auth gate: owner/admin only (matches sibling admin routes) ---
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role as string) || ROLES.GUEST
  if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  // Multi-tenant guard: only the home ecclesia is addressable today. Ignore any
  // other requested ecclesia rather than leak a foreign directory.
  const ecclesia = HOME_ECCLESIA.canonicalName

  // Empty query returns no candidates (the picker only searches once the admin types).
  if (q.length < 1) {
    return NextResponse.json(
      { candidates: [] as RosterCandidate[] },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  }

  try {
    const candidates: RosterCandidate[] = []
    let lastEvaluatedKey: Record<string, any> | undefined
    do {
      const page = await personRepository.listByEcclesia(ecclesia, { lastEvaluatedKey })
      for (const p of page.items) {
        const displayName = (p.displayName || `${p.firstName ?? ''} ${p.lastName ?? ''}`).trim()
        const haystack = `${displayName} ${p.firstName ?? ''} ${p.lastName ?? ''}`.toLowerCase()
        if (haystack.includes(q)) {
          candidates.push({ personId: p.personId, displayName, ecclesia: p.ecclesia })
        }
      }
      lastEvaluatedKey = page.lastEvaluatedKey
    } while (lastEvaluatedKey && candidates.length < MAX_RESULTS)

    // Prefer names that START with the query (more relevant), then alphabetical.
    candidates.sort((a, b) => {
      const aStarts = a.displayName.toLowerCase().startsWith(q) ? 0 : 1
      const bStarts = b.displayName.toLowerCase().startsWith(q) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return a.displayName.localeCompare(b.displayName)
    })

    return NextResponse.json(
      { candidates: candidates.slice(0, MAX_RESULTS) },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (error) {
    console.error('Error resolving roster candidates:', error)
    return NextResponse.json({ error: 'Failed to resolve candidates' }, { status: 500 })
  }
}
