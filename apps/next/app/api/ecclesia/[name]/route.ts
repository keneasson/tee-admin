import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { getEcclesiaByName, updateEcclesiaFields } from '@/utils/dynamodb/locations'
import type { EcclesiaService, EcclesiaExternalLinks } from '@/utils/dynamodb/locations'
import { checkEcclesiaEditPermission, checkRecordingBrotherPermission } from '@/utils/ecclesia-permissions'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { setRecordingBrother, clearRecordingBrother } from '@/utils/rb-service'
import { sendRBConfirmationEmail } from '@/utils/email/send-rb-confirmation'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

/**
 * GET /api/ecclesia/[name] - Fetch a single ecclesia by name
 * Returns ecclesia data + canEdit permission flag
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

    // Require at least member role
    const getRole = (session.user as any).role || ROLES.GUEST
    if (getRole === ROLES.GUEST || getRole === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const { name } = await params
    const ecclesiaName = decodeURIComponent(name)

    const ecclesia = await getEcclesiaByName(ecclesiaName)
    if (!ecclesia) {
      return NextResponse.json({ error: 'Ecclesia not found' }, { status: 404 })
    }

    const userEmail = session.user.email?.toLowerCase() || ''
    const userRole = (session.user as any).role || ROLES.GUEST

    const canEdit = await checkEcclesiaEditPermission(userEmail, userRole, ecclesiaName)
    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)

    return NextResponse.json({
      success: true,
      ecclesia,
      canEdit,
      showMultiTenant,
    })
  } catch (error) {
    console.error('Error fetching ecclesia:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ecclesia' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/ecclesia/[name] - Update ecclesia fields
 * Permission-gated: owner, same-ecclesia admin, or recording brother
 */
export async function PATCH(
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
    const {
      address,
      venue,
      postalCode,
      phone,
      contactEmail,
      recordingBrotherEmail,
      recordingBrotherName,
      services,
      website,
      externalLinks,
    } = body as {
      address?: string
      venue?: string
      postalCode?: string
      phone?: string
      contactEmail?: string
      recordingBrotherEmail?: string
      recordingBrotherName?: string
      services?: EcclesiaService[]
      website?: string
      externalLinks?: EcclesiaExternalLinks
    }

    const updates: Record<string, any> = {}
    if (address !== undefined) updates.address = address.trim()
    if (venue !== undefined) updates.venue = venue.trim()
    if (postalCode !== undefined) updates.postalCode = postalCode.trim()
    if (phone !== undefined) updates.phone = phone.trim()
    if (contactEmail !== undefined) updates.contactEmail = contactEmail.trim()
    if (services !== undefined) updates.services = services
    if (website !== undefined) updates.website = website.trim()
    if (externalLinks !== undefined) updates.externalLinks = externalLinks

    // Recording Brother fields require elevated permission and use RB service
    let rbTransferred = false
    if (recordingBrotherEmail !== undefined || recordingBrotherName !== undefined) {
      const canSetRb = await checkRecordingBrotherPermission(userEmail, userRole, ecclesiaName)
      if (!canSetRb) {
        return NextResponse.json(
          { error: 'You do not have permission to set the Recording Brother' },
          { status: 403 }
        )
      }

      const newRBEmail = (recordingBrotherEmail ?? '').trim()

      if (newRBEmail) {
        // Look up person by this email to get their personId
        const rbPerson = await personRepository.getByEmail(newRBEmail)
        const rbPersonAlt = rbPerson ? null : (await personRepository.getAllPersonsByEmail(newRBEmail))[0]
        const resolvedPerson = rbPerson || rbPersonAlt

        if (resolvedPerson) {
          // Send confirmation email to nominee instead of activating immediately
          await sendRBConfirmationEmail({
            recipientEmail: newRBEmail,
            recipientName: resolvedPerson.displayName || newRBEmail,
            ecclesiaName,
            emailPreference: 'personal',
            personId: resolvedPerson.personId,
          })
        }
        rbTransferred = true
      } else {
        // Clearing the RB
        await clearRecordingBrother(ecclesiaName)
        rbTransferred = true
      }
    }

    // If RB was transferred, those fields were already updated
    if (rbTransferred) {
      delete updates.recordingBrotherEmail
      delete updates.recordingBrotherName
    }

    // Apply remaining non-RB updates if any
    if (Object.keys(updates).length === 0 && !rbTransferred) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    let updated
    if (Object.keys(updates).length > 0) {
      updated = await updateEcclesiaFields(ecclesiaName, updates)
    } else {
      // Only RB was changed; re-fetch to return current state
      updated = await getEcclesiaByName(ecclesiaName)
    }

    return NextResponse.json({
      success: true,
      ecclesia: updated,
    })
  } catch (error) {
    console.error('Error updating ecclesia:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update ecclesia' },
      { status: 500 }
    )
  }
}
