import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { pendingEmailNoteRepository } from '@my/app/provider/dynamodb/repositories/pending-email-note-repository'
import { resolveTenantFromEnv } from '@my/app/config/tenants'
import type { EmailReasonType } from '@my/app/types'
import { getEmailContent } from '../../../../utils/email/get-email-content'
import { buildEmailEnvelope } from '../../../../utils/email/email-send'
import { sendEmail } from '../../../../utils/email/sesClient'

/**
 * POST /api/email/send-one — send ONE email to ONE explicitly-requesting person.
 *
 * The safe, permission-gated way to honour a specific request (e.g. someone who
 * has opted out of the standing list but asked for this one email, or a visitor
 * who wants a specific bulletin). It is deliberately NOT a broadcast:
 *   - 1:1 only — renders the SAME content as the normal send for `reason` and
 *     sends via `sendEmail()` to the single supplied address.
 *   - It does NOT touch the SES contact list or the recipient's `sesSubscribed`
 *     state — a one-off never re-subscribes anyone.
 *   - It IGNORES test mode by design (the caller is sending real content to a
 *     real, consenting recipient), so it is gated by an explicit permission
 *     attestation that is RE-CHECKED here server-side.
 *
 * Body: { reason, to, recipientName?, note?, permission: true }
 */

const ALLOWED_REASONS: EmailReasonType[] = ['newsletter', 'recap', 'bible-class', 'sunday-school']

// Pragmatic email shape check (server-side belt to the client's).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  // 1. Owner/admin only.
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const userRole = session.user.role
  if (!userRole || ![ROLES.OWNER, ROLES.ADMIN].includes(userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  let body: {
    reason?: string
    to?: string
    recipientName?: string
    note?: string
    permission?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // 2. Permission attestation is REQUIRED (re-checked server-side, not just UI).
  if (body.permission !== true) {
    return NextResponse.json(
      { error: 'Permission attestation required — confirm you have the recipient’s permission.' },
      { status: 403 }
    )
  }

  // 3. Validate reason + recipient address.
  const { reason, recipientName } = body
  if (!reason || !ALLOWED_REASONS.includes(reason as EmailReasonType)) {
    return NextResponse.json(
      { error: `reason must be one of: ${ALLOWED_REASONS.join(', ')}` },
      { status: 400 }
    )
  }
  const to = (body.to ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(to)) {
    return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 })
  }
  const typedReason = reason as EmailReasonType

  // 4. Note: use the supplied note, else the type's pending note — so the copy
  //    matches what the broadcast produced. We do NOT clear it (it belongs to the
  //    real broadcast, not this side-send).
  const noteText =
    typeof body.note === 'string' && body.note.trim()
      ? body.note.trim()
      : (await pendingEmailNoteRepository.getNote(typedReason)) || undefined

  // 5. Render the SAME content as the normal send, and build the SAME envelope
  //    (canonical `communications@` sender + branded subject) as the broadcast.
  const tenant = resolveTenantFromEnv()
  let html: string | undefined
  let text: string | undefined
  try {
    const content = await getEmailContent(typedReason, noteText)
    html = content[0]
    text = content[1]
  } catch (err) {
    console.error('[send-one] render failed:', err)
    return NextResponse.json({ error: 'Failed to render email content' }, { status: 500 })
  }
  if (!html) {
    return NextResponse.json(
      { error: `No content available to send for "${typedReason}" right now` },
      { status: 422 }
    )
  }

  const { from, replyTo, subject } = buildEmailEnvelope(typedReason, tenant, { test: false })

  // 6. Send 1:1. Audit BEFORE + AFTER so the intent is logged even if SES throws.
  console.log(
    `[send-one] ${session.user.email} → ${to} | reason=${typedReason} | hadNote=${!!noteText} | name=${recipientName ?? ''}`
  )
  try {
    await sendEmail({ to, subject, body: html, textBody: text, tenant, from, replyTo })
  } catch (err) {
    console.error(`[send-one] SEND FAILED to ${to} (${typedReason}):`, err)
    return NextResponse.json({ error: 'Send failed — see server logs' }, { status: 502 })
  }

  console.log(`[send-one] SENT to ${to} | reason=${typedReason} | by=${session.user.email}`)
  return NextResponse.json({
    ok: true,
    to,
    reason: typedReason,
    subject,
    hadNote: !!noteText,
    sentBy: session.user.email,
  })
}
