import { NextResponse } from 'next/server'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import { requireAssurance } from '../auth-trust'
import { personForSessionEmail } from '../session-person'
import { canManageEcclesiaSchedules } from '../ecclesia-schedule-permissions'

export const noStore = { 'Cache-Control': 'private, no-store' }

export const forbidden = () =>
  NextResponse.json(
    { error: 'Only the Recording Brother or a Rep of this ecclesia can manage its schedules.', code: 'FORBIDDEN' },
    { status: 403, headers: noStore }
  )

export const badRequest = (error: string, code = 'INVALID_INPUT', extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, code, ...extra }, { status: 400, headers: noStore })

/**
 * The signed-in manager behind a schedule-registry request, and the ecclesia
 * they act for: their own, unless they are the owner and `?ecclesia=` names
 * another. Gated by `canManageEcclesiaSchedules` (owner, or RB / Rep of that
 * ecclesia) — every `/api/ecclesia-schedules` route goes through here.
 */
export async function scheduleManagerContext(request: Request): Promise<
  | { ok: true; person: PersonRecord; role: string | null; ecclesia: string; email: string }
  | { ok: false; response: NextResponse }
> {
  const gate = await requireAssurance('authenticated')
  if (!gate.ok) return gate
  const person = await personForSessionEmail(gate.ctx.email)
  if (!person) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No directory record for this account.' }, { status: 403, headers: noStore }),
    }
  }
  const sessionRole = (gate.ctx.session?.user as { role?: string } | undefined)?.role ?? null
  const role = person.role ?? sessionRole
  const ecclesia = new URL(request.url).searchParams.get('ecclesia')?.trim() || person.ecclesia || ''
  if (!canManageEcclesiaSchedules(person, role, ecclesia)) return { ok: false, response: forbidden() }
  return { ok: true, person, role, ecclesia, email: gate.ctx.email ?? "" }
}

export async function readJson(request: Request): Promise<Record<string, any> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}
