import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { resolveScheduleName, isPlaceholderName } from '@my/app/utils/name-resolver'
import { toDirectoryPerson } from '@my/app/utils/name-resolver-directory'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { resolveTenantFromEnv } from '@my/app/config/tenants'
import {
  fetchServiceOverrides,
  normalizeToISODate,
  overrideKey,
} from '@my/app/utils/service-overrides/merge'
import {
  formatScheduleDateForEmail,
  formatTimeInTimezone,
  DEFAULT_TIMEZONE,
} from '@my/app/utils/timezone'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'
import type { ExhorterHeadsUpAttendOption } from 'email-builder/emails/ExhorterHeadsUp'
import { sendEmail } from './sesClient'
import { renderExhorterHeadsUp } from './exhorter-heads-up-render'
import { exhorterHeadsUpRepository } from '@my/app/provider/dynamodb/repositories/exhorter-headsup-repository'
import { generateEmailPreferencesUrl } from './ecclesia-token'

/**
 * Exhorter heads-up service (#124, slice A).
 *
 * Reads the memorial schedule, finds the target Sunday's `Exhort` name, resolves
 * it to a directory PersonRecord, and sends a warm 1:1 reminder via `sendEmail()`.
 *
 * SAFETY (must hold):
 *   - `test` defaults TRUE.
 *   - In TEST mode the email is sent to the REQUESTER (the admin who triggered),
 *     NEVER the real exhorter.
 *   - Only a `matched` + non-placeholder + non-empty-email exhorter sends.
 *   - Idempotency is LIVE-only (test writes nothing so tests can repeat).
 *   - No cron / auto-send here (slice B).
 */

// From = the proven, SES-verified sender domain (SPF/DKIM). NEVER a personal
// address here or the send fails auth → spam. Reply-To carries the human contact.
const SENDER_LOCAL_PART = 'communications'
// Reply-To = the HOST ecclesia's Recording Brother, so the exhorter's replies
// reach whoever is coordinating that meeting. teerecbro@gmail.com is fine as a
// Reply-To (no domain verification needed).
// TODO(multi-tenant, #124): resolve Reply-To to the host ecclesia's Recording
// Brother (RB office / ecclesia record / config) instead of the TEE constant.
const REPLY_TO = 'teerecbro@gmail.com'

// Fallback "ways to attend" — the SAME Zoom the memorial template hardcodes.
// Used only when the occurrence has no per-occurrence `attendOptions` override.
const DEFAULT_TEE_ZOOM: ExhorterHeadsUpAttendOption = {
  label: 'Toronto East Zoom',
  url: 'https://us04web.zoom.us/j/586952386?pwd=Z2svVG0zTmNlTWx2MTFoMlZIaDZLQT09',
  meetingId: '586 952 386',
  password: '036110',
  platform: 'zoom',
  dialInNumber: '+1 647 374 4685',
}

export type ExhorterHeadsUpStatus =
  | 'sent'
  | 'dry-run'
  | 'unresolved'
  | 'skipped:placeholder'
  | 'skipped:no-email'
  | 'skipped:already-sent'
  | 'no-schedule-row'

export interface ExhorterHeadsUpReport {
  date: string
  test: boolean
  status: ExhorterHeadsUpStatus
  exhortName?: string
  personId?: string
  visiting?: boolean
  sentTo?: string
  zoomSource?: 'override' | 'default'
  /** When unresolved: the resolver outcome (typo | ambiguous | not-found). */
  matchStatus?: string
}

export interface ResolveAndSendExhorterHeadsUpParams {
  /** Target Sunday (ISO — matched against the memorial row's DateTime/Date). */
  date: string
  /** TEST mode — defaults TRUE. Test NEVER emails the real exhorter. */
  test?: boolean
  /** Resolve + report only, no send, no idempotency write. */
  dryRun?: boolean
  /** The admin who triggered — the TEST-mode recipient. */
  requesterEmail: string
}

const scheduleService = new ScheduleService()

/** Page through the whole directory (listAll is a paginated scan). */
async function listAllPersons(): Promise<PersonRecord[]> {
  const all: PersonRecord[] = []
  let lastEvaluatedKey: Record<string, any> | undefined
  do {
    const result = await personRepository.listAll({ lastEvaluatedKey })
    all.push(...result.items)
    lastEvaluatedKey = result.lastEvaluatedKey
  } while (lastEvaluatedKey)
  return all
}

