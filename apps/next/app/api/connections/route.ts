import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../utils/auth'
import { connectionRepository } from '@my/app/provider/dynamodb/repositories/connection-repository'
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { tokenRepository } from '@my/app/provider/dynamodb/repositories/token-repository'
import { sendConnectionRequestEmail } from '../../../utils/email/send-connection-email'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * GET /api/connections - List connections and pending requests
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const email = session.user.email

    const [connections, pendingRequests] = await Promise.all([
      connectionRepository.getActiveConnections(email),
      connectionRepository.getPendingRequests(email),
    ])

    return NextResponse.json({
      success: true,
      connections: connections.map(c => ({
        email: c.targetEmail,
        status: c.status,
        createdAt: c.createdAt,
      })),
      pendingRequests: pendingRequests.map(c => ({
        email: c.targetEmail,
        initiatedBy: c.initiatedBy,
        createdAt: c.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/connections - Send a connection request + email
 * Body: { targetEmail: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const requesterEmail = session.user.email
    const body = await request.json()
    const { targetEmail } = body as { targetEmail: string }

    if (!targetEmail) {
      return NextResponse.json({ error: 'targetEmail is required' }, { status: 400 })
    }

    const normalizedTarget = targetEmail.trim().toLowerCase()

    // Can't connect with yourself
    if (requesterEmail.toLowerCase() === normalizedTarget) {
      return NextResponse.json({ error: 'Cannot connect with yourself' }, { status: 400 })
    }

    // Check target exists
    const targetPerson = await personRepository.getByEmail(normalizedTarget)
    if (!targetPerson) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Check existing connection status
    const existingStatus = await connectionRepository.getConnectionStatus(requesterEmail, normalizedTarget)
    if (existingStatus === 'connected') {
      return NextResponse.json({ error: 'Already connected' }, { status: 409 })
    }
    if (existingStatus === 'pending_sent') {
      return NextResponse.json({ error: 'Connection request already sent' }, { status: 409 })
    }
    if (existingStatus === 'pending_received') {
      return NextResponse.json({ error: 'You have a pending request from this person — check your notifications' }, { status: 409 })
    }
    if (existingStatus === 'blocked') {
      return NextResponse.json({ error: 'Cannot connect with this member' }, { status: 403 })
    }

    // Check if target allows connection requests
    const targetPrivacy = await privacyRepository.getPrivacySettings(normalizedTarget)
    if (targetPrivacy.allowConnectionRequests === false) {
      return NextResponse.json({ error: 'This member is not accepting connection requests' }, { status: 403 })
    }

    // Create OTP token for the target so they can click Accept/Decline via email
    const token = await tokenRepository.createOtp(targetPerson.personId, normalizedTarget)

    // Create pending connection records (both directions)
    await connectionRepository.requestConnection(requesterEmail, normalizedTarget, token.tokenValue)

    // Get requester's name for the email
    const requesterPerson = await personRepository.getByEmail(requesterEmail)
    const requesterName = requesterPerson?.displayName
      || [requesterPerson?.firstName, requesterPerson?.lastName].filter(Boolean).join(' ')
      || requesterEmail

    // Send connection request email
    await sendConnectionRequestEmail({
      recipientEmail: normalizedTarget,
      requesterName,
      requesterEmail,
      connectionToken: token.tokenValue,
    })

    return NextResponse.json({ success: true, status: 'pending_sent' })
  } catch (error) {
    console.error('POST /api/connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/connections - Accept or decline a connection request
 * Body: { requesterEmail: string, action: 'accept' | 'decline' }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userEmail = session.user.email
    const body = await request.json()
    const { requesterEmail, action } = body as { requesterEmail: string; action: 'accept' | 'decline' }

    if (!requesterEmail || !action) {
      return NextResponse.json({ error: 'requesterEmail and action are required' }, { status: 400 })
    }

    if (action !== 'accept' && action !== 'decline') {
      return NextResponse.json({ error: 'action must be "accept" or "decline"' }, { status: 400 })
    }

    const normalizedRequester = requesterEmail.trim().toLowerCase()

    // Verify there's a pending request from requester to this user
    const status = await connectionRepository.getConnectionStatus(userEmail, normalizedRequester)
    if (status !== 'pending_received') {
      return NextResponse.json({ error: 'No pending connection request from this member' }, { status: 404 })
    }

    if (action === 'accept') {
      await connectionRepository.acceptConnection(userEmail, normalizedRequester)
      return NextResponse.json({ success: true, status: 'connected' })
    } else {
      await connectionRepository.declineConnection(userEmail, normalizedRequester)
      return NextResponse.json({ success: true, status: 'declined' })
    }
  } catch (error) {
    console.error('PATCH /api/connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/connections - Remove an active connection
 * Body: { targetEmail: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userEmail = session.user.email
    const body = await request.json()
    const { targetEmail } = body as { targetEmail: string }

    if (!targetEmail) {
      return NextResponse.json({ error: 'targetEmail is required' }, { status: 400 })
    }

    const normalizedTarget = targetEmail.trim().toLowerCase()

    // Remove both directions
    await Promise.all([
      connectionRepository.removeConnection(userEmail, normalizedTarget),
      connectionRepository.removeConnection(normalizedTarget, userEmail),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/connections error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
