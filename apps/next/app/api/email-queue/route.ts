import { NextRequest, NextResponse } from 'next/server'
import { sendQueueRepo } from '@my/app/provider/dynamodb/repositories/send-queue-repository'
import { QueueEntryRequest, QueueStatus } from '@my/app/types/send-queue'
import { auth } from '@/utils/auth'

/**
 * GET /api/email-queue
 * Get queue entries with optional filtering
 * Query params:
 *   - status: filter by status (ready/complete/failed)
 *   - startDate: filter by date range (YYYY-MM-DD)
 *   - endDate: filter by date range (YYYY-MM-DD)
 *   - summary: get summary stats instead of entries
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or owner
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const summary = searchParams.get('summary') === 'true'
    const status = searchParams.get('status') as QueueStatus | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Return summary if requested
    if (summary) {
      const queueSummary = await sendQueueRepo.getQueueSummary()
      return NextResponse.json({ summary: queueSummary })
    }

    // Get queue entries
    let entries

    if (status === 'ready') {
      entries = await sendQueueRepo.getReadyEmails()
    } else if (startDate && endDate) {
      entries = await sendQueueRepo.getQueueByDateRange(startDate, endDate)
      // Apply status filter if provided
      if (status) {
        entries = entries.filter(e => e.status === status)
      }
    } else {
      // Get all queue entries (via date range covering reasonable period)
      const today = new Date()
      const thirtyDaysAgo = new Date(today)
      thirtyDaysAgo.setDate(today.getDate() - 30)
      const thirtyDaysAhead = new Date(today)
      thirtyDaysAhead.setDate(today.getDate() + 30)

      const start = thirtyDaysAgo.toISOString().split('T')[0]
      const end = thirtyDaysAhead.toISOString().split('T')[0]

      entries = await sendQueueRepo.getQueueByDateRange(start, end)

      // Apply status filter if provided
      if (status) {
        entries = entries.filter(e => e.status === status)
      }
    }

    return NextResponse.json({ entries })
  } catch (error) {
    console.error('Failed to get queue entries:', error)
    return NextResponse.json(
      { error: 'Failed to get queue entries' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email-queue
 * Manually add an email to the send queue
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or owner
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: QueueEntryRequest = await req.json()

    // Validate required fields
    if (!body.emailType || !body.scheduledDate || !body.scheduledTime) {
      return NextResponse.json(
        { error: 'Missing required fields: emailType, scheduledDate, scheduledTime' },
        { status: 400 }
      )
    }

    const entry = await sendQueueRepo.addToQueue(body)
    return NextResponse.json({ entry }, { status: 201 })
  } catch (error) {
    console.error('Failed to add to queue:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add to queue' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/email-queue
 * Update queue entry status (for retry, manual marking, etc.)
 */
export async function PATCH(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or owner
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { emailType, scheduledDate, scheduledTime, status, metadata } = body

    // Validate required fields
    if (!emailType || !scheduledDate || !scheduledTime || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: emailType, scheduledDate, scheduledTime, status' },
        { status: 400 }
      )
    }

    const entry = await sendQueueRepo.updateQueueStatus(
      emailType,
      scheduledDate,
      scheduledTime,
      status,
      metadata
    )

    return NextResponse.json({ entry })
  } catch (error) {
    console.error('Failed to update queue entry:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update queue entry' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email-queue/cleanup?days={days}
 * Clean up old queue entries (maintenance endpoint)
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner (only owners can cleanup)
    const userRole = (session.user as any).role
    if (userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden - Owner role required' }, { status: 403 })
    }

    const days = parseInt(req.nextUrl.searchParams.get('days') || '30')
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffString = cutoffDate.toISOString().split('T')[0]

    const deletedCount = await sendQueueRepo.cleanupOldEntries(cutoffString)

    return NextResponse.json({
      success: true,
      deletedCount,
      cutoffDate: cutoffString,
    })
  } catch (error) {
    console.error('Failed to cleanup queue:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup queue' },
      { status: 500 }
    )
  }
}
