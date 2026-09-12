import { NextRequest, NextResponse } from 'next/server'
import { editRequestRepository } from '@my/app/provider/dynamodb/repositories/edit-request-repository'
import { applyApprovedEdit } from '../../../../utils/apply-approved-edit'

/**
 * GET /api/edit-requests/approve?token=xxx&action=approve|reject
 * Token-based approval from email link (no authentication required)
 *
 * This allows users to approve/reject edit requests directly from email
 * without needing to sign in.
 */

/**
 * A readable page, not JSON.
 *
 * This URL is the target of a link in an email sent to a member — often an
 * elderly one. It was returning raw JSON:
 *
 *   { "error": "Invalid or expired token. The link may have expired." }
 *
 * on a black browser page. Nobody should meet that. Every outcome now renders
 * plain HTML that says what happened and what to do next, with no dependency on
 * the app shell (this is an API route, and the reader may not be signed in).
 */
function page(opts: {
  title: string
  message: string
  tone: 'ok' | 'warn' | 'error'
  status: number
}): Response {
  const colour = opts.tone === 'ok' ? '#1a7f37' : opts.tone === 'warn' ? '#9a6700' : '#b3261e'
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;background:#faf9f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#00102c">
  <main style="max-width:34rem;margin:3rem auto;padding:2rem;background:#fff;border:1px solid #e6e3df;border-radius:12px">
    <h1 style="margin:0 0 .75rem;font-size:1.4rem;color:${colour}">${escapeHtml(opts.title)}</h1>
    <p style="margin:0 0 1.5rem;font-size:1.05rem;line-height:1.6">${escapeHtml(opts.message)}</p>
    <p style="margin:0;font-size:.95rem;line-height:1.6;color:#5b5b5b">
      If you need help, reply to the email that brought you here, or contact your
      Recording Brother — they can make this change for you.
    </p>
  </main>
</body></html>`
  return new Response(html, {
    status: opts.status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const action = searchParams.get('action')

    // Validate parameters
    if (!token) {
      return page({
        title: 'That link is incomplete',
        message: 'The link is missing part of its address. Please open it directly from the email rather than copying it.',
        tone: 'error',
        status: 400,
      })
    }

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return page({
        title: 'That link is incomplete',
        message: 'The link did not say whether you were approving or declining the change. Please open it directly from the email.',
        tone: 'error',
        status: 400,
      })
    }

    // Find request by token
    const editRequest = await editRequestRepository.getRequestByToken(token)

    if (!editRequest) {
      return page({
        title: 'This link has expired',
        message: 'Approval links are valid for a limited time. Nothing has been changed. Ask whoever suggested the change to send it again.',
        tone: 'warn',
        status: 404,
      })
    }

    // Check if already processed
    if (editRequest.status !== 'pending') {
      return page({
        title: `Already ${editRequest.status}`,
        message: `This change to your ${editRequest.field} was already ${editRequest.status}, so there is nothing left to do. You can close this page.`,
        tone: 'warn',
        status: 200,
      })
    }

    if (action === 'reject') {
      await editRequestRepository.rejectRequest(editRequest.targetEmail, editRequest.requestId)
      return page({
        title: 'Change declined',
        message: `Thank you — your ${editRequest.field} has been left exactly as it was. Nothing has changed.`,
        tone: 'ok',
        status: 200,
      })
    }

    await editRequestRepository.approveRequest(editRequest.targetEmail, editRequest.requestId)

    // ACTUALLY APPLY IT. Marking the request 'approved' used to be all that
    // happened — the value was never written, so a member who approved their own
    // address change was told it worked and still had the old address.
    const result = await applyApprovedEdit(editRequest)

    if (!result.applied) {
      return page({
        title: 'Thank you — we have passed this on',
        message:
          result.reason ||
          'We have recorded your approval, and someone will finish making the change for you.',
        tone: 'warn',
        status: 200,
      })
    }

    return page({
      title: 'Thank you — your details are updated',
      message: `Your ${editRequest.field} now reads "${editRequest.suggestedValue}". There is nothing else for you to do.`,
      tone: 'ok',
      status: 200,
    })
  } catch (error) {
    console.error('Token-based approval error:', error)
    return page({
      title: 'Something went wrong at our end',
      message: 'Your details have not been changed. Please contact your Recording Brother, who can make the change for you.',
      tone: 'error',
      status: 500,
    })
  }
}

/**
 * POST /api/edit-requests/approve
 * Alternative POST-based approval (for forms or JavaScript)
 * Body: { token: string, action: 'approve' | 'reject' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, action } = body

    // Validate parameters
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      )
    }

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    // Find request by token
    const editRequest = await editRequestRepository.getRequestByToken(token)

    if (!editRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 404 }
      )
    }

    // Check if already processed
    if (editRequest.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `This request has already been ${editRequest.status}`,
      })
    }

    // Process the action
    const updated = action === 'approve'
      ? await editRequestRepository.approveRequest(editRequest.targetEmail, editRequest.requestId)
      : await editRequestRepository.rejectRequest(editRequest.targetEmail, editRequest.requestId)

    return NextResponse.json({
      success: true,
      action,
      request: {
        requestId: updated.requestId,
        field: updated.field,
        status: updated.status,
      },
      message: action === 'approve'
        ? 'Edit request approved'
        : 'Edit request rejected',
    })
  } catch (error) {
    console.error('Token-based approval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
