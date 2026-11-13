import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import { requireAssurance, type Trust } from '../auth-trust'
import { personForSessionEmail } from '../session-person'
import { RECOGNITION_COOKIE } from '../recognition-cookie'
import type { ServiceError } from './service'

/** HTTP status for a service error. Conflicts on state are 409. */
export function errorStatus(code: ServiceError['code']): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404
    case 'SEND_FAILED':
      return 502
    case 'INVALID_INPUT':
    case 'DATES_NOT_OPEN':
    case 'DATE_NOT_OFFERED':
    case 'DATE_IN_PAST':
    case 'INVITEE_NOT_FOUND':
    case 'INVITEE_NO_EMAIL':
    case 'NOT_INVITABLE':
    case 'SWAP_NOT_AVAILABLE':
    case 'TARGET_UNREACHABLE':
      return 400
    default:
      return 409
  }
}

export function serviceErrorResponse(err: ServiceError): NextResponse {
  return NextResponse.json({ error: err.message, ...err }, { status: errorStatus(err.code) })
}

export const noStore = { 'Cache-Control': 'private, no-store' }

/**
 * The inviter behind an admin request: an authenticated session, its
 * PersonRecord, and the role to check against `canSendSpeakerInvite`.
 */
export async function inviterContext(): Promise<
  | { ok: true; person: PersonRecord; role: string | null; trust: Trust }
  | { ok: false; response: NextResponse }
> {
  const gate = await requireAssurance('authenticated')
  if (!gate.ok) return gate
  const person = await personForSessionEmail(gate.ctx.email)
  if (!person) {
    return { ok: false, response: NextResponse.json({ error: 'No directory record for this account.' }, { status: 403 }) }
  }
  const sessionRole = (gate.ctx.session?.user as { role?: string } | undefined)?.role ?? null
  return { ok: true, person, role: person.role ?? sessionRole, trust: gate.ctx.trust }
}

export const forbidden = () =>
  NextResponse.json({ error: 'Only the Recording Brother or a Rep of this ecclesia can do that.' }, { status: 403 })

/**
 * The ecclesia token for an invitee request: `?token=` on the link, `token` in
 * a POST body, else the email-link recognition cookie (#252).
 */
export async function readInviteToken(url: string, body?: { token?: unknown } | null): Promise<string | null> {
  const fromQuery = new URL(url).searchParams.get('token')
  if (fromQuery) return fromQuery
  if (body && typeof body.token === 'string' && body.token) return body.token
  try {
    return (await cookies()).get(RECOGNITION_COOKIE)?.value ?? null
  } catch {
    return null
  }
}

export async function readJson(request: Request): Promise<Record<string, any> | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : null
  } catch {
    return null
  }
}
