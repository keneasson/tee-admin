import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { YouTubeService } from '@my/app/provider/youtube/youtube-service'

/**
 * GET /api/youtube/livestreams/[id]
 * Get a specific YouTube livestream by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Livestream ID is required' }, { status: 400 })
    }

    // Initialize YouTube service with OAuth
    const youtubeService = await YouTubeService.createWithOAuth(session.user.email)

    // Fetch the livestream
    const livestream = await youtubeService.getLivestream(id)

    if (!livestream) {
      return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })
    }

    // Simplify the response
    const simplifiedStream = youtubeService.simplifyLivestream(livestream)

    return NextResponse.json({
      stream: simplifiedStream,
    })
  } catch (error) {
    console.error(`❌ Error in GET /api/youtube/livestreams/${params.id}:`, error)
    return NextResponse.json(
      {
        error: 'Failed to fetch livestream',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/youtube/livestreams/[id]
 * Update a specific YouTube livestream
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Livestream ID is required' }, { status: 400 })
    }

    // Parse request body
    const body = await request.json()

    // Validate at least one field is being updated
    if (!body.title && !body.description && !body.scheduledStartTime && !body.privacyStatus) {
      return NextResponse.json(
        {
          error: 'No updates provided',
          message: 'At least one field must be provided for update',
        },
        { status: 400 }
      )
    }

    // Validate date format if provided
    if (body.scheduledStartTime) {
      const scheduledDate = new Date(body.scheduledStartTime)
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          {
            error: 'Invalid date format',
            message: 'scheduledStartTime must be a valid ISO 8601 date string',
          },
          { status: 400 }
        )
      }
    }

    // Initialize YouTube service with OAuth
    const youtubeService = await YouTubeService.createWithOAuth(session.user.email)

    // Update the livestream
    console.log(`📺 Updating livestream: ${id}`)
    const updatedLivestream = await youtubeService.updateLivestream(id, body)

    // Simplify the response
    const simplifiedStream = youtubeService.simplifyLivestream(updatedLivestream)

    console.log(`✅ Livestream updated successfully: ${id}`)

    return NextResponse.json({
      success: true,
      stream: simplifiedStream,
      message: 'Livestream updated successfully',
    })
  } catch (error) {
    console.error(`❌ Error in PATCH /api/youtube/livestreams/${params.id}:`, error)
    return NextResponse.json(
      {
        error: 'Failed to update livestream',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/youtube/livestreams/[id]
 * Delete a specific YouTube livestream
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has owner access (only owners can delete)
    const userRole = (session.user as any).role
    if (userRole !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner access required to delete livestreams' },
        { status: 403 }
      )
    }

    const { id } = params

    if (!id) {
      return NextResponse.json({ error: 'Livestream ID is required' }, { status: 400 })
    }

    // Initialize YouTube service with OAuth
    const youtubeService = await YouTubeService.createWithOAuth(session.user.email)

    // Delete the livestream
    console.log(`📺 Deleting livestream: ${id}`)
    await youtubeService.deleteLivestream(id)

    console.log(`✅ Livestream deleted successfully: ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Livestream deleted successfully',
    })
  } catch (error) {
    console.error(`❌ Error in DELETE /api/youtube/livestreams/${params.id}:`, error)
    return NextResponse.json(
      {
        error: 'Failed to delete livestream',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
