/**
 * Visiting-speaker ingest (keystone — issue #109, WRITE increment).
 *
 * Reads the memorial "Visiting Speakers" tab and, for CONFIDENT not-found
 * names, creates an emailless `visitor` PersonRecord under the speaker's home
 * ecclesia so the schedule name resolver can match them next time. This is the
 * WRITE half of the resolver keystone: increment 2 shipped the read-only
 * diagnostic; this turns reviewed not-found names into real directory records.
 *
 * DESIGN NOTES
 *   - ADMIN-TRIGGERED, not auto-firing. This module never runs itself — it is
 *     invoked from an owner/admin-gated POST route after a human has reviewed
 *     the diagnostic. It is NOT wired into any Google Sheet sync/cron.
 *   - Only CONFIDENT not-found names are created. matched / typo / ambiguous
 *     names are left for a human — a typo or ambiguous name is very likely an
 *     EXISTING member and auto-creating would duplicate them.
 *   - Idempotent. Candidates are re-resolved before each create against a list
 *     that grows as records are made, so a name repeated within one batch (or
 *     on a second run) matches the record it just created — no duplicates.
 *   - No emails / notifications. See the NEXT INCREMENT note below.
 *
 * I/O is injectable (sheets + repository) so this unit-tests with fixtures and
 * never touches live DynamoDB or Sheets in tests.
 */
import { GoogleSheetsService } from './google-sheets-service'
import { personRepository } from '../dynamodb/repositories/person-repository'
import {
  resolveNames,
  toDirectoryPerson,
  type DirectoryPerson,
} from '../../utils/name-resolver-directory'

/** Honorifics stripped before splitting a name (mirrors the resolver). */
const HONORIFIC_RE = /^(bro\.?|brother|bre\.?|sis\.?|sister|mr\.?|mrs\.?|ms\.?|dr\.?)$/i

/** Header that holds the speaker's name on the "Visiting Speakers" tab. */
const NAME_HEADER_RE = /(name|speaker|exhort|brother|visitor|preside)/i
/** Header that holds the speaker's home ecclesia. */
const ECCLESIA_HEADER_RE = /(ecclesia|assembly|congregation|meeting|home|from)/i

/** The minimal repository surface this module needs — lets tests inject a fake. */
export interface PersonRepositoryLike {
  listAll: (typeof personRepository)['listAll']
  create: (typeof personRepository)['create']
}

/** One row of the "Visiting Speakers" tab we care about. */
export interface VisitingSpeaker {
  /** Free-text speaker name as written in the sheet (may carry honorifics). */
  name: string
  /** Home ecclesia column value, if present. */
  ecclesia?: string
}

export interface SyncOptions {
  /** When true, resolve + report what WOULD be created without writing. */
  dryRun?: boolean
  sheets?: GoogleSheetsService
  repository?: PersonRepositoryLike
}

export interface SyncCreated {
  name: string
  ecclesia: string
  firstName: string
  lastName: string
  /** Set only on a real (non-dry-run) create. */
  personId?: string
}

export interface SyncSkipped {
  name: string
  reason: string
}

export interface SyncResult {
  dryRun: boolean
  sheetId: string
  totalRows: number
  created: SyncCreated[]
  skipped: SyncSkipped[]
}

/** Find the first column index whose header matches, or null if none. */
function findColumn(headers: string[], re: RegExp): number | null {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]
    if (typeof h === 'string' && re.test(h)) return i
  }
  return null
}

/**
 * Split a free-text name into first/last, stripping honorifics and preserving
 * original casing. Mirrors the resolver's tokenization (last token → last name,
 * middles dropped) so a created record resolves back to the same input.
 */
