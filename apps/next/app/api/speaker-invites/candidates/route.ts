import { NextResponse } from 'next/server'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { peopleIndexReady, searchPeopleByNamePrefix } from '@my/app/provider/dynamodb/people-index'
import { isInvitableSpeaker } from '@my/app/utils/speaker-eligibility'
import { groupInviteCandidates, type InviteCandidate } from '@my/app/features/speaker-invites/invitee-search'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { forbidden, inviterContext, noStore } from '@/utils/speaker-invites/http'

/**
 * GET /api/speaker-invites/candidates?q=… → { candidates: InviteCandidate[] }
 *
 * The composer's "Start typing a name" search (spec §9a/§9b): every ecclesia,
 * via the people name-typeahead index (one Query, no scan). Inviters only
 * (owner, or the RB / a Rep of their own ecclesia). Each result carries the
 * name floor plus the two recorded facts the picker groups by (`gender`,
 * `baptized`), never contact details. Only `isInvitableSpeaker` people are
 * returned (no sisters, nobody recorded as unbaptized), brethren first.
 * The roster picker's `/api/roster/resolve-candidates` is unchanged.
 */
const MAX_RESULTS = 15

export async function GET(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ctx.person.ecclesia)) return forbidden()

  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 80)
  if (q.length < 2 || !(await peopleIndexReady())) return NextResponse.json({ candidates: [] }, { headers: noStore })

  try {
    const matches = (await searchPeopleByNamePrefix(q, MAX_RESULTS)).filter(
      (m) => m.role !== ROLES.SUSPICIOUS && m.role !== ROLES.DECEASED
    )
    // The facts live on the PROFILE (the name index doesn't carry them).
    const profiles = await Promise.all(matches.map((m) => personRepository.getById(m.personId).catch(() => null)))
    const list: InviteCandidate[] = []
    matches.forEach((m, i) => {
      const p = profiles[i]
      if (!p || p.role === ROLES.DECEASED || !isInvitableSpeaker(p)) return
      list.push({
        personId: m.personId,
        displayName: m.displayName,
        ecclesia: m.ecclesia,
        ...(p.gender ? { gender: p.gender } : {}),
        ...(typeof p.baptized === 'boolean' ? { baptized: p.baptized } : {}),
      })
    })
    const { brethren, unconfirmed } = groupInviteCandidates(list)
    return NextResponse.json({ candidates: [...brethren, ...unconfirmed] }, { headers: noStore })
  } catch (error) {
    console.error('[speaker-invites] candidate search failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500, headers: noStore })
  }
}
