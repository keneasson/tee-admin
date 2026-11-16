import type { ExhorterHeadsUpReport } from './exhorter-heads-up'

/**
 * "The heads-up could not be prepared" — in plain words (#332).
 *
 * The Saturday job used to return quietly when it could not work out who was
 * exhorting: a name that matched nobody, two people with the same name, a
 * brother with no email on file. Nobody was told, so nothing arrived and the
 * reminder was simply missed. This turns each of those outcomes into a short
 * explanation and what to do about it, for the warning email to the Recording
 * Brother and for the "Check again" result on the admin page.
 *
 * PURE and client-safe (type-only import): the admin page renders the same
 * wording the email uses.
 */

export interface HeadsUpProblemCandidate {
  personId: string
  name: string
  ecclesia?: string
}

export interface HeadsUpProblem {
  /** One line — what went wrong. */
  headline: string
  /** What the schedule shows and what was found. */
  details: string[]
  /** People the name might mean, each linkable to their directory page. */
  candidates: HeadsUpProblemCandidate[]
  /** What to do, in order. */
  fix: string[]
}

type ReportLike = Pick<
  ExhorterHeadsUpReport,
  'status' | 'exhortName' | 'matchStatus' | 'note' | 'candidates' | 'personId'
>

const PREFERRED_NAME_FIX =
  'If he goes by a different name from the one in the directory (for example "Ben" for "Benjamin"), open his directory entry, press Edit, and fill in his preferred first and last name. Either name will then be recognised.'

/**
 * Describe why no review copy was produced, or `null` when there is nothing a
 * person needs to do (the copy was prepared, it was already sent, or the date
 * has passed).
 */
export function describeHeadsUpProblem(report: ReportLike): HeadsUpProblem | null {
  const name = report.exhortName?.trim()
  const quoted = name ? `"${name}"` : 'the name'

  switch (report.status) {
    case 'unresolved': {
      const candidates = report.candidates ?? []
      if (report.matchStatus === 'ambiguous') {
        return {
          headline: `More than one person in the directory is called ${quoted}.`,
          details: [
            `The schedule lists ${quoted} as exhorting. That name belongs to ${candidates.length || 'several'} people, so the heads-up was not prepared rather than risk writing to the wrong brother.`,
          ],
          candidates,
          fix: [
            'If one of them is listed twice by mistake, merge or remove the duplicate entry.',
            'Otherwise, give the right brother a preferred name that is his alone, and use that name in the schedule.',
          ],
        }
      }
      if (report.matchStatus === 'typo') {
        return {
          headline: `${quoted} isn't an exact match for anyone in the directory.`,
          details: [
            `The schedule lists ${quoted} as exhorting. Nobody has exactly that name, but the people below are close.`,
          ],
          candidates,
          fix: [
            'If the schedule has a spelling mistake, correct it there.',
            PREFERRED_NAME_FIX,
          ],
        }
      }
      return {
        headline: `Nobody in the directory is called ${quoted}.`,
        details: [
          `The schedule lists ${quoted} as exhorting, and no one in the directory has that name or anything close to it.`,
        ],
        candidates,
        fix: [
          'If the schedule has a spelling mistake, correct it there.',
          PREFERRED_NAME_FIX,
          'If he is a visitor who is not in the directory yet, add him.',
        ],
      }
    }
    case 'skipped:no-email':
      return {
        headline: `${name || 'The exhorter'} has no email address on file.`,
        details: [
          `The schedule lists ${quoted}, who was found in the directory, but there is no email address to send the heads-up to.`,
        ],
        candidates: report.personId
          ? [{ personId: report.personId, name: name || 'His directory entry' }]
          : [],
        fix: ['Add his email address to his directory entry, or let him know yourself.'],
      }
    case 'no-schedule-row':
      return {
        headline: 'There is no row for this Sunday in the memorial schedule.',
        details: ['The schedule has no entry for this date, so there is no exhorter to write to.'],
        candidates: [],
        fix: ['Add the Sunday to the schedule, with the exhorter filled in.'],
      }
    case 'skipped:placeholder':
      return {
        headline: name
          ? `The exhorter for this Sunday is listed as ${quoted}.`
          : 'No exhorter is filled in for this Sunday.',
        details: ['That is not a person the heads-up can be sent to.'],
        candidates: [],
        fix: ['Fill in the exhorter in the schedule.'],
      }
    case 'skipped:needs-review':
      return {
        headline: 'This Sunday may not be the usual meeting at the hall.',
        details: [
          report.note
            ? `The schedule says: ${report.note}`
            : 'The schedule row mentions a change to the usual meeting.',
          'The standard heads-up says "come and exhort at the hall", which could be wrong, so it was not prepared.',
        ],
        candidates: [],
        fix: ['Let the exhorter know the arrangements yourself.'],
      }
    default:
      return null
  }
}