export function splitSpeakerName(raw: string): { firstName: string; lastName: string } {
  const tokens = (raw ?? '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !HONORIFIC_RE.test(t))
  const firstName = tokens[0] ?? raw.trim()
  const lastName = tokens.length > 1 ? tokens[tokens.length - 1] : ''
  return { firstName, lastName }
}

/**
 * Read the memorial "Visiting Speakers" tab into `{ name, ecclesia? }` rows.
 * Falls back to the first column for the name when no header matches (the tab
 * layout is not something we control). Placeholder/blank names are kept here
 * and filtered downstream by the resolver.
 */
export async function readVisitingSpeakers(
  sheetId: string,
  sheets: GoogleSheetsService = new GoogleSheetsService()
): Promise<VisitingSpeaker[]> {
  const { headers, rows } = await sheets.getSheetDataWithHeaders(
    sheetId,
    "'Visiting Speakers'!A:Z"
  )

  const nameCol = findColumn(headers, NAME_HEADER_RE) ?? 0
  const ecclesiaCol = findColumn(headers, ECCLESIA_HEADER_RE)

  const out: VisitingSpeaker[] = []
  for (const row of rows) {
    const nameCell = row[nameCol]
    const name = typeof nameCell === 'string' ? nameCell.trim() : ''
    if (!name) continue
    const ecclesiaCell = ecclesiaCol != null ? row[ecclesiaCol] : undefined
    const ecclesia = typeof ecclesiaCell === 'string' ? ecclesiaCell.trim() : undefined
    out.push({ name, ecclesia: ecclesia || undefined })
  }
  return out
}

/**
 * Ingest visiting speakers: create emailless `visitor` records for confident
 * not-found names under their home ecclesia. Idempotent and admin-triggered.
 *
 * @param sheetId  the memorial spreadsheet id
 * @param options  dryRun + injectable sheets/repository for testing
 */
export async function syncVisitingSpeakers(
  sheetId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const dryRun = options.dryRun ?? false
  const sheets = options.sheets ?? new GoogleSheetsService()
  const repo: PersonRepositoryLike = options.repository ?? personRepository

  const speakers = await readVisitingSpeakers(sheetId, sheets)

  // Load the directory once. We mutate this in-memory list as records are
  // created so idempotency holds WITHIN a run (a name repeated in the same
  // batch resolves as matched after its first creation).
  const candidates: DirectoryPerson[] = []
  let lastEvaluatedKey: Record<string, any> | undefined
  do {
    const page = await repo.listAll({ lastEvaluatedKey })
    for (const record of page.items) candidates.push(toDirectoryPerson(record))
    lastEvaluatedKey = page.lastEvaluatedKey
  } while (lastEvaluatedKey)

  const result: SyncResult = {
    dryRun,
    sheetId,
    totalRows: speakers.length,
    created: [],
    skipped: [],
  }

  for (const speaker of speakers) {
    // Re-resolve against the CURRENT candidate list (includes anything created
    // earlier in this run) so a repeated name never creates a duplicate.
    const report = resolveNames([speaker.name], candidates)

    if (report.notFound.length === 0) {
      const reason = report.matched.length
        ? 'already in directory'
        : report.typos.length
          ? 'possible typo — left for human review'
          : report.ambiguous.length
            ? 'ambiguous — left for human review'
            : 'placeholder/blank'
      result.skipped.push({ name: speaker.name, reason })
      continue
    }

    const ecclesia = speaker.ecclesia?.trim()
    if (!ecclesia) {
      result.skipped.push({ name: speaker.name, reason: 'no home ecclesia column value' })
      continue
    }

    const { firstName, lastName } = splitSpeakerName(speaker.name)

    let personId: string | undefined
    if (!dryRun) {
      const created = await repo.create({
        firstName,
        lastName,
        ecclesia,
        memberStatus: 'visitor',
        role: 'guest',
        source: 'schedule-import',
        sourceRef: `visiting-speakers:${sheetId}`,
      })
      personId = created.personId
    }

    result.created.push({ name: speaker.name, ecclesia, firstName, lastName, personId })

    // Add to the in-memory candidate list (dry-run too) so a second occurrence
    // of this name in the same batch resolves as matched — dryRun reports
    // exactly what a real run would create, no phantom duplicates.
    candidates.push({
      personId: personId ?? `dry-${result.created.length}`,
      firstName,
      lastName,
      ecclesia,
      displayName: `${firstName} ${lastName}`.trim(),
    })
  }

  return result

  // NEXT INCREMENT (deliberately NOT in this write increment — per project
  // rules, no notification/email side effects here):
  //   - RB/Rep discrepancy notification for typo/ambiguous names (link to fix).
  //   - Exhorter heads-up email (2 Saturdays before, visitor→lunch, +Zoom).
  // Both are follow-ups a human opts into; neither fires from this ingest.
}
