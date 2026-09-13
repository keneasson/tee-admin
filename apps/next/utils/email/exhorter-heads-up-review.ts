import { randomBytes } from 'node:crypto'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { exhorterHeadsUpRepository } from '@my/app/provider/dynamodb/repositories/exhorter-headsup-repository'
import { resolveTenantFromEnv } from '@my/app/config/tenants'
import { getEcclesiaByName } from '../dynamodb/locations'
import { sendEmail } from './sesClient'
import {
  resolveAndSendExhorterHeadsUp,
  type ExhorterHeadsUpReport,
} from './exhorter-heads-up'

/**
 * Review-then-send for the exhorter heads-up (#124, slice B).
 *
 * The Saturday job does NOT email the exhorter. It resolves who is scheduled,
 * parks the send, and emails the Recording Brother a link. The link opens a
 * page; the send happens when a person presses the button on that page.
 *
 * **Nothing side-effecting hangs off a URL in an email.** Gmail and Outlook
 * prefetch and scan links, so a link that sent the email when fetched could
 * fire before anybody had read a word of it. The link is a plain page load; the
 * send is a POST from a deliberate click. (The atomic release guard stops a
 * SECOND send; only this shape stops an unintended first one.)
 *
 * Once a few weeks of these have been read and trusted, `AUTO_SEND` flips and
 * the review step drops out — that is the whole reason for the switch.
 */

/** How long a review link stays usable. Short enough to matter, long enough for a weekend. */
const REVIEW_LINK_TTL_MS = 9 * 24 * 60 * 60 * 1000

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
}

/** Opaque, unguessable, URL-safe. */
function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface PrepareHeadsUpForReviewParams {
  /** Target Sunday (ISO). */
  date: string
  /** Who reviews it — defaults to the host ecclesia's Recording Brother. */
  reviewerEmail?: string
}

export interface PrepareHeadsUpForReviewResult {
  report: ExhorterHeadsUpReport
  /** Set only when something was parked for review. */
  reviewUrl?: string
  reviewerEmail?: string
  parked: boolean
}

/**
 * Resolve the exhorter for a Sunday and park the heads-up for a human to send.
 *
 * Resolution runs in `dryRun` so the speaker is never written to here and no
 * idempotency claim is taken — the claim belongs to the real send, and taking
 * it now would block it.
 */
export async function prepareHeadsUpForReview(
  params: PrepareHeadsUpForReviewParams
): Promise<PrepareHeadsUpForReviewResult> {
  const tenant = resolveTenantFromEnv()
  const ecclesia = await getEcclesiaByName(tenant.homeEcclesiaName ?? '')
  const reviewerEmail =
    params.reviewerEmail ||
    ecclesia?.recordingBrotherEmail ||
    process.env.EXHORTER_HEADSUP_REVIEWER ||
    ''

  // Resolve only. Every guard (placeholder name, unresolved, no email, special
  // occasion, past date) reports without sending, exactly as the manual trigger
  // does — so a Sunday that needs a human's attention surfaces as a report
  // rather than a silent nothing.
  const report = await resolveAndSendExhorterHeadsUp({
    date: params.date,
    dryRun: true,
    test: true,
    requesterEmail: reviewerEmail || 'unknown@tee-admin.com',
  })

  if (report.status !== 'dry-run' || !report.personId) {
    // Nothing to send. The caller reports it; a cron that silently does nothing
    // is indistinguishable from a cron that is broken.
    return { report, parked: false }
  }

  if (!reviewerEmail) {
    return {
      report: { ...report, note: 'No reviewer address — set the ecclesia Recording Brother email.' },
      parked: false,
    }
  }

  const person = await personRepository.getById(report.personId)
  const recipientEmail = person?.primaryEmail ?? ''
  const recipientName =
    person?.displayName ||
    [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() ||
    report.exhortName ||
    'the exhorter'

  const token = mintToken()
  await exhorterHeadsUpRepository.parkPending({
    date: report.date,
    personId: report.personId,
    token,
    recipientEmail,
    recipientName,
    previewedBy: reviewerEmail,
    expiresAt: new Date(Date.now() + REVIEW_LINK_TTL_MS).toISOString(),
  })

  const reviewUrl = `${baseUrl()}/admin/exhorter-heads-up/review?token=${encodeURIComponent(token)}`

  await sendEmail({
    to: reviewerEmail,
    subject: `Review: exhortation heads-up for ${recipientName} — ${report.date}`,
    body: reviewerHtml({ recipientName, recipientEmail, date: report.date, reviewUrl }),
    textBody: reviewerText({ recipientName, recipientEmail, date: report.date, reviewUrl }),
    tenant,
  })

  return { report, reviewUrl, reviewerEmail, parked: true }
}

function reviewerHtml(v: {
  recipientName: string
  recipientEmail: string
  date: string
  reviewUrl: string
}): string {
  // Deliberately plain, and deliberately NOT a copy of the speaker's email:
  // the review page shows that, freshly rendered, so what is approved is what
  // will actually be sent rather than a snapshot that may have gone stale.
  return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#00102c;line-height:1.5">
  <p>A heads-up email is ready for <strong>${escapeHtml(v.recipientName)}</strong>
     (${escapeHtml(v.recipientEmail)}) for the exhortation on
     <strong>${escapeHtml(v.date)}</strong>.</p>
  <p><strong>Nothing has been sent yet.</strong> Open the review page to read the
     email exactly as they would receive it, then press the send button there.</p>
  <p><a href="${escapeHtml(v.reviewUrl)}"
        style="display:inline-block;padding:10px 16px;background:#003da9;color:#fff;
               text-decoration:none;border-radius:6px">Review it</a></p>
  <p style="color:#4a5568;font-size:13px">Opening this link only shows you the email —
     it does not send anything.</p>
</body></html>`
}

function reviewerText(v: {
  recipientName: string
  recipientEmail: string
  date: string
  reviewUrl: string
}): string {
  return [
    `A heads-up email is ready for ${v.recipientName} (${v.recipientEmail})`,
    `for the exhortation on ${v.date}.`,
    '',
    'NOTHING HAS BEEN SENT YET. Open the review page to read the email exactly',
    'as they would receive it, then press the send button there.',
    '',
    v.reviewUrl,
    '',
    'Opening this link only shows you the email — it does not send anything.',
  ].join('\n')
}
