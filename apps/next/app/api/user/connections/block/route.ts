import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../../utils/auth'
import { connectionRepository } from '@my/app/provider/dynamodb/repositories/connection-repository'

/**
 * POST /api/user/connections/block - Block a user from requesting contact
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

    // Can't block yourself
    if (targetEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot block yourself' },
        { status: 400 }
      )
    }

    await connectionRepository.blockConnection(session.user.email, targetEmail)

    return NextResponse.json({
      success: true,
      message: 'User blocked successfully. They can no longer request contact from you.',
    })
  } catch (error) {
    console.error('Block user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/connections/block - Unblock a user
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

    // Check if user is actually blocked
    const isBlocked = await connectionRepository.isBlocked(session.user.email, targetEmail)
    if (!isBlocked) {
      return NextResponse.json(
        { error: 'User is not blocked' },
        { status: 404 }
      )
    }

    await connectionRepository.unblockConnection(session.user.email, targetEmail)

    return NextResponse.json({
      success: true,
      message: 'User unblocked successfully.',
    })
  } catch (error) {
    console.error('Unblock user error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
