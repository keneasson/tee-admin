import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { getAllEcclesia, updateEcclesiaFields } from '@/utils/dynamodb/locations'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkEcclesiaEditPermission, checkRecordingBrotherPermission } from '@/utils/ecclesia-permissions'
import { getMemberCounts } from './cache'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Require at least member role
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const ecclesias = await getAllEcclesia()

    // Sort by name
    ecclesias.sort((a, b) => a.name.localeCompare(b.name))

    // Member counts via GSI2 SELECT COUNT queries (cached 5 min)
    const memberCounts = await getMemberCounts(ecclesias.map(e => e.name))

    // Transform to include id (using name as id for now)
    const transformedEcclesias = ecclesias.map((ecclesia) => ({
      id: ecclesia.name, // Using name as ID since it's unique
      name: ecclesia.name,
      city: ecclesia.city,
      province: ecclesia.province,
      country: ecclesia.country,
      address: ecclesia.address,
      postalCode: ecclesia.postalCode,
      venue: ecclesia.venue,
      phone: ecclesia.phone,
      contactEmail: ecclesia.contactEmail,
      recordingBrotherEmail: ecclesia.recordingBrotherEmail,
      recordingBrotherName: ecclesia.recordingBrotherName,
      memberCount: memberCounts[ecclesia.name] || 0,
      services: ecclesia.services || [],
      hall: ecclesia.address ? {
        name: ecclesia.name,
        address: ecclesia.address,
        city: ecclesia.city,
        province: ecclesia.province,
        postalCode: ecclesia.postalCode,
        country: ecclesia.country,
      } : undefined,
    }))

    return NextResponse.json({
      success: true,
      ecclesias: transformedEcclesias,
    })
  } catch (error) {
    console.error('Error fetching ecclesias:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ecclesias',
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/ecclesias - Update ecclesia fields
 * Owner/Admin: can update any ecclesia fields including Recording Brother
 * Recorder: can update own ecclesia fields including Recording Brother
 * Rep: can update own ecclesia fields EXCEPT Recording Brother
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userEmail = session.user.email.toLowerCase()
    const viewerRole = (session.user as any).role as string || ROLES.GUEST

    const body = await request.json()
    const { name, recordingBrotherEmail, recordingBrotherName, ...otherFields } = body as {
      name?: string
      recordingBrotherEmail?: string
      recordingBrotherName?: string
      [key: string]: any
    }

    if (!name) {
      return NextResponse.json({ error: 'Ecclesia name is required' }, { status: 400 })
    }

    // Check general edit permission
    const canEdit = await checkEcclesiaEditPermission(userEmail, viewerRole, name)
    if (!canEdit) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const updates: Record<string, any> = {}

    // Recording Brother fields require elevated permission
    if (recordingBrotherEmail !== undefined || recordingBrotherName !== undefined) {
      const canSetRb = await checkRecordingBrotherPermission(userEmail, viewerRole, name)
      if (!canSetRb) {
        return NextResponse.json(
          { error: 'You do not have permission to set the Recording Brother' },
          { status: 403 }
        )
      }
      if (recordingBrotherEmail !== undefined) updates.recordingBrotherEmail = recordingBrotherEmail.trim()
      if (recordingBrotherName !== undefined) updates.recordingBrotherName = recordingBrotherName.trim()
    }

    // Other fields (address, venue, etc.) — allowed if canEdit
    for (const [key, value] of Object.entries(otherFields)) {
      if (value !== undefined && typeof value === 'string') {
        updates[key] = value.trim()
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await updateEcclesiaFields(name, updates)

    return NextResponse.json({
      success: true,
      ecclesia: updated,
    })
  } catch (error) {
    console.error('Error updating ecclesia:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update ecclesia' },
      { status: 500 }
    )
  }
}
