import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { ScheduleRepository } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import type { ProgramTypeKeys } from '@my/app/types'
import { checkEcclesiaEditPermission } from '@/utils/ecclesia-permissions'

const scheduleRepo = new ScheduleRepository()

/**
 * GET /api/ecclesia/[name]/schedule
 * Fetch schedule entries for an ecclesia.
 * Query: ?type=memorial|bibleClass|sundaySchool|cyc&days=14
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as any).role || ROLES.GUEST
    if (role === ROLES.GUEST || role === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const { name } = await params
    const ecclesiaName = decodeURIComponent(name)
    const searchParams = request.nextUrl.searchParams
    const scheduleType = searchParams.get('type') as ProgramTypeKeys | null
    const days = parseInt(searchParams.get('days') || '30', 10)

    const startDate = new Date().toISOString().split('T')[0]
    const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const result = await scheduleRepo.getSchedulesByEcclesiaAndDateRange({
      ecclesia: ecclesiaName,
      startDate,
      endDate,
    })

    let items = result.items
    if (scheduleType) {
      items = items.filter((item) => item.type === scheduleType)
    }

    return NextResponse.json({
      success: true,
      ecclesia: ecclesiaName,
      schedules: items.map((item) => ({
        date: item.date,
        type: item.type,
        data: item.data,
        dateTime: item.dateTime,
        sourceTimezone: item.sourceTimezone,
      })),
    })
  } catch (error) {
    console.error('Error fetching ecclesia schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
  }
}

/**
 * POST /api/ecclesia/[name]/schedule
 * Create or update a schedule entry for an ecclesia.
 * Body: { type: ProgramTypeKeys, date: string, data: Record<string, any>, timezone?: string }
 * Requires edit permission on the ecclesia.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name } = await params
    const ecclesiaName = decodeURIComponent(name)
    const userEmail = session.user.email.toLowerCase()
    const userRole = (session.user as any).role || ROLES.GUEST

    const canEdit = await checkEcclesiaEditPermission(userEmail, userRole, ecclesiaName)
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { type, date, data, timezone } = body as {
      type: ProgramTypeKeys
      date: string
      data: Record<string, any>
      timezone?: string
    }

    if (!type || !date || !data) {
      return NextResponse.json({ error: 'type, date, and data are required' }, { status: 400 })
    }

    const validTypes: ProgramTypeKeys[] = ['memorial', 'bibleClass', 'sundaySchool', 'cyc']
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 })
    }

    // Ensure date fields are set
    data.Date = data.Date || date
    data.Key = data.Key || type

    const record = await scheduleRepo.createScheduleRecord(
      `manual-${ecclesiaName}`, // sheetId for manually entered schedules
      ecclesiaName,
      type,
      date,
      data as any,
      '09:00',
      0,
      undefined, // dateTime - computed if timezone provided
      timezone || 'America/Toronto'
    )

    return NextResponse.json({ success: true, schedule: record }, { status: 201 })
  } catch (error) {
    console.error('Error creating schedule entry:', error)
    return NextResponse.json({ error: 'Failed to create schedule entry' }, { status: 500 })
  }
}

/**
 * DELETE /api/ecclesia/[name]/schedule
 * Delete a schedule entry.
 * Body: { type: ProgramTypeKeys, date: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name } = await params
    const ecclesiaName = decodeURIComponent(name)
    const userEmail = session.user.email.toLowerCase()
    const userRole = (session.user as any).role || ROLES.GUEST

    const canEdit = await checkEcclesiaEditPermission(userEmail, userRole, ecclesiaName)
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { type, date } = body as { type: ProgramTypeKeys; date: string }

    if (!type || !date) {
      return NextResponse.json({ error: 'type and date are required' }, { status: 400 })
    }

    // Build the keys to delete
    const PK = `SCHEDULE#${type.toUpperCase()}`
    const SK = `DATE#${new Date(date).toISOString()}#0`

    await scheduleRepo.delete(PK, SK)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule entry:', error)
    return NextResponse.json({ error: 'Failed to delete schedule entry' }, { status: 500 })
  }
}
