import { NextResponse } from 'next/server'
import { inviteProgramRepository } from '@my/app/provider/dynamodb/repositories/invite-program-repository'
import { getScheduleRegistry } from '@my/app/provider/schedule-sources/registry'
import {
  builtInProgram,
  isReservedProgramId,
  linkOptions,
  parseProgramInput,
  validatePrograms,
  type InviteProgram,
} from '@my/app/provider/dynamodb/invite-program-types'
import { canSendSpeakerInvite } from '@/utils/speaker-invite-permissions'
import { forbidden, inviterContext, noStore, readJson } from '@/utils/speaker-invites/http'

/**
 * Invitation programs of one ecclesia (docs/SPEAKER_INVITATIONS.md §3a).
 *
 * GET /api/speaker-invites/programs[?ecclesia=X]
 *   → { ecclesia, programs: InviteProgram[], linkOptions: LinkOption[] }
 *     `linkOptions` = every "names a person" field of the ecclesia's
 *     registered schedules (empty → "Connect a schedule first").
 * PUT /api/speaker-invites/programs  { ecclesia?, programs: [...] }
 *   → { ecclesia, programs } | 400 { error, errors[] }
 *     Saves the programs sent. Programs are never deleted (switch one off);
 *     a core program sent back unchanged stays built-in (nothing written).
 *
 * Same gate as sending (§2): the owner, or the RB / a Rep OF the ecclesia.
 * The ecclesia defaults to the caller's own; only the owner may name another.
 */

async function context(request: Request, ecclesiaFromBody?: unknown) {
  const ctx = await inviterContext()
  if (!ctx.ok) return { ok: false as const, response: ctx.response }
  const fromQuery = new URL(request.url).searchParams.get('ecclesia')
  const named = typeof ecclesiaFromBody === 'string' && ecclesiaFromBody ? ecclesiaFromBody : fromQuery
  const ecclesia = named || ctx.person.ecclesia
  if (!ecclesia || !canSendSpeakerInvite(ctx.person, ctx.role, ecclesia)) return { ok: false as const, response: forbidden() }
  return { ok: true as const, ctx, ecclesia }
}

export async function GET(request: Request) {
  const c = await context(request)
  if (!c.ok) return c.response
  const [programs, registry] = await Promise.all([
    inviteProgramRepository.listPrograms(c.ecclesia),
    getScheduleRegistry(c.ecclesia),
  ])
  return NextResponse.json(
    { ecclesia: c.ecclesia, programs, linkOptions: linkOptions(registry.filter((e) => e.active)) },
    { headers: noStore }
  )
}

/** A core program sent back exactly as its built-in default: nothing to store. */
function isUnchangedBuiltIn(p: InviteProgram): boolean {
  if (!isReservedProgramId(p.programId)) return false
  const d = builtInProgram(p.programId)
  if (!d) return false
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  return (
    p.name === d.name &&
    p.phrase === d.phrase &&
    !p.about &&
    p.who === d.who &&
    p.where === d.where &&
    same(p.link, d.link) &&
    p.lengthMinutes === d.lengthMinutes &&
    p.active === d.active &&
    p.order === d.order
  )
}

export async function PUT(request: Request) {
  const body = await readJson(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_INPUT' }, { status: 400 })
  const c = await context(request, body.ecclesia)
  if (!c.ok) return c.response
  if (!Array.isArray(body.programs) || body.programs.length === 0 || body.programs.length > 30) {
    return NextResponse.json({ error: 'Send between 1 and 30 programs.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const submitted: InviteProgram[] = []
  for (const [i, raw] of (body.programs as unknown[]).entries()) {
    const parsed = parseProgramInput(raw, i)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error, errors: [parsed.error], code: 'INVALID_INPUT' }, { status: 400 })
    submitted.push(parsed.program)
  }

  const [existing, registry] = await Promise.all([
    inviteProgramRepository.listPrograms(c.ecclesia),
    getScheduleRegistry(c.ecclesia),
  ])
  // Validate the list as it will read after saving: what was sent, plus any
  // stored program that wasn't sent (programs are never deleted).
  const sentIds = new Set(submitted.map((p) => p.programId))
  const final = [...submitted, ...existing.filter((p) => !sentIds.has(p.programId))]
  const errors = validatePrograms(final, registry)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0], errors, code: 'INVALID_INPUT' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const toStore = submitted
    .filter((p) => {
      const before = existing.find((e) => e.programId === p.programId)
      // A built-in default sent back unchanged stays unstored (no seeding write).
      return !(before?.builtIn && isUnchangedBuiltIn(p))
    })
    .map((p) => ({ ...p, updatedBy: c.ctx.person.personId, updatedAt: now }))
  await inviteProgramRepository.putPrograms(c.ecclesia, toStore)

  return NextResponse.json(
    { ecclesia: c.ecclesia, programs: await inviteProgramRepository.listPrograms(c.ecclesia) },
    { headers: noStore }
  )
}
