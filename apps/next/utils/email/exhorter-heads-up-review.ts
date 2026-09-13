import { randomBytes } from 'node:crypto'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { exhorterHeadsUpRepository } from '@my/app/provider/dynamodb/repositories/exhorter-headsup-repository'
import { resolveTenantFromEnv } from '@my/app/config/tenants'
import { getEcclesiaByName } from '../dynamodb/locations'
import { escapeHtml } from '../html'
import { sendEmail } from './sesClient'
import {
  resolveAndSendExhorterHeadsUp,
  EMAIL_TRACKING_CONFIG_SET,
  type ExhorterHeadsUpReport,
} from './exhorter-heads-up'

/**
 * QA-by-redirect for the exhorter heads-up (#124, slice B).
 *
 * **The email the brother would receive is sent to the Recording Brother
 * instead.** Not a notice about it, not a summary, not a copy rendered into a
 * web page — the actual email, in a real inbox, so it can be checked the way it
 * will actually be read: in Gmail, and by inference Outlook and the rest.
 *
 * Reviewing an email inside a web page is a simulation, not a test. An iframe
 * does not tell you how a mail client will treat the tables, the images, the
 * dark-mode inversion or the preview line.
 *
 * The ONLY difference from the live article is:
 *   1. the `To:` header, and
 *   2. one appended footer block with a link to press when it is right.
 *
 * Going live is therefore exactly what it sounds like: change the `To:` and
 * drop the footer block. Nothing else about the email changes, which is what
 * makes this QA rather than a rehearsal of something else.
 *
 * The link opens a page and sends nothing by itself — mail clients prefetch
 * links, so the press has to be a POST from a page.
 */

/** How long the footer link stays usable. Long enough for a weekend. */
const REVIEW_LINK_TTL_MS = 9 * 24 * 60 * 60 * 1000

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_AUTH_URL || 'https://tee-admin.com'
}

function mintToken(): string {
  return randomBytes(32).toString('base64url')
}

export interface PrepareHeadsUpForReviewParams {
  /** Target Sunday (ISO). */
  date: string
  /** Who QAs it — defaults to the host ecclesia's Recording Brother. */
  reviewerEmail?: string
}

export interface PrepareHeadsUpForReviewResult {
  report: ExhorterHeadsUpReport
  reviewerEmail?: string
  /** True when the email was redirected for QA. */
  parked: boolean
}

/**
 * Append the "send it" block to the email being QA'd.
 *
 * Appended rather than woven in, so it is unmistakably the extra bit and
 * removing it later is a deletion rather than an edit. It sits after the
 * email's own footer, which is where a reviewer will look for it.
 */
function appendSendBlockHtml(html: string, v: { name: string; email: string; url: string }): string {
  const block = `
<div style="margin:0;padding:16px 24px;background:#fdfaf5;border-top:3px solid #003da9;
            font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#00102c">
  <p style="margin:0 0 8px 0;font-size:13px;font-weight:bold">
    REVIEW COPY — this was redirected to you, not sent to ${escapeHtml(v.name)}.
  </p>
  <p style="margin:0 0 12px 0;font-size:13px">
    Everything above is exactly what ${escapeHtml(v.name)} (${escapeHtml(v.email)}) will
    receive. If it is right, send it:
  </p>
  <p style="margin:0">
    <a href="${escapeHtml(v.url)}"
       style="display:inline-block;padding:10px 16px;background:#003da9;color:#fff;
              text-decoration:none;border-radius:6px;font-size:14px">
      Send this to ${escapeHtml(v.name)}
    </a>
  </p>
  <p style="margin:12px 0 0 0;font-size:12px;color:#4a5568">
    Opening that link only shows a confirmation page — it does not send anything
    until you press the button there.
  </p>
</div>`
  // After </body> is ignored by some clients, so splice it INSIDE.
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${block}</body>`)
  return html + block
}

function appendSendBlockText(text: string, v: { name: string; email: string; url: string }): string {
  return [
    text,
    '',
    '---------------------------------------------',
    `REVIEW COPY — redirected to you, not sent to ${v.name}.`,
    `Everything above is exactly what ${v.name} (${v.email}) will receive.`,
    'If it is right, send it:',
    v.url,
    '',
    'That link only opens a confirmation page — nothing sends until you press',
    'the button there.',
  ].join('\n')
}

/**
 * Render the heads-up for a Sunday and redirect it to the reviewer for QA.
 *
 * Rendered with `renderOnly`, which resolves and renders but sends nothing and
 * takes no idempotency claim — the claim belongs to the real send, and taking
 * it here would block it.
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

  // `test: false` so this is the REAL email — the live subject, the recipient's
  // own preferences link, no [TEST] prefix. Only the To: header differs.
  const report = await resolveAndSendExhorterHeadsUp({
    date: params.date,
    renderOnly: true,
    test: false,
    requesterEmail: reviewerEmail || 'unknown@tee-admin.com',
  })

  if (report.status !== 'dry-run' || !report.rendered || !report.personId) {
    // Every guard (unresolved name, placeholder, cancelled Sunday, past date)
    // reports without sending. The caller surfaces it; a job that silently does
    // nothing is indistinguishable from a job that is broken.
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
    // Pinned to the email actually put in front of a human. The send must still
    // match this or it refuses — so pressing the link despatches the email that
    // was read, or nothing.
    contentDigest: report.rendered.contentDigest,
    expiresAt: new Date(Date.now() + REVIEW_LINK_TTL_MS).toISOString(),
  })

  const url = `${baseUrl()}/admin/exhorter-heads-up/review?token=${encodeURIComponent(token)}`
  const link = { name: recipientName, email: recipientEmail, url }

  await sendEmail({
    to: reviewerEmail,
    // The real subject, so the inbox rendering — truncation, preview text, the
    // way it threads — is the one the brother will see.
    subject: report.rendered.subject,
    body: appendSendBlockHtml(report.rendered.html, link),
    textBody: appendSendBlockText(report.rendered.text, link),
    tenant,
    // Tracked like the real send, so a QA copy that fails to arrive is visible
    // too — the QA is worthless if the test email itself silently vanishes.
    configurationSetName: EMAIL_TRACKING_CONFIG_SET,
    emailTags: [{ Name: 'Reason', Value: 'exhorter-heads-up-review' }],
  })

  return { report, reviewerEmail, parked: true }
}