export async function resolveAndSendExhorterHeadsUp(
  params: ResolveAndSendExhorterHeadsUpParams
): Promise<ExhorterHeadsUpReport> {
  const { requesterEmail } = params
  const test = params.test ?? true // SAFE DEFAULT
  const dryRun = params.dryRun ?? false
  const targetISO = normalizeToISODate(params.date)

  const tenant = resolveTenantFromEnv()
  const hostCanonical = tenant.homeEcclesiaName ?? HOME_ECCLESIA.canonicalName
  const hostPublicName = tenant.publicName

  const base: ExhorterHeadsUpReport = { date: targetISO, test, status: 'no-schedule-row' }

  // 1. Find the memorial row for the target Sunday.
  const schedule = await scheduleService.getScheduleData('memorial')
  const rows = (schedule?.content ?? []) as Array<Record<string, any>>
  const row = rows.find((r) => normalizeToISODate(r.DateTime || r.Date) === targetISO)
  if (!row) {
    return base
  }

  const exhortName = String(row.Exhort ?? '').trim()
  base.exhortName = exhortName

  // 2. Placeholder guard ("TBD"/"attendees"/blank) — nothing to send.
  if (isPlaceholderName(exhortName)) {
    return { ...base, status: 'skipped:placeholder' }
  }

  // 3. Resolve the free-text name against the whole directory. Only an exact
  //    `matched` proceeds — typo/ambiguous/not-found are reported, never sent.
  const candidates = (await listAllPersons()).map(toDirectoryPerson)
  const match = resolveScheduleName(exhortName, candidates)
  if (match.status !== 'matched') {
    return { ...base, status: 'unresolved', matchStatus: match.status }
  }

  // 4. Load the full record; an emailless (visiting) speaker has primaryEmail ''.
  const person = await personRepository.getById(match.person.personId)
  if (!person || !person.primaryEmail) {
    return { ...base, status: 'skipped:no-email', personId: match.person.personId }
  }

  const personId = person.personId
  const visiting =
    person.memberStatus === 'visitor' || !HOME_ECCLESIA.isHomeEcclesia(person.ecclesia)

  // 5. Ways to attend: the per-occurrence override if present, else the default Zoom.
  const overrides = await fetchServiceOverrides(hostCanonical, ['memorial'], targetISO, targetISO)
  const override = overrides.get(overrideKey('memorial', targetISO))
  let attendOptions: ExhorterHeadsUpAttendOption[]
  let zoomSource: 'override' | 'default'
  if (override?.attendOptions?.length) {
    attendOptions = override.attendOptions.map((o) => ({
      label: o.label,
      url: o.url,
      meetingId: o.meetingId,
      password: o.password,
      platform: o.platform,
      dialInNumber: o.dialInNumber,
    }))
    zoomSource = 'override'
  } else {
    attendOptions = [DEFAULT_TEE_ZOOM]
    zoomSource = 'default'
  }

  // 6. Recipient: TEST → the requester (NEVER the real exhorter); LIVE → primaryEmail.
  const recipient = test ? requesterEmail : person.primaryEmail

  const tz = row.ServiceTimezone || DEFAULT_TIMEZONE
  // Use the normalized ISO date (YYYY-MM-DD) as the date-only fallback. The raw
  // `row.Date` sheet value isn't guaranteed to be dash-delimited, and the
  // date-only formatter's `parseDateOnly` splits on '-' — a non-ISO value there
  // yields a literal "Invalid Date". `targetISO` IS this row's date (that's how
  // the row was matched), so it's both correct and parseable.
  const dateDisplay = formatScheduleDateForEmail(row.DateTime, targetISO, tz)
  const timeDisplay = row.DateTime ? formatTimeInTimezone(row.DateTime, tz) : '11:00am'

  const report: ExhorterHeadsUpReport = {
    ...base,
    status: 'sent',
    personId,
    visiting,
    sentTo: recipient,
    zoomSource,
  }

  // 7. Dry run: resolve + report, no send, no idempotency write.
  if (dryRun) {
    return { ...report, status: 'dry-run' }
  }

  // 8. Idempotency (LIVE ONLY). Atomic claim BEFORE send prevents double-send on
  //    a re-run / schedule edit. Test mode writes nothing so tests can repeat.
  if (!test) {
    const claimed = await exhorterHeadsUpRepository.claim({
      date: targetISO,
      personId,
      sentTo: recipient,
      createdBy: requesterEmail,
    })
    if (!claimed) {
      return { ...report, status: 'skipped:already-sent' }
    }
  }

  // 9. Resolve the recipient's Email Preferences link (real URL — this 1:1 send
  //    does no {{token}} substitution), render, and send.
  let emailPreferencesUrl: string
  try {
    emailPreferencesUrl = await generateEmailPreferencesUrl(recipient)
  } catch (err) {
    console.error('[exhorter-headsup] failed to mint preferences URL, using fallback:', err)
    emailPreferencesUrl = `${process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'}/email-preferences`
  }

  try {
    const { html, text } = await renderExhorterHeadsUp({
      firstName: person.firstName,
      hostEcclesiaName: hostPublicName,
      dateDisplay,
      timeDisplay,
      visiting,
      attendOptions,
      emailPreferencesUrl,
      tenant,
    })

    const subject = `${test ? '[TEST] ' : ''}Your exhortation at ${hostPublicName} on ${dateDisplay}`
    const from = `"${tenant.senderDisplayName}" <${SENDER_LOCAL_PART}@${tenant.senderDomain}>`

    await sendEmail({
      to: recipient,
      subject,
      body: html,
      textBody: text,
      tenant,
      from,
      replyTo: REPLY_TO,
    })
  } catch (err) {
    // Send failed AFTER a live claim — release it so a manual retry can re-send.
    if (!test) {
      await exhorterHeadsUpRepository.release(targetISO, personId)
    }
    throw err
  }

  return report
}

/**
 * Compute the next target Sunday (~2 weeks out) for the manual admin trigger when
 * no explicit date is given. Returns an ISO YYYY-MM-DD (UTC). The heads-up is sent
 * ~2 Saturdays before, so the default target is the SECOND upcoming Sunday.
 */
export function computeNextTargetSunday(from: Date = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  // Advance to the next Sunday (excluding today), then +7 → second upcoming Sunday.
  const daysToSunday = (7 - d.getUTCDay()) % 7 || 7
  d.setUTCDate(d.getUTCDate() + daysToSunday + 7)
  return normalizeToISODate(d)
}