/** The warning when the job itself failed — there is no report to describe. */
export function describeHeadsUpFailure(): HeadsUpProblem {
  return {
    headline: 'The heads-up job ran into an error and did not finish.',
    details: ['Nothing was sent to the exhorter. The error has been logged for the site administrator.'],
    candidates: [],
    fix: ['Try again with the button below. If it fails again, let the site administrator know.'],
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "Sun, Nov 29" — the same form the review copy puts on its button. */
export function headsUpDateDisplay(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

export interface HeadsUpProblemEmailInput {
  problem: HeadsUpProblem
  /** Target Sunday (ISO). */
  date: string
  /** Site origin, e.g. https://www.tee-admin.com */
  baseUrl: string
}

export function renderHeadsUpProblemEmail({ problem, date, baseUrl }: HeadsUpProblemEmailInput): {
  subject: string
  html: string
  text: string
} {
  const dateDisplay = headsUpDateDisplay(date)
  const retryUrl = `${baseUrl}/admin/exhorter-heads-up?date=${encodeURIComponent(date)}`
  const personUrl = (personId: string) => `${baseUrl}/people/${encodeURIComponent(personId)}`
  const subject = `Exhortation heads-up for ${dateDisplay} was not sent — please check`

  const candidateLine = (c: HeadsUpProblemCandidate) =>
    c.ecclesia ? `${c.name} (${c.ecclesia})` : c.name

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:600px;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#00102c;font-size:15px;line-height:1.5">
  <p style="margin:0 0 4px 0;font-size:13px;color:#4a5568">Exhortation heads-up · ${escapeHtml(dateDisplay)}</p>
  <h1 style="margin:0 0 16px 0;font-size:20px">${escapeHtml(problem.headline)}</h1>
  ${problem.details.map((d) => `<p style="margin:0 0 12px 0">${escapeHtml(d)}</p>`).join('\n  ')}
  ${
    problem.candidates.length > 0
      ? `<ul style="margin:0 0 16px 0;padding-left:20px">
    ${problem.candidates
      .map(
        (c) =>
          `<li style="margin:0 0 4px 0"><a href="${escapeHtml(personUrl(c.personId))}" style="color:#003da9">${escapeHtml(candidateLine(c))}</a></li>`
      )
      .join('\n    ')}
  </ul>`
      : ''
  }
  <p style="margin:16px 0 8px 0;font-weight:bold">What to do</p>
  <ol style="margin:0 0 16px 0;padding-left:20px">
    ${problem.fix.map((f) => `<li style="margin:0 0 6px 0">${escapeHtml(f)}</li>`).join('\n    ')}
  </ol>
  <p style="margin:0 0 16px 0">When it's fixed, check again. If everything is in order, the review copy comes to you as usual.</p>
  <p style="margin:0 0 24px 0">
    <a href="${escapeHtml(retryUrl)}" style="display:inline-block;padding:10px 16px;background:#003da9;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px">Check ${escapeHtml(dateDisplay)} again</a>
  </p>
  <p style="margin:0;font-size:12px;color:#4a5568">Nothing has been sent to the exhorter. Schedule changes can take a little while to reach the site after you edit the sheet.</p>
</div>
</body></html>`

  const text = [
    `Exhortation heads-up · ${dateDisplay}`,
    '',
    problem.headline,
    '',
    ...problem.details,
    ...(problem.candidates.length > 0
      ? ['', ...problem.candidates.map((c) => `  - ${candidateLine(c)}: ${personUrl(c.personId)}`)]
      : []),
    '',
    'What to do:',
    ...problem.fix.map((f, i) => `  ${i + 1}. ${f}`),
    '',
    "When it's fixed, check again. If everything is in order, the review copy comes to you as usual:",
    retryUrl,
    '',
    'Nothing has been sent to the exhorter. Schedule changes can take a little while to reach the site after you edit the sheet.',
  ].join('\n')

  return { subject, html, text }
}
