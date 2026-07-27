/**
 * Visiting-speaker ingest (keystone — issue #109, WRITE increment).
 *
 * Reads the memorial "Visiting Speakers" tab and, for CONFIDENT not-found
 * names, creates a `visitor` PersonRecord under the speaker's home ecclesia so
 * the schedule name resolver can match them next time. This is the WRITE half
 * of the resolver keystone: increment 2 shipped the read-only diagnostic; this
 * turns reviewed not-found names into real directory records.
 *
 * CONTACT INFO + PRIVACY (issue #109 follow-up):
 *   - The tab may now carry an email and/or phone. When an email is present the
 *     record is created the NORMAL way (real EMAIL# item, gsi1 EMAIL# key) so
 *     `getByEmail` finds them; with no email we keep the emailless NOEMAIL#
 *     sentinel path. Phones are stored when present.
 *   - Records we ALREADY auto-created (source:'schedule-import',
 *     memberStatus:'visitor') that are missing an email/phone the sheet now
 *     provides are BACKFILLED in place. 23 emailless records were created before
 *     the sheet carried contact columns; this reconciles them.
 *   - Privacy: on both create and backfill the sensitive fields are set to
 *     `ecclesia_and_connections` so only the speaker's OWN ecclesia (plus the
 *     owner / same-ecclesia admin-recorder-rep via the privacy resolver's role
 *     overrides) can see their info — until the person changes it themselves.
 *
 * CRITICAL SAFETY
 *   - We ONLY ever read/modify records that are BOTH source:'schedule-import'
 *     AND memberStatus:'visitor' (records this ingest created). A name that
 *     resolves to a real member is left completely untouched — never edited,
 *     never given an email.
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
 *     Backfill is idempotent too: an email is only added when the record is
 *     emailless, a phone only when no phone exists yet.
 *   - No emails / notifications. See the NEXT INCREMENT note below.
 *
 * I/O is injectable (sheets + repository + privacy) so this unit-tests with
 * fixtures and never touches live DynamoDB or Sheets in tests.
 */
import { GoogleSheetsService } from './google-sheets-service'
import { personRepository } from '../dynamodb/repositories/person-repository'
import { privacyRepository } from '../dynamodb/repositories/privacy-repository'
import type { PersonRecord, VisibilityLevel } from '../dynamodb/types'
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
/** Header that holds the speaker's email address. */
const EMAIL_HEADER_RE = /e-?mail/i
/** Header that holds the speaker's phone number. */
const PHONE_HEADER_RE = /phone|mobile|cell|tel/i

/**
 * Field visibility applied to every record this ingest touches. Sensitive
 * fields are `ecclesia_and_connections` — same-ecclesia members see them, and
 * the owner / same-ecclesia admin-recorder-rep see them via the role overrides
 * in `PrivacyRepository.canViewField`. Deliberately NOT the literal 'private'
 * level, which would hide the speaker from their own ecclesia too.
 */
export const VISITING_SPEAKER_VISIBILITY: VisibilityLevel = 'ecclesia_and_connections'

const VISITOR_PRIVACY_SETTINGS = {
  showName: VISITING_SPEAKER_VISIBILITY,
  showEmail: VISITING_SPEAKER_VISIBILITY,
  showPhone: VISITING_SPEAKER_VISIBILITY,
  showAddress: VISITING_SPEAKER_VISIBILITY,
  showFamily: VISITING_SPEAKER_VISIBILITY,
} as const

/** The minimal repository surface this module needs — lets tests inject a fake. */
export interface PersonRepositoryLike {
  listAll: (typeof personRepository)['listAll']
  create: (typeof personRepository)['create']
  addEmail: (typeof personRepository)['addEmail']
  addPhone: (typeof personRepository)['addPhone']
  getPhones: (typeof personRepository)['getPhones']
  updatePerson: (typeof personRepository)['updatePerson']
}

/** The minimal privacy surface this module needs — lets tests inject a fake. */
export interface PrivacyRepositoryLike {
  createPrivacySettings: (typeof privacyRepository)['createPrivacySettings']
}

/** One row of the "Visiting Speakers" tab we care about. */
export interface VisitingSpeaker {
  /** Free-text speaker name as written in the sheet (may carry honorifics). */
  name: string
  /** Home ecclesia column value, if present. */
  ecclesia?: string
  /** Email column value, lowercased + trimmed, if present. */
  email?: string
  /** Phone column value, trimmed, if present. */
  phone?: string
}

