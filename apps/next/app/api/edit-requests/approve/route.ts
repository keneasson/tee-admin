import { NextRequest, NextResponse } from 'next/server'
import { editRequestRepository } from '@my/app/provider/dynamodb/repositories/edit-request-repository'

/**
 * GET /api/edit-requests/approve?token=xxx&action=approve|reject
 * Token-based approval from email link (no authentication required)
 *
 * This allows users to approve/reject edit requests directly from email
 * without needing to sign in.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const action = searchParams.get('action')

    // Validate parameters
    if (!token) {
      return NextResponse.json(
        { error: 'Missing token parameter' },
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
        { error: 'Invalid or expired token. The link may have expired.' },
        { status: 404 }
      )
    }

    // Check if already processed
    if (editRequest.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: `This request has already been ${editRequest.status}`,
        request: {
          field: editRequest.field,
          suggestedValue: editRequest.suggestedValue,
          status: editRequest.status,
        },
      })
    }

    // Process the action
    const updated = action === 'approve'
      ? await editRequestRepository.approveRequest(editRequest.targetEmail, editRequest.requestId)
      : await editRequestRepository.rejectRequest(editRequest.targetEmail, editRequest.requestId)

    // TODO: If approved and field is not 'email', apply the edit automatically
    // For 'email' field, require additional verification

    // Return success with details
    return NextResponse.json({
      success: true,
      action,
      request: {
        requestId: updated.requestId,
        field: updated.field,
        suggestedValue: updated.suggestedValue,
        requesterName: updated.requesterName || updated.requesterEmail,
        status: updated.status,
      },
      message: action === 'approve'
        ? 'Edit request approved successfully'
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
