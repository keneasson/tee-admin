import { NextResponse } from 'next/server'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { getSlots } from '@/utils/speaker-invites/slots'
import { isISODate } from '@/utils/speaker-invites/time'
import { forbidden, inviterContext, noStore } from '@/utils/speaker-invites/http'
import { resolveProgram } from '@/utils/speaker-invites/programs'

/**
 * GET /api/speaker-invites/slots?type={programId}&from=YYYY-MM-DD&to=YYYY-MM-DD[&ecclesia=X]
 *   → { ecclesia, type, slots: Slot[] }
 *
 * For the composer. Every expected meeting day of the program's linked
 * schedule comes back labelled OPEN / FILLED / NO_MEETING (never hidden). A
 * program with no linked schedule (Lecture by default) returns [] — its dates
 * are typed by hand.
 */
export async function GET(request: Request) {
  const ctx = await inviterContext()
  if (!ctx.ok) return ctx.response
  const params = new URL(request.url).searchParams
  const ecclesia = params.get('ecclesia') || ctx.person.ecclesia
  if (!canSendSpeakerInvite(ctx.person, ctx.role, ecclesia)) return forbidden()

  const type = params.get('type') ?? ''
  const from = params.get('from')
  const to = params.get('to')
  if (!type || !isISODate(from) || !isISODate(to) || from > to) {
    return NextResponse.json({ error: 'type, from and to (YYYY-MM-DD) are required.', code: 'INVALID_INPUT' }, { status: 400 })
  }
  const resolved = await resolveProgram(ecclesia, type)
  if (!resolved) return NextResponse.json({ error: 'Unknown invitation type.', code: 'INVALID_INPUT' }, { status: 400 })
  const slots = await getSlots(ecclesia, type, from, to, resolved.slot)
  return NextResponse.json({ ecclesia, type, slots }, { headers: noStore })
}
