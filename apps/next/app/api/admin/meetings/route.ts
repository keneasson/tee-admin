import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { meetingRepository } from '@my/app/provider/dynamodb/repositories/meeting-repository'

/**
 * GET /api/admin/meetings - List meetings
 * Query params: ownerType, ownerName, active
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole === ROLES.GUEST || userRole === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const ownerType = searchParams.get('ownerType') as 'ecclesia' | 'organization' | null
    const ownerName = searchParams.get('ownerName')
    const activeParam = searchParams.get('active')

    let meetings
    if (ownerType && ownerName) {
      meetings = await meetingRepository.listByOwner(ownerType, ownerName)
    } else {
      meetings = await meetingRepository.listAll()
    }

    // Filter by active status if specified
    if (activeParam !== null) {
      const isActive = activeParam === 'true'
      meetings = meetings.filter((m) => m.active === isActive)
    }

    return NextResponse.json({ success: true, meetings })
  } catch (error) {
    console.error('Error listing meetings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list meetings' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/meetings - Create a meeting
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const body = await request.json()

    const {
      title,
      meetingType,
      ownerType,
      ownerName,
      recurrence,
      oneOffDate,
      startTime,
      endTime,
      timezone,
      platform,
      location,
      onlineMeeting,
      documents,
      notes,
      supersedes,
      audience,
      active,
    } = body

    if (!title || !meetingType || !ownerType || !ownerName || !startTime || !timezone || !platform || !audience) {
      return NextResponse.json(
        { error: 'title, meetingType, ownerType, ownerName, startTime, timezone, platform, and audience are required' },
        { status: 400 }
      )
    }

    const meeting = await meetingRepository.create({
      title,
      meetingType,
      ownerType,
      ownerName,
      recurrence,
      oneOffDate,
      startTime,
      endTime,
      timezone,
      platform,
      location,
      onlineMeeting,
      documents: documents || [],
      notes,
      supersedes,
      audience,
      active: active ?? true,
      createdBy: session.user.email,
    })

    return NextResponse.json({ success: true, meeting }, { status: 201 })
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create meeting' },
      { status: 500 }
    )
  }
}
