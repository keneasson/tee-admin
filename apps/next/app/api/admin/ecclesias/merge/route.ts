import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { mergeEcclesia, MergeNotFoundError } from '@/utils/ecclesia-merge-service'

/**
 * POST /api/admin/ecclesias/merge — owner/admin only.
 *
 * Body: { source: string, target: string, dryRun?: boolean (default true) }
 *
 * Folds the `source` ecclesia record into `target` and deletes the source
 * (see utils/ecclesia-merge.ts for exactly what moves). A dry run returns the
 * change list and writes nothing; send `dryRun: false` to apply it.
 *
 * 200 { dryRun, plan, result? }   plan.blockers non-empty → nothing was written
 * 409 when a real run is blocked; 500 { plan, result } when a step failed
 * (the source is NOT deleted then, and a retry is safe).
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = ((session.user as any).role as string) || ROLES.GUEST
  if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
    return NextResponse.json({ error: 'Admin or Owner role required' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { source?: unknown; target?: unknown; dryRun?: unknown } | null
  const source = typeof body?.source === 'string' ? body.source.trim() : ''
  const target = typeof body?.target === 'string' ? body.target.trim() : ''
  if (!source || !target) {
    return NextResponse.json({ error: 'source and target are required' }, { status: 400 })
  }
  const dryRun = body?.dryRun !== false

  try {
    const outcome = await mergeEcclesia(source, target, { dryRun })
    if (!dryRun && outcome.plan.blockers.length > 0) {
      return NextResponse.json({ error: outcome.plan.blockers.join(' '), ...outcome }, { status: 409 })
    }
    if (outcome.result?.failed) {
      return NextResponse.json(
        {
          error: `Merge stopped at a ${outcome.result.failed.step.kind} step: ${outcome.result.failed.error}. ` +
            `${source} was not deleted; it is safe to run the merge again.`,
          ...outcome,
        },
        { status: 500 }
      )
    }
    return NextResponse.json(outcome)
  } catch (error) {
    if (error instanceof MergeNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    console.error('ecclesia merge failed:', error)
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 })
  }
}
