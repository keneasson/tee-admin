import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { peopleIndexReady, searchPeopleByNamePrefix } from '@my/app/provider/dynamodb/people-index'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { inviterContext } from '@/utils/speaker-invites/http'

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
 * SPEAKER-INVITE INVITERS (RB / Rep, spec §2): a caller who passes
 * `canSendSpeakerInvite` for their own ecclesia also gets candidates, for the
 * composer's invitee picker. Invitees are often visiting speakers, so this
 * path searches EVERY ecclesia — via the people name-typeahead index (one
 * Query, no scan) — and returns the same name floor the member typeahead
 * (`/api/people/typeahead`) already shows any member: id, display name,
 * ecclesia. Never an email, phone or address. The admin/owner path below is
 * unchanged.
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
    return speakerInviterCandidates(request)
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

/** Not admin/owner: allowed only for speaker-invite inviters, across all ecclesias. */
async function speakerInviterCandidates(request: NextRequest) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ctx.person.ecclesia)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  const headers = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80)
  if (q.length < 2 || !(await peopleIndexReady())) {
    return NextResponse.json({ candidates: [] as RosterCandidate[] }, { headers })
  }
  try {
    const matches = await searchPeopleByNamePrefix(q, MAX_RESULTS)
    const candidates: RosterCandidate[] = matches
      .filter((m) => m.role !== ROLES.SUSPICIOUS && m.role !== ROLES.DECEASED)
      .map(({ personId, displayName, ecclesia }) => ({ personId, displayName, ecclesia }))
    return NextResponse.json({ candidates }, { headers })
  } catch (error) {
    console.error('Error resolving speaker-invite candidates:', error)
    return NextResponse.json({ error: 'Failed to resolve candidates' }, { status: 500 })
  }
}
