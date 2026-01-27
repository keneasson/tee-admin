import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { contactRequestRepository } from '@my/app/provider/dynamodb/repositories/contact-request-repository'
import type { ContactRequestStatus } from '@my/app/provider/dynamodb/types'

const validStatuses: ContactRequestStatus[] = ['pending', 'viewed', 'responded', 'declined']

/**
 * GET /api/contact-requests/[requestId] - Get a specific contact request
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

    const contactRequest = await contactRequestRepository.getRequest(
      session.user.email,
      requestId
    )

    if (!contactRequest) {
      return NextResponse.json(
        { error: 'Contact request not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      request: {
        requestId: contactRequest.requestId,
        requesterEmail: contactRequest.requesterEmail,
        requestType: contactRequest.requestType,
        message: contactRequest.message,
        status: contactRequest.status,
        createdAt: contactRequest.createdAt,
      },
    })
  } catch (error) {
    console.error('Get contact request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/contact-requests/[requestId] - Update contact request status
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

    // Validate status
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Verify the request exists and belongs to this user
    const existing = await contactRequestRepository.getRequest(
      session.user.email,
      requestId
    )

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact request not found' },
        { status: 404 }
      )
    }

    const updated = await contactRequestRepository.updateRequestStatus(
      session.user.email,
      requestId,
      status
    )

    return NextResponse.json({
      success: true,
      request: {
        requestId: updated.requestId,
        status: updated.status,
      },
      message: 'Contact request updated successfully',
    })
  } catch (error) {
    console.error('Update contact request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/contact-requests/[requestId] - Delete a contact request
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

    // Verify the request exists and belongs to this user
    const existing = await contactRequestRepository.getRequest(
      session.user.email,
      requestId
    )

    if (!existing) {
      return NextResponse.json(
        { error: 'Contact request not found' },
        { status: 404 }
      )
    }

    await contactRequestRepository.deleteRequest(session.user.email, requestId)

    return NextResponse.json({
      success: true,
      message: 'Contact request deleted successfully',
    })
  } catch (error) {
    console.error('Delete contact request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
