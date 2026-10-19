import { NextRequest, NextResponse } from 'next/server'
import { sendQueueRepo } from '@my/app/provider/dynamodb/repositories/send-queue-repository'
import { CreateScheduleRequest, UpdateScheduleRequest } from '@my/app/types/send-queue'
import { auth } from '@/utils/auth'
import { mailingListRepository } from '@my/app/provider/dynamodb/repositories/mailing-list-repository'

/** A schedule's listId must name an active list ('' / absent = the default list). */
async function invalidListId(listId: unknown): Promise<NextResponse | null> {
  if (listId === undefined || listId === '') return null
  if (typeof listId !== 'string') return NextResponse.json({ error: 'listId must be a string' }, { status: 400 })
  const list = await mailingListRepository.getList(listId)
  if (!list || list.status !== 'active') {
    return NextResponse.json({ error: 'That list does not exist or is archived.' }, { status: 400 })
  }
  return null
}

/**
 * GET /api/email-schedules
 * Get all email schedules
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

    const schedules = await sendQueueRepo.getAllSchedules()
    return NextResponse.json({ schedules })
  } catch (error) {
    console.error('Failed to get schedules:', error)
    return NextResponse.json(
      { error: 'Failed to get schedules' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email-schedules
 * Create a new email schedule
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

    const body: CreateScheduleRequest = await req.json()

    // Validate required fields
    if (!body.emailType || !body.dayOfWeek || !body.time) {
      return NextResponse.json(
        { error: 'Missing required fields: emailType, dayOfWeek, time' },
        { status: 400 }
      )
    }
    const badList = await invalidListId(body.listId)
    if (badList) return badList

    const schedule = await sendQueueRepo.putSchedule(body)
    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error) {
    console.error('Failed to create schedule:', error)
    return NextResponse.json(
      { error: 'Failed to create schedule' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/email-schedules
 * Update an existing email schedule
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

    const body: UpdateScheduleRequest = await req.json()

    // Validate required field
    if (!body.emailType) {
      return NextResponse.json(
        { error: 'Missing required field: emailType' },
        { status: 400 }
      )
    }
    const badList = await invalidListId(body.listId)
    if (badList) return badList

    const schedule = await sendQueueRepo.updateSchedule(body)
    return NextResponse.json({ schedule })
  } catch (error) {
    console.error('Failed to update schedule:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update schedule' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email-schedules?emailType={type}&dayOfWeek={day}&time={time}
 * Delete an email schedule by exact PK/SK
 */
export async function DELETE(req: NextRequest) {
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

    const emailType = req.nextUrl.searchParams.get('emailType')
    const dayOfWeek = req.nextUrl.searchParams.get('dayOfWeek')
    const time = req.nextUrl.searchParams.get('time')

    if (!emailType || !dayOfWeek || !time) {
      return NextResponse.json(
        { error: 'Missing required parameters: emailType, dayOfWeek, time' },
        { status: 400 }
      )
    }

    await sendQueueRepo.deleteSchedule(emailType as any, dayOfWeek as any, time)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete schedule:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
