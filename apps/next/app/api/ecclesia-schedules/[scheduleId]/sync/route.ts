import { NextResponse } from 'next/server'
import { scheduleEcclesiaId } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import { scheduleRegistryRepository } from '@my/app/provider/dynamodb/repositories/schedule-registry-repository'
import { getScheduleRegistry } from '@my/app/provider/schedule-sources/registry'
import { syncEntry, type SyncOutcome } from '@my/app/provider/schedule-sources/sync'
import { serviceAccountEmail } from '@my/app/provider/schedule-sources/google-sheets'
import { badRequest, noStore, readJson, scheduleManagerContext } from '@/utils/ecclesia-schedules/http'
import { draftEntry, isScheduleKind } from '@/utils/ecclesia-schedules/entries'

/**
 * POST /api/ecclesia-schedules/[scheduleId]/sync[?dryRun=1][&ecclesia=X]
 *
 *   ?dryRun=1  → 200 { status: 'preview', rows (first 5 mapped), total }. Writes NOTHING.
 *                Body may carry an unsaved draft ({ source, mapping }) so the
 *                setup page can preview before saving; else the stored entry.
 *   otherwise  → reads the stored entry's sheet and replaces this ecclesia's
 *                rows of that kind (its own partition). 200 { status: 'ok', rows, … }
 *
 * The sheet must be claimed by this ecclesia. Site-configured schedules are
 * skipped (the sheet webhook keeps them current).
 */
export async function POST(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  const ctx = await scheduleManagerContext(request)
  if (!ctx.ok) return ctx.response
  const { scheduleId } = await params
  if (!isScheduleKind(scheduleId)) return badRequest('Unknown schedule.')
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const body = (await readJson(request)) ?? {}

  let entry
  if (dryRun && body.source) {
    const draft = draftEntry(ctx.ecclesia, scheduleId, body, { updatedBy: ctx.person.personId, now: new Date().toISOString() })
    if (!draft.ok) return badRequest(draft.error)
    entry = draft.entry
  } else {
    entry = (await getScheduleRegistry(ctx.ecclesia)).find((e) => e.scheduleId === scheduleId)
    if (!entry) {
      return NextResponse.json({ error: 'This schedule is not set up yet.', code: 'NOT_FOUND' }, { status: 404, headers: noStore })
    }
  }

  if (entry.source.kind === 'google-sheets') {
    const claim = entry.source.spreadsheetId ? await scheduleRegistryRepository.getSheetClaim(entry.source.spreadsheetId) : null
    if (!claim || claim.ecclesiaId !== scheduleEcclesiaId(ctx.ecclesia)) {
      return NextResponse.json(
        { error: 'Connect this sheet first (paste its link on the setup page).', code: 'CLAIMED' },
        { status: 409, headers: noStore }
      )
    }
  }

  const outcome = await syncEntry(entry, { dryRun })
  return NextResponse.json(
    outcome.status === 'error' && outcome.code === 'NOT_SHARED'
      ? { ...outcome, serviceAccountEmail: serviceAccountEmail() }
      : outcome,
    { status: outcomeStatus(outcome), headers: noStore }
  )
}

function outcomeStatus(outcome: SyncOutcome): number {
  if (outcome.status !== 'error') return 200
  switch (outcome.code) {
    case 'NOT_SHARED':
      return 409
    case 'READ_FAILED':
    case 'NOT_CONFIGURED':
      return 502
    default:
      return 400
  }
}
