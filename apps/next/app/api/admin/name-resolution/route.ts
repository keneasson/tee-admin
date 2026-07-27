import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { GoogleSheetsService } from '@my/app/provider/sync/google-sheets-service'
import {
  resolveNames,
  toDirectoryPerson,
  type DirectoryPerson,
} from '@my/app/utils/name-resolver-directory'
import { syncVisitingSpeakers } from '@my/app/provider/sync/visiting-speakers-ingest'
import { getTeeServicesConfig } from '../../../../utils/tee-services-config'

/**
 * Admin diagnostic + write path for the schedule name↔member resolver
 * (keystone — issue #109).
 *
 * GET  — READ-ONLY diagnostic (increment 2). Loads the directory as candidates,
 *        harvests the free-text names from the memorial schedule (inline role
 *        columns + the "Visiting Speakers" tab), runs the pure resolver, and
 *        returns a grouped match report so a human can eyeball match quality
 *        BEFORE triggering any write. ZERO mutations.
 *
 * POST — WRITE increment. AFTER reviewing the GET diagnostic, an owner/admin
 *        triggers ingest of confident not-found visiting speakers into emailless
 *        `visitor` PersonRecords (see visiting-speakers-ingest). Defaults to
 *        dryRun; the caller must pass { dryRun: false } to actually write.
 *        This is NEVER auto-fired on sheet sync.
 *
 * // NEXT INCREMENT: the RB/Rep discrepancy notification + exhorter heads-up
 * // email are deliberately NOT here — per project rules this increment has no
 * // notification/email side effects. See visiting-speakers-ingest.ts.
 */

// Memorial schedule columns whose cells hold a person's name (case-insensitive
// header match). Readings/hymns/collection amounts etc. are intentionally excluded.
const MEMORIAL_NAME_COLUMNS = ['Preside', 'Exhort', 'Organist', 'Steward', 'Doorkeeper']

// On the "Visiting Speakers" tab we don't control the layout, so harvest cells
// from any column whose header looks like it holds a person's name.
const VISITING_NAME_HEADER_RE = /(name|speaker|exhort|brother|visitor|preside)/i

const MAX_SAMPLES = 50

/** Pick the string values from a sheet under headers matching a predicate. */
function harvestColumn(
  headers: string[],
  rows: any[][],
  matches: (header: string) => boolean
): string[] {
  const cols = headers.reduce<number[]>((acc, h, i) => {
    if (typeof h === 'string' && matches(h)) acc.push(i)
    return acc
  }, [])
  const out: string[] = []
  for (const row of rows) {
    for (const col of cols) {
      const cell = row[col]
      if (typeof cell === 'string' && cell.trim()) out.push(cell)
    }
  }
  return out
}

