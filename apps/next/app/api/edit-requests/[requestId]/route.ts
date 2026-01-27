import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { editRequestRepository } from '@my/app/provider/dynamodb/repositories/edit-request-repository'
import type { EditRequestStatus } from '@my/app/provider/dynamodb/types'

const validStatuses: EditRequestStatus[] = ['pending', 'approved', 'rejected', 'expired']

/**
 * GET /api/edit-requests/[requestId] - Get a specific edit request
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { requestId } = await params

    // Try to find the request (either as owner or requester)
    const editRequest = await editRequestRepository.getRequestById(
      session.user.email,
      requestId
    )

    if (!editRequest) {
      return NextResponse.json(
        { error: 'Edit request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      request: {
        requestId: editRequest.requestId,
        requesterEmail: editRequest.requesterEmail,
        requesterName: editRequest.requesterName,
        targetEmail: editRequest.targetEmail,
        field: editRequest.field,
        currentValue: editRequest.currentValue,
        suggestedValue: editRequest.suggestedValue,
        message: editRequest.message,
        status: editRequest.status,
        createdAt: editRequest.createdAt,
        respondedAt: editRequest.respondedAt,
      },
    })
  } catch (error) {
    console.error('Get edit request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/edit-requests/[requestId] - Approve or reject an edit request
 * Only the target user (profile owner) can approve/reject
 * Request body:
 *   - status: 'approved' | 'rejected'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { requestId } = await params
    const body = await request.json()
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      )
    }

    // Only allow approve/reject from this endpoint
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json(
        { error: 'Status must be "approved" or "rejected"' },
        { status: 400 }
      )
    }

    // Verify the request exists and current user is the target
    const existing = await editRequestRepository.getRequestById(
      session.user.email,
      requestId
    )

    if (!existing) {
      return NextResponse.json(
        { error: 'Edit request not found' },
        { status: 404 }
      )
    }

    // Only the target user can approve/reject
    if (existing.targetEmail !== session.user.email) {
      return NextResponse.json(
        { error: 'Only the profile owner can approve or reject this request' },
        { status: 403 }
      )
    }

    // Check if already processed
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `This request has already been ${existing.status}` },
        { status: 400 }
      )
    }

    // Update status
    const updated = status === 'approved'
      ? await editRequestRepository.approveRequest(session.user.email, requestId)
      : await editRequestRepository.rejectRequest(session.user.email, requestId)

    // TODO: If approved and field is not 'email', apply the edit automatically
    // For 'email' field, require additional verification

    return NextResponse.json({
      success: true,
      request: {
        requestId: updated.requestId,
        status: updated.status,
        respondedAt: updated.respondedAt,
      },
      message: `Edit request ${status}`,
    })
  } catch (error) {
    console.error('Update edit request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/edit-requests/[requestId] - Delete/cancel an edit request
 * The requester can cancel their own pending request
 * The target can delete any request
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { requestId } = await params

    // Try to find as target first
    let existing = await editRequestRepository.getRequestById(
      session.user.email,
      requestId
    )

    if (existing) {
      // User is the target - they can delete
      await editRequestRepository.deleteRequest(session.user.email, requestId)
      return NextResponse.json({
        success: true,
        message: 'Edit request deleted',
      })
    }

    // Not found as target - check if user is the requester
    const sentRequests = await editRequestRepository.getSentRequests(session.user.email)
    const foundRequest = sentRequests.find(r => r.requestId === requestId)

    if (!foundRequest) {
      return NextResponse.json(
        { error: 'Edit request not found' },
        { status: 404 }
      )
    }

    existing = foundRequest

    // Requester can only cancel pending requests
    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only cancel pending requests' },
        { status: 400 }
      )
    }

    await editRequestRepository.deleteRequest(existing.targetEmail, requestId)

    return NextResponse.json({
      success: true,
      message: 'Edit request cancelled',
    })
  } catch (error) {
    console.error('Delete edit request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
