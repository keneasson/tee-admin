import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { getAllEcclesia, getEcclesiaByName, updateEcclesiaFields } from '@/utils/dynamodb/locations'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkEcclesiaEditPermission, checkRecordingBrotherPermission } from '@/utils/ecclesia-permissions'
import { getMemberCounts } from './cache'
import { recordingBrothersOf } from '@/utils/ecclesia-offices'
import { officeRepository, OFFICE_ROLES } from '@my/app/provider/dynamodb/repositories/office-repository'
import { ecclesiaIdOf } from '@my/app/provider/dynamodb/people-index'

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
    // Recording Brother = the ecclesia's RB office (Query per ecclesia + one BatchGet)
    const rbs = await recordingBrothersOf(ecclesias)

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
      ecclesiaId: ecclesiaIdOf(ecclesia),
      recordingBrother: rbs.get(ecclesiaIdOf(ecclesia)) || null,
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
 * Owner/Admin: can update any ecclesia fields including the Recording Brother office
 * Recorder: can update own ecclesia fields including the Recording Brother office
 * Rep: can update own ecclesia fields EXCEPT the Recording Brother office
 *
 * The Recording Brother is an office (R3): `rbOfficeEmail` / `rbOfficePhone`
 * set the office's OWN contact channels through `officeRepository` (null or ''
 * clears). The holder changes only through nomination/confirmation (rb-service).
 * The ecclesia item never stores an RB name or email.
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
    const { name, rbOfficeEmail, rbOfficePhone, recordingBrotherEmail, recordingBrotherName, ...otherFields } = body as {
      name?: string
      rbOfficeEmail?: string | null
      rbOfficePhone?: string | null
      [key: string]: any
    }
    if (recordingBrotherEmail !== undefined || recordingBrotherName !== undefined) {
      return NextResponse.json(
        { error: 'The Recording Brother is an office: send rbOfficeEmail / rbOfficePhone, or nominate a holder' },
        { status: 400 }
      )
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

    // Recording Brother office channels require elevated permission
    const rbOfficeChange = rbOfficeEmail !== undefined || rbOfficePhone !== undefined
    if (rbOfficeChange) {
      const canSetRb = await checkRecordingBrotherPermission(userEmail, viewerRole, name)
      if (!canSetRb) {
        return NextResponse.json(
          { error: 'You do not have permission to set the Recording Brother' },
          { status: 403 }
        )
      }
      const email = typeof rbOfficeEmail === 'string' ? rbOfficeEmail.trim() : rbOfficeEmail
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'rbOfficeEmail is not an email address' }, { status: 400 })
      }
    }

    // Other fields (address, venue, etc.) — allowed if canEdit
    for (const [key, value] of Object.entries(otherFields)) {
      if (value !== undefined && typeof value === 'string') {
        updates[key] = value.trim()
      }
    }

    if (Object.keys(updates).length === 0 && !rbOfficeChange) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const ecclesia = await getEcclesiaByName(name)
    if (!ecclesia) {
      return NextResponse.json({ error: 'Ecclesia not found' }, { status: 404 })
    }
    if (rbOfficeChange) {
      const email = typeof rbOfficeEmail === 'string' ? rbOfficeEmail.trim() || null : rbOfficeEmail
      const phone = typeof rbOfficePhone === 'string' ? rbOfficePhone.trim() || null : rbOfficePhone
      await officeRepository.saveOffice({
        ecclesiaId: ecclesiaIdOf(ecclesia),
        role: OFFICE_ROLES.RECORDING_BROTHER,
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      })
    }

    const updated = Object.keys(updates).length > 0 ? await updateEcclesiaFields(ecclesia.name, updates) : ecclesia

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
