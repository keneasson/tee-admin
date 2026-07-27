import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  resolveAndSendExhorterHeadsUp,
  computeNextTargetSunday,
} from '@/utils/email/exhorter-heads-up'

/**
 * Exhorter heads-up — manual admin trigger (#124, slice A).
 *
 * POST { date?, test?, dryRun? }
 *   - `test` DEFAULTS TRUE. Test mode NEVER emails the real exhorter — it sends to
 *     the requesting admin so the whole flow can be verified safely.
 *   - `date` omitted → the next target Sunday (~2 weeks out) is computed; STILL
 *     defaults to test.
 *   - `dryRun` resolves + reports without sending.
 *
 * NO cron / auto-send here — that is slice B.
 *
 * TODO(multi-tenant, #124): gates on the GLOBAL admin/owner role. When multi-tenant
 * lands, authorize against the caller's managedRegions for the host ecclesia.
 */

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = ((session.user as any).role as string) || ROLES.GUEST
  if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { email: session.user.email }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error

  try {
    const body = await request.json().catch(() => ({}))
    const date: string = typeof body?.date === 'string' && body.date.trim()
      ? body.date.trim()
      : computeNextTargetSunday()
    // SAFE DEFAULT: test is true unless explicitly set to boolean false.
    const test: boolean = body?.test === false ? false : true
    const dryRun: boolean = body?.dryRun === true

    const report = await resolveAndSendExhorterHeadsUp({
      date,
      test,
      dryRun,
      requesterEmail: gate.email!,
    })

    return NextResponse.json({ ok: true, report })
  } catch (error) {
    console.error('Error sending exhorter heads-up:', error)
    return NextResponse.json({ error: 'Failed to send exhorter heads-up' }, { status: 500 })
  }
}
