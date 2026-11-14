import { NextRequest, NextResponse } from 'next/server'
import { scheduleRegistryRepository } from '@my/app/provider/dynamodb/repositories/schedule-registry-repository'
import { syncEntry } from '@my/app/provider/schedule-sources/sync'

/**
 * Nightly schedule sync (docs/ECCLESIA_SCHEDULES.md §API).
 *
 * One Query of every stored registry entry (pattern `scheduleSourcesAll` —
 * never a Scan), then each ACTIVE google-sheets entry is read and its rows
 * replaced in that ecclesia's own partition. Site-configured (Toronto East)
 * entries are skipped: the sheet webhook keeps them current. Native entries
 * have nothing to read.
 *
 * One failing sheet never stops the others; every outcome is reported.
 * Bearer-authenticated with EMAIL_SENDER_SECRET, like the other cron endpoints.
 * The scheduler entry is an owner step (EXTERNAL_CHANGES.md).
 */

async function run(request: NextRequest) {
  const secret = process.env.EMAIL_SENDER_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const entries = (await scheduleRegistryRepository.listAllEntries()).filter(
      (e) => e.active && e.source.kind === 'google-sheets'
    )
    const results = []
    for (const entry of entries) {
      try {
        const outcome = await syncEntry(entry)
        results.push({
          ecclesiaId: entry.ecclesiaId,
          scheduleId: entry.scheduleId,
          status: outcome.status,
          ...(outcome.status === 'ok' ? { rows: outcome.rows, failed: outcome.failed } : {}),
          ...(outcome.status === 'error' ? { code: outcome.code } : {}),
        })
      } catch (error) {
        console.error('[schedule-sources] sync failed:', entry.ecclesiaId, entry.scheduleId, error)
        results.push({ ecclesiaId: entry.ecclesiaId, scheduleId: entry.scheduleId, status: 'error', code: 'UNEXPECTED' })
      }
    }
    return NextResponse.json({
      success: true,
      synced: results.filter((r) => r.status === 'ok').length,
      failed: results.filter((r) => r.status === 'error').length,
      results,
    })
  } catch (error) {
    console.error('[schedule-sources] nightly sync failed:', error)
    return NextResponse.json({ error: 'Nightly schedule sync failed' }, { status: 500 })
  }
}

/** EventBridge/Vercel schedulers issue a GET; the work is identical. */
export async function GET(request: NextRequest) {
  return run(request)
}

export async function POST(request: NextRequest) {
  return run(request)
}
