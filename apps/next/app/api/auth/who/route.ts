import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { mayActAs, peopleWhoCanUse, toChoices } from '@/utils/sign-in-identity'

/**
 * "Are you A or B?" (R2) — who is using the address this session proved.
 *
 *   GET  → { choices, current, mustChoose }: everyone who can use the
 *          session's proven address (derived on the server from the session,
 *          never from the client).
 *   POST { personId } → 200 if that person can use the proven address, else
 *          403. The client then calls `update({ personId })`; the jwt callback
 *          re-checks the same rule before switching, so this route is the
 *          friendly answer and the jwt callback is the enforcement.
 */

type SessionUser = { email?: string | null; personId?: string | null; signInEmail?: string | null; chooseIdentity?: boolean }

async function provenAddress() {
  const session = await auth()
  const user = session?.user as SessionUser | undefined
  if (!user?.email) return null
  return { user, address: user.signInEmail || user.email }
}

export async function GET() {
  const s = await provenAddress()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const choices = toChoices(await peopleWhoCanUse(s.address))
  return NextResponse.json({
    choices,
    current: s.user.personId ?? null,
    mustChoose: !!s.user.chooseIdentity,
  })
}

export async function POST(request: NextRequest) {
  const s = await provenAddress()
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { personId } = (await request.json().catch(() => ({}))) as { personId?: string }
  if (!personId) return NextResponse.json({ error: 'personId is required' }, { status: 400 })
  if (!(await mayActAs(personId, s.address))) {
    return NextResponse.json({ error: "That person doesn't use this address" }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