export interface SyncOptions {
  /** When true, resolve + report what WOULD be created/backfilled without writing. */
  dryRun?: boolean
  sheets?: GoogleSheetsService
  repository?: PersonRepositoryLike
  privacy?: PrivacyRepositoryLike
}

export interface SyncCreated {
  name: string
  ecclesia: string
  firstName: string
  lastName: string
  /** Email the record was (or would be) created with. */
  email?: string
  /** Phone stored (or that would be stored) with the record. */
  phone?: string
  /** True when created via the emailless NOEMAIL# sentinel path. */
  emailless: boolean
  /** Visibility level applied to the sensitive fields (only when an email exists). */
  privacy?: VisibilityLevel
  /** Set only on a real (non-dry-run) create. */
  personId?: string
}

export interface SyncBackfilled {
  name: string
  ecclesia: string
  personId: string
  /** Email added to a previously-emailless record (undefined if none added). */
  addedEmail?: string
  /** Phone added to the record (undefined if none added). */
  addedPhone?: string
  /** Visibility level applied when an email was added. */
  privacy?: VisibilityLevel
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
  backfilled: SyncBackfilled[]
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

/** Read a trimmed string cell, or undefined when blank/missing. */
function cell(row: any[], col: number | null): string | undefined {
  if (col == null) return undefined
  const value = row[col]
  const str = typeof value === 'string' ? value.trim() : ''
  return str || undefined
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
 * Read the memorial "Visiting Speakers" tab into
 * `{ name, ecclesia?, email?, phone? }` rows. Falls back to the first column
 * for the name when no header matches (the tab layout is not something we
 * control). Placeholder/blank names are kept here and filtered downstream by
 * the resolver.
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
  const emailCol = findColumn(headers, EMAIL_HEADER_RE)
  const phoneCol = findColumn(headers, PHONE_HEADER_RE)

  const out: VisitingSpeaker[] = []
  for (const row of rows) {
    const nameCell = row[nameCol]
    const name = typeof nameCell === 'string' ? nameCell.trim() : ''
    if (!name) continue
    const email = cell(row, emailCol)?.toLowerCase()
    out.push({
      name,
      ecclesia: cell(row, ecclesiaCol),
      email,
      phone: cell(row, phoneCol),
    })
  }
  return out
}

/**
 * Ingest visiting speakers: create `visitor` records for confident not-found
 * names under their home ecclesia (with email/phone/privacy when the sheet
 * provides them) and backfill contact info onto the emailless records we
 * created before the sheet carried contact columns. Idempotent and
 * admin-triggered.
 *
 * @param sheetId  the memorial spreadsheet id
 * @param options  dryRun + injectable sheets/repository/privacy for testing
 */
export async function syncVisitingSpeakers(
  sheetId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const dryRun = options.dryRun ?? false
  const sheets = options.sheets ?? new GoogleSheetsService()
  const repo: PersonRepositoryLike = options.repository ?? personRepository
  const privacy: PrivacyRepositoryLike = options.privacy ?? privacyRepository

  const speakers = await readVisitingSpeakers(sheetId, sheets)

  // Load the directory once. `candidates` is the resolver's view and grows as
  // records are created so idempotency holds WITHIN a run. `recordsById` keeps
  // the FULL PersonRecord for the PRE-EXISTING directory only — it is what we
  // consult before any backfill so we can prove a match is one of our own
  // schedule-import visitors (never a real member). Records created during this
  // run are intentionally left OUT of recordsById: a repeated name in the same
  // batch resolves to a candidate with no full record and is simply skipped as
  // already-present, never re-created and never treated as a backfill target.
  const candidates: DirectoryPerson[] = []
  const recordsById = new Map<string, PersonRecord>()
  let lastEvaluatedKey: Record<string, any> | undefined
  do {
    const page = await repo.listAll({ lastEvaluatedKey })
    for (const record of page.items) {
      candidates.push(toDirectoryPerson(record))
      recordsById.set(record.personId, record)
    }
    lastEvaluatedKey = page.lastEvaluatedKey
  } while (lastEvaluatedKey)

  const result: SyncResult = {
    dryRun,
    sheetId,
    totalRows: speakers.length,
    created: [],
    backfilled: [],
    skipped: [],
  }

  for (const speaker of speakers) {
    // Re-resolve against the CURRENT candidate list (includes anything created
    // earlier in this run) so a repeated name never creates a duplicate.
    const report = resolveNames([speaker.name], candidates)

    // ---- MATCHED: possibly backfill one of OUR auto-created visitors --------
    if (report.matched.length > 0) {
      const matched = recordsById.get(report.matched[0].person.personId)

      // Only touch records we created (schedule-import visitors). Anything else
      // — a real member, or an in-batch record we just created — is left alone.
      const isOurVisitor =
        matched != null &&
        matched.source === 'schedule-import' &&
        matched.memberStatus === 'visitor'

      if (!matched || !isOurVisitor) {
        result.skipped.push({ name: speaker.name, reason: 'already in directory' })
        continue
      }

      const personId = matched.personId
      const email = speaker.email
      const phone = speaker.phone

      // Email only backfilled onto a still-emailless record.
      const willAddEmail = !!email && !matched.primaryEmail
      // Phone only added when the sheet has one and the record has none yet.
      let willAddPhone = false
      if (phone) {
        const phones = await repo.getPhones(personId)
        willAddPhone = phones.length === 0
      }

      if (!willAddEmail && !willAddPhone) {
        result.skipped.push({
          name: speaker.name,
          reason: 'already in directory (contact info up to date)',
        })
        continue
      }

      if (!dryRun) {
        if (willAddEmail && email) {
          // Create the real primary EMAIL# item (mirrors create()'s primary
          // email), then flip the PROFILE off its NOEMAIL# sentinel so
          // getByEmail() surfaces the record. addEmail alone does NOT move the
          // PROFILE's gsi1pk, so we update it here.
          await repo.addEmail(personId, {
            email,
            emailType: 'primary',
            order: 0,
            verified: true,
            sesSubscribed: false,
            sesStatus: 'active',
          })
          await repo.updatePerson(personId, {
            gsi1pk: `EMAIL#${email}`,
            primaryEmail: email,
          })
          await privacy.createPrivacySettings(email, { ...VISITOR_PRIVACY_SETTINGS })
        }
        if (willAddPhone && phone) {
          await repo.addPhone(personId, { type: 'mobile', number: phone, isPrimary: true })
        }
      }

      result.backfilled.push({
        name: speaker.name,
        ecclesia: matched.ecclesia,
        personId,
        addedEmail: willAddEmail ? email : undefined,
        addedPhone: willAddPhone ? phone : undefined,
        privacy: willAddEmail ? VISITING_SPEAKER_VISIBILITY : undefined,
      })
      continue
    }

    // ---- NOT MATCHED, NOT not-found: leave typo/ambiguous/blank for a human --
    if (report.notFound.length === 0) {
      const reason = report.typos.length
        ? 'possible typo — left for human review'
        : report.ambiguous.length
          ? 'ambiguous — left for human review'
          : 'placeholder/blank'
      result.skipped.push({ name: speaker.name, reason })
      continue
    }

    // ---- NOT-FOUND: create a new visitor record -----------------------------
    const ecclesia = speaker.ecclesia?.trim()
    if (!ecclesia) {
      result.skipped.push({ name: speaker.name, reason: 'no home ecclesia column value' })
      continue
    }

    const { firstName, lastName } = splitSpeakerName(speaker.name)
    const email = speaker.email
    const phone = speaker.phone
    const emailless = !email

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
        // With an email we take the normal create() path (real EMAIL# item +
        // EMAIL# gsi1 key) so getByEmail finds them; without, create() falls
        // back to the emailless NOEMAIL# sentinel.
        ...(email ? { email } : {}),
      })
      personId = created.personId
      if (phone) {
        await repo.addPhone(personId, { type: 'mobile', number: phone, isPrimary: true })
      }
      if (email) {
        await privacy.createPrivacySettings(email, { ...VISITOR_PRIVACY_SETTINGS })
      }
    }

    result.created.push({
      name: speaker.name,
      ecclesia,
      firstName,
      lastName,
      email,
      phone,
      emailless,
      privacy: email ? VISITING_SPEAKER_VISIBILITY : undefined,
      personId,
    })

    // Add to the in-memory candidate list (dry-run too) so a second occurrence
    // of this name in the same batch resolves as matched — dryRun reports
    // exactly what a real run would create, no phantom duplicates. Left OUT of
    // recordsById on purpose (see the load comment above).
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
