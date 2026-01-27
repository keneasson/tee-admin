import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { connectionRepository } from '@my/app/provider/dynamodb/repositories/connection-repository'

/**
 * GET /api/user/connections - Get all connections for current user
 * (people you've chosen to share your info with)
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

    const connections = await connectionRepository.getActiveConnections(session.user.email)
    const blocked = await connectionRepository.getBlockedUsers(session.user.email)

    return NextResponse.json({
      success: true,
      connections: connections.map(conn => ({
        targetEmail: conn.targetEmail,
        status: conn.status,
        createdAt: conn.createdAt,
      })),
      blocked,
    })
  } catch (error) {
    console.error('Get connections error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/connections - Add a new connection (share your info with someone)
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
    const { targetEmail } = body

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'Missing required field: targetEmail' },
        { status: 400 }
      )
    }

    // Can't connect with yourself
    if (targetEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot create connection with yourself' },
        { status: 400 }
      )
    }

    // Check if already connected
    const existing = await connectionRepository.getConnection(session.user.email, targetEmail)
    if (existing?.status === 'active') {
      return NextResponse.json(
        { error: 'Connection already exists' },
        { status: 409 }
      )
    }

    // Check if blocked
    if (existing?.status === 'blocked') {
      return NextResponse.json(
        { error: 'Cannot connect with a blocked user. Unblock them first.' },
        { status: 400 }
      )
    }

    await connectionRepository.addConnection(session.user.email, targetEmail)

    return NextResponse.json({
      success: true,
      message: 'Connection added successfully. Your info is now shared with this person.',
    })
  } catch (error) {
    console.error('Add connection error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/connections - Remove a connection (stop sharing your info)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetEmail = searchParams.get('targetEmail')

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'Missing required parameter: targetEmail' },
        { status: 400 }
      )
    }

    // Check if connection exists
    const existing = await connectionRepository.getConnection(session.user.email, targetEmail)
    if (!existing || existing.status !== 'active') {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    await connectionRepository.removeConnection(session.user.email, targetEmail)

    return NextResponse.json({
      success: true,
      message: 'Connection removed. Your info is no longer shared with this person.',
    })
  } catch (error) {
    console.error('Remove connection error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
