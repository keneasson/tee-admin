import { NextResponse } from 'next/server'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { peopleIndexReady, searchPeopleByNamePrefix } from '@my/app/provider/dynamodb/people-index'
import { groupInviteCandidates, type InviteCandidate } from '@my/app/features/speaker-invites/invitee-search'
import { builtInProgram } from '@my/app/provider/dynamodb/invite-program-types'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { forbidden, inviterContext, noStore } from '@/utils/speaker-invites/http'
import { resolveProgram } from '@/utils/speaker-invites/programs'
import { ecclesiaRegions, filterCandidates } from '@/utils/speaker-invites/candidates'

/**
 * GET /api/speaker-invites/candidates?q=…[&type={programId}][&ecclesia=X]
 *   → { candidates: InviteCandidate[], outside: InviteCandidate[], outsideLabel? }
 *
 * The composer's "Start typing a name" search (spec §9a/§9b/§3a): the people
 * name-typeahead index (one Query, no scan). Inviters only (owner, or the RB /
 * a Rep of their own ecclesia). Each result carries the name floor plus the
 * two recorded facts the picker groups by (`gender`, `baptized`), never contact
 * details.
 *
 * The program's directory filter applies: WHO (brethren → `isInvitableSpeaker`,
 * brethren first; sisters; anyone) never widens; WHERE (our ecclesia / our
 * region / anywhere) widens to every region only when nothing inside it
 * matches and the typed name is specific — those come back as `outside`.
 * No `type` = the Memorial program (today's search: brethren, anywhere).
 * The roster picker's `/api/roster/resolve-candidates` is unchanged.
 */
const MAX_RESULTS = 15
/** A WHERE filter drops matches after the search, so it reads more to fill the list. */
const MAX_RESULTS_FILTERED = 60

export async function GET(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const params = new URL(request.url).searchParams
  const ecclesia = params.get('ecclesia') || ctx.person.ecclesia
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ecclesia)) return forbidden()

  const q = (params.get('q') || '').trim().slice(0, 80)
  if (q.length < 2 || !(await peopleIndexReady())) return NextResponse.json({ candidates: [], outside: [] }, { headers: noStore })

  try {
    const type = params.get('type')
    const program = type ? (await resolveProgram(ecclesia, type))?.program : builtInProgram('memorial')
    if (!program) return NextResponse.json({ error: 'Unknown invitation type.', code: 'INVALID_INPUT' }, { status: 400 })

    const limit = program.where === 'anywhere' ? MAX_RESULTS : MAX_RESULTS_FILTERED
    const matches = (await searchPeopleByNamePrefix(q, limit)).filter(
      (m) => m.role !== ROLES.SUSPICIOUS && m.role !== ROLES.DECEASED
    )
    // The facts live on the PROFILE (the name index doesn't carry them).
    const profiles = await Promise.all(matches.map((m) => personRepository.getById(m.personId).catch(() => null)))
    const list: InviteCandidate[] = []
    matches.forEach((m, i) => {
      const p = profiles[i]
      if (!p || p.role === ROLES.DECEASED || p.role === ROLES.SUSPICIOUS) return
      list.push({
        personId: m.personId,
        displayName: m.displayName,
        ecclesia: m.ecclesia,
        ...(p.gender ? { gender: p.gender } : {}),
        ...(typeof p.baptized === 'boolean' ? { baptized: p.baptized } : {}),
      })
    })

    const regions = program.where === 'region' ? await ecclesiaRegions() : new Map()
    const filtered = filterCandidates(list, q, { who: program.who, where: program.where, ecclesia, regions })
    // Brethren programs: confirmed brethren first, then "not yet confirmed" (§9b).
    const order = (l: InviteCandidate[]) => {
      if (program.who !== 'brethren') return l.slice(0, MAX_RESULTS)
      const { brethren, unconfirmed } = groupInviteCandidates(l)
      return [...brethren, ...unconfirmed].slice(0, MAX_RESULTS)
    }
    return NextResponse.json(
      {
        candidates: order(filtered.candidates),
        outside: order(filtered.outside),
        ...(filtered.outsideLabel ? { outsideLabel: filtered.outsideLabel } : {}),
      },
      { headers: noStore }
    )
  } catch (error) {
    console.error('[speaker-invites] candidate search failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500, headers: noStore })
  }
}
