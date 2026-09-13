import { NextRequest, NextResponse } from 'next/server'
import { exhorterHeadsUpRepository } from '@my/app/provider/dynamodb/repositories/exhorter-headsup-repository'
import {
  resolveAndSendExhorterHeadsUp,
  renderHeadsUpPreview,
} from '@/utils/email/exhorter-heads-up'

/**
 * Review a parked exhorter heads-up, and send it.
 *
 * GET  — read-only. Returns who the email is for and the rendered email itself.
 *        **Causes nothing.** Mail clients prefetch and scan links, so if the
 *        link in the review email had done the sending, it could have fired
 *        before anybody read a word. Fetching this only reads.
 *
 * POST — sends it, from a deliberate press of the button on the review page.
 *
 * The token authorises both, the same way the edit-request approval links work:
 * the Recording Brother may be on a phone on a Saturday morning and should not
 * have to sign in to approve something we emailed them.
 */

/** Read the token from the URL, without depending on Next's `nextUrl` shim. */
function tokenFrom(request: NextRequest): string {
  try {
    return (new URL(request.url).searchParams.get('token') ?? '').trim()
  } catch {
    return ''
  }
}

/** Shared preconditions. Returns the pending record, or the response to send. */
async function loadPending(token: string) {
  if (!token) {
    return { error: NextResponse.json({ error: 'This link is incomplete.' }, { status: 400 }) }
  }
  const pending = await exhorterHeadsUpRepository.findPendingByToken(token)
  if (!pending) {
    return {
      error: NextResponse.json(
        { error: 'This link is not valid. It may have been superseded by a newer one.' },
        { status: 404 }
      ),
    }
  }
  if (pending.releasedAt) {
    return {
      error: NextResponse.json(
        {
          error: `Already sent to ${pending.recipientName ?? pending.recipientEmail}.`,
          alreadySent: true,
          sentAt: pending.releasedAt,
        },
        { status: 409 }
      ),
    }
  }
  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    return {
      error: NextResponse.json(
        { error: 'This link has expired. Trigger a fresh heads-up from the admin page.' },
        { status: 410 }
      ),
    }
  }
  return { pending }
}

export async function GET(request: NextRequest) {
  try {
    const gate = await loadPending(tokenFrom(request))
    if (gate.error) return gate.error
    const { pending } = gate

    // Rendered FRESH, not replayed from a snapshot: what is approved has to be
    // what actually goes out, and the schedule may have been edited since.
    const preview = await renderHeadsUpPreview({ date: pending.date })

    return NextResponse.json({
      success: true,
      date: pending.date,
      recipientName: pending.recipientName,
      recipientEmail: pending.recipientEmail,
      expiresAt: pending.expiresAt,
      /** Set when the schedule now names a different brother — do not send. */
      changed: preview.personId !== pending.personId,
      subject: preview.subject,
      html: preview.html,
    })
  } catch (error) {
    console.error('[exhorter-headsup] review load failed:', error)
    return NextResponse.json({ error: 'Could not load this heads-up.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = String(body?.token ?? tokenFrom(request)).trim()
    const gate = await loadPending(token)
    if (gate.error) return gate.error
    const { pending } = gate

    // Claim the approval FIRST. Conditional on nothing having released it, so a
    // double press, two open tabs, or a retry cannot send twice.
    const claimed = await exhorterHeadsUpRepository.markReleased(
      pending.date,
      pending.personId,
      pending.token,
      pending.previewedBy ?? 'review-page'
    )
    if (!claimed) {
      return NextResponse.json(
        { error: 'That was already sent.', alreadySent: true },
        { status: 409 }
      )
    }

    // `expectPersonId` refuses if the schedule now names someone else: the
    // approval was for a particular brother's email, not for whoever happens
    // to be down for that Sunday by the time the button was pressed.
    const report = await resolveAndSendExhorterHeadsUp({
      date: pending.date,
      test: false,
      requesterEmail: pending.previewedBy ?? 'review-page',
      expectPersonId: pending.personId,
    })

    if (report.status !== 'sent') {
      return NextResponse.json(
        {
          error:
            report.note ??
            'Nothing was sent — the schedule may have changed. Review it again.',
          status: report.status,
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      sentTo: report.sentTo,
      date: report.date,
    })
  } catch (error) {
    console.error('[exhorter-headsup] send from review failed:', error)
    return NextResponse.json({ error: 'Could not send this heads-up.' }, { status: 500 })
  }
}
