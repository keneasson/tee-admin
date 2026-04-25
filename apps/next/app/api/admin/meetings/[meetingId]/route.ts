import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { meetingRepository } from '@my/app/provider/dynamodb/repositories/meeting-repository'

/**
 * GET /api/admin/meetings/[meetingId] - Fetch a single meeting
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
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

    const { meetingId } = await params
    const meeting = await meetingRepository.getById(meetingId)

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const canEdit = userRole === ROLES.ADMIN || userRole === ROLES.OWNER
    const canDelete = userRole === ROLES.OWNER

    return NextResponse.json({ success: true, meeting, canEdit, canDelete })
  } catch (error) {
    console.error('Error fetching meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch meeting' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/meetings/[meetingId] - Update meeting fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
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

    const { meetingId } = await params
    const body = await request.json()

    // Remove immutable fields
    const {
      meetingId: _id,
      pkey: _pkey,
      skey: _skey,
      gsi1pk: _gsi1pk,
      gsi1sk: _gsi1sk,
      createdAt: _createdAt,
      createdBy: _createdBy,
      ...updateFields
    } = body

    const updated = await meetingRepository.updateMeeting(meetingId, updateFields)
    if (!updated) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    const meeting = await meetingRepository.getById(meetingId)
    return NextResponse.json({ success: true, meeting })
  } catch (error) {
    console.error('Error updating meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update meeting' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/meetings/[meetingId] - Delete a meeting
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
    }

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const { meetingId } = await params
    const deleted = await meetingRepository.deleteMeeting(meetingId)
    if (!deleted) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting meeting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete meeting' },
      { status: 500 }
    )
  }
}
