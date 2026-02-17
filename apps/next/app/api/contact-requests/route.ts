import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { contactRequestRepository, ContactRequestRepository } from '@my/app/provider/dynamodb/repositories/contact-request-repository'
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import { connectionRepository } from '@my/app/provider/dynamodb/repositories/connection-repository'
import type { ContactRequestType, ContactRequestReason } from '@my/app/provider/dynamodb/types'

const validRequestTypes: ContactRequestType[] = ['phone', 'email', 'text']
const validReasons: ContactRequestReason[] = ['personal', 'ecclesial']

/**
 * GET /api/contact-requests - Get contact requests received by current user
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const result = await contactRequestRepository.getReceivedRequests(session.user.email)
    const unreadCount = await contactRequestRepository.getUnreadCount(session.user.email)

    return NextResponse.json({
      success: true,
      requests: result.items.map(req => ({
        requestId: req.requestId,
        requesterEmail: req.requesterEmail,
        requestType: req.requestType,
        message: req.message,
        status: req.status,
        createdAt: req.createdAt,
      })),
      unreadCount,
    })
  } catch (error) {
    console.error('Get contact requests error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/contact-requests - Create a new contact request
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { recipientEmail, requestType, message, reason } = body

    // Validate required fields
    if (!recipientEmail || !requestType) {
      return NextResponse.json(
        { error: 'Missing required fields: recipientEmail, requestType' },
        { status: 400 }
      )
    }

    // Validate request type
    if (!validRequestTypes.includes(requestType)) {
      return NextResponse.json(
        { error: `Invalid request type. Must be one of: ${validRequestTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate reason if provided
    if (reason && !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: `Invalid reason. Must be one of: ${validReasons.join(', ')}` },
        { status: 400 }
      )
    }

    // Can't request contact from yourself
    if (recipientEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot request contact from yourself' },
        { status: 400 }
      )
    }

    // Check active request limit
    const activeCount = await contactRequestRepository.countActiveSentRequests(session.user.email)
    if (activeCount >= ContactRequestRepository.MAX_ACTIVE_REQUESTS) {
      return NextResponse.json(
        { error: `You have reached the maximum of ${ContactRequestRepository.MAX_ACTIVE_REQUESTS} active contact requests. Please wait for existing requests to be responded to or expire (7 days).` },
        { status: 429 }
      )
    }

    // Check if recipient allows contact requests
    const recipientPrivacy = await privacyRepository.getPrivacySettings(recipientEmail)
    if (!recipientPrivacy.allowContactRequests) {
      return NextResponse.json(
        { error: 'This member does not accept contact requests' },
        { status: 403 }
      )
    }

    // Check if blocked by recipient
    const isBlocked = await connectionRepository.isBlocked(recipientEmail, session.user.email)
    if (isBlocked) {
      return NextResponse.json(
        { error: 'Unable to send contact request to this member' },
        { status: 403 }
      )
    }

    // Check for existing pending request
    const hasPending = await contactRequestRepository.hasPendingRequest(
      session.user.email,
      recipientEmail
    )
    if (hasPending) {
      return NextResponse.json(
        { error: 'You already have a pending request to this member' },
        { status: 409 }
      )
    }

    // Create the request
    const contactRequest = await contactRequestRepository.createRequest(
      session.user.email,
      recipientEmail,
      requestType,
      message,
      reason
    )

    return NextResponse.json({
      success: true,
      requestId: contactRequest.requestId,
      message: 'Contact request sent successfully',
    })
  } catch (error) {
    console.error('Create contact request error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