export async function GET(_request: NextRequest) {
  try {
    // --- Auth gate: owner/admin only (matches other admin routes) ---
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // --- Load directory candidates (all PROFILE records, paginated) ---
    const candidates: DirectoryPerson[] = []
    let lastEvaluatedKey: Record<string, any> | undefined
    do {
      const page = await personRepository.listAll({ lastEvaluatedKey })
      for (const record of page.items) {
        candidates.push(toDirectoryPerson(record))
      }
      lastEvaluatedKey = page.lastEvaluatedKey
    } while (lastEvaluatedKey)

    // --- Resolve the memorial sheet id from the Google config ---
    const config = getTeeServicesConfig()
    const memorial = config.sheet_ids?.['memorial']
    if (!memorial?.key) {
      return NextResponse.json(
        { error: 'Memorial sheet is not configured (sheet_ids.memorial missing)' },
        { status: 500 }
      )
    }
    const sheetId = memorial.key
    const sheets = new GoogleSheetsService()

    // --- Harvest names from the main schedule's inline role columns ---
    const main = await sheets.getSheetDataWithHeaders(sheetId, 'A:Z')
    const roleColumnsFound = main.headers.filter(
      (h) => typeof h === 'string' && MEMORIAL_NAME_COLUMNS.some((c) => c.toLowerCase() === h.trim().toLowerCase())
    )
    const roleNames = harvestColumn(main.headers, main.rows, (h) =>
      MEMORIAL_NAME_COLUMNS.some((c) => c.toLowerCase() === h.trim().toLowerCase())
    )

    // --- Harvest names from the "Visiting Speakers" tab (may not exist) ---
    let visitingNames: string[] = []
    let visitingTabError: string | null = null
    try {
      const visiting = await sheets.getSheetDataWithHeaders(sheetId, "'Visiting Speakers'!A:Z")
      visitingNames = harvestColumn(visiting.headers, visiting.rows, (h) => VISITING_NAME_HEADER_RE.test(h))
      // Fallback: no header matched (unknown layout) — take the first column,
      // which is conventionally the speaker's name. Placeholders/non-names are
      // filtered downstream by the resolver.
      if (visitingNames.length === 0) {
        visitingNames = visiting.rows
          .map((r) => r[0])
          .filter((c): c is string => typeof c === 'string' && !!c.trim())
      }
    } catch (error) {
      visitingTabError = error instanceof Error ? error.message : 'Failed to read Visiting Speakers tab'
    }

    const allNames = [...roleNames, ...visitingNames]
    const report = resolveNames(allNames, candidates)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      requestedBy: session.user.email,
      sources: {
        directoryCandidates: candidates.length,
        roleColumnsFound,
        roleNameCells: roleNames.length,
        visitingSpeakerCells: visitingNames.length,
        visitingTabError,
      },
      counts: {
        uniqueNames:
          report.matched.length + report.typos.length + report.ambiguous.length + report.notFound.length,
        matched: report.matched.length,
        typos: report.typos.length,
        ambiguous: report.ambiguous.length,
        notFound: report.notFound.length,
      },
      samples: {
        matched: report.matched.slice(0, MAX_SAMPLES).map((m) => ({
          input: m.input,
          personId: m.person.personId,
          displayName: m.person.displayName,
          ecclesia: m.person.ecclesia,
        })),
        typos: report.typos.slice(0, MAX_SAMPLES).map((t) => ({
          input: t.input,
          suggestions: t.suggestions.map((s) => ({
            personId: s.person.personId,
            displayName: s.person.displayName,
            ecclesia: s.person.ecclesia,
            distance: s.distance,
          })),
        })),
        ambiguous: report.ambiguous.slice(0, MAX_SAMPLES).map((a) => ({
          input: a.input,
          candidates: a.candidates.map((c) => ({
            personId: c.personId,
            displayName: c.displayName,
            ecclesia: c.ecclesia,
          })),
        })),
        notFound: report.notFound.slice(0, MAX_SAMPLES).map((n) => n.input),
      },
    })
  } catch (error) {
    console.error('❌ Name-resolution diagnostic failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run name-resolution diagnostic',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST — trigger the visiting-speaker ingest (WRITE increment, issue #109).
 *
 * Owner/admin only. A human runs this AFTER reviewing the GET diagnostic.
 * Defaults to a dry run; pass { "dryRun": false } to actually create records.
 * Creates emailless `visitor` PersonRecords for confident not-found speakers
 * under their home ecclesia. Idempotent. No emails/notifications are sent.
 */
export async function POST(request: NextRequest) {
  try {
    // --- Auth gate: owner/admin only (matches GET) ---
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const userRole = (session.user as any).role || 'guest'
    if (!['admin', 'owner'].includes(userRole)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Default to dryRun for safety — a real write requires explicit dryRun:false.
    let dryRun = true
    try {
      const body = await request.json()
      if (body && typeof body.dryRun === 'boolean') dryRun = body.dryRun
    } catch {
      // No/invalid JSON body → keep the safe default (dry run).
    }

    // --- Resolve the memorial sheet id from the Google config ---
    const config = getTeeServicesConfig()
    const memorial = config.sheet_ids?.['memorial']
    if (!memorial?.key) {
      return NextResponse.json(
        { error: 'Memorial sheet is not configured (sheet_ids.memorial missing)' },
        { status: 500 }
      )
    }

    const result = await syncVisitingSpeakers(memorial.key, { dryRun })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      requestedBy: session.user.email,
      ...result,
      counts: {
        totalRows: result.totalRows,
        created: result.created.length,
        skipped: result.skipped.length,
      },
    })
  } catch (error) {
    console.error('❌ Visiting-speaker ingest failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run visiting-speaker ingest',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
