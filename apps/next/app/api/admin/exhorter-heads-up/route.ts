import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import {
  resolveAndSendExhorterHeadsUp,
  computeNextTargetSunday,
} from '@/utils/email/exhorter-heads-up'
import { prepareHeadsUpForReview } from '@/utils/email/exhorter-heads-up-review'

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
    const dryRun: boolean = body?.dryRun === true

    /**
     * RESEND THE QA COPY — the default, and how you re-test after fixing the
     * Program.
     *
     * Correct the schedule, wait for the sheet to sync, then call this: it
     * re-resolves, re-renders and redirects the corrected email to you, exactly
     * as the Saturday job does. Same subject, same body, new footer link.
     *
     * It supersedes any earlier unsent copy for that Sunday, so the link in the
     * WRONG email you are looking at stops working rather than sitting there as
     * a way to send the mistake. (Even if it were pressed, the content
     * fingerprint would refuse — but "this link has been superseded" is a
     * better answer than a mismatch.)
     */
    if (!dryRun && body?.mode !== 'legacy-test') {
      const result = await prepareHeadsUpForReview({
        date,
        reviewerEmail: body?.to === 'me' ? gate.email! : undefined,
      })
      return NextResponse.json({
        ok: true,
        redirectedTo: result.reviewerEmail,
        parked: result.parked,
        supersededCopies: result.supersededCopies,
        report: { ...result.report, rendered: undefined },
      })
    }

    // The original slice-A behaviour, kept for a resolve-only report and for
    // the `[TEST]`-prefixed variant. NOT the QA path: that subject and that
    // recipient make it a different email from the one the brother receives.
    const test: boolean = body?.test === false ? false : true
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
