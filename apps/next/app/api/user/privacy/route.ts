import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import type { VisibilityLevel } from '@my/app/provider/dynamodb/types'

const validVisibilityLevels: VisibilityLevel[] = [
  'authenticated',
  'ecclesia_and_connections',
  'connections_only',
  'private',
]

/**
 * GET /api/user/privacy - Get privacy settings for current user
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const settings = await privacyRepository.getPrivacySettings(session.user.email)

    return NextResponse.json({
      success: true,
      privacy: {
        showName: settings.showName,
        showPhone: settings.showPhone,
        showAddress: settings.showAddress,
        showEmail: settings.showEmail,
        showFamily: settings.showFamily,
        allowContactRequests: settings.allowContactRequests,
        allowConnectionRequests: settings.allowConnectionRequests,
        preferredContactMethod: settings.preferredContactMethod,
      },
    })
  } catch (error) {
    console.error('Get privacy settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/privacy - Update privacy settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      showName,
      showPhone,
      showAddress,
      showEmail,
      showFamily,
      allowContactRequests,
      allowConnectionRequests,
      preferredContactMethod,
    } = body

    // Validate visibility levels
    const visibilityFields = { showName, showPhone, showAddress, showEmail, showFamily }
    for (const [field, value] of Object.entries(visibilityFields)) {
      if (value !== undefined && !validVisibilityLevels.includes(value as VisibilityLevel)) {
        return NextResponse.json(
          { error: `Invalid visibility level for ${field}. Must be one of: ${validVisibilityLevels.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate preferred contact method
    if (preferredContactMethod !== undefined && !['email', 'phone', 'either'].includes(preferredContactMethod)) {
      return NextResponse.json(
        { error: 'Invalid preferredContactMethod. Must be one of: email, phone, either' },
        { status: 400 }
      )
    }

    // Build updates object with only provided fields
    const updates: Record<string, any> = {}
    if (showName !== undefined) updates.showName = showName
    if (showPhone !== undefined) updates.showPhone = showPhone
    if (showAddress !== undefined) updates.showAddress = showAddress
    if (showEmail !== undefined) updates.showEmail = showEmail
    if (showFamily !== undefined) updates.showFamily = showFamily
    if (allowContactRequests !== undefined) updates.allowContactRequests = allowContactRequests
    if (allowConnectionRequests !== undefined) updates.allowConnectionRequests = allowConnectionRequests
    if (preferredContactMethod !== undefined) updates.preferredContactMethod = preferredContactMethod

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const updated = await privacyRepository.updatePrivacySettings(session.user.email, updates)

    return NextResponse.json({
      success: true,
      privacy: {
        showName: updated.showName,
        showPhone: updated.showPhone,
        showAddress: updated.showAddress,
        showEmail: updated.showEmail,
        showFamily: updated.showFamily,
        allowContactRequests: updated.allowContactRequests,
        allowConnectionRequests: updated.allowConnectionRequests,
        preferredContactMethod: updated.preferredContactMethod,
      },
      message: 'Privacy settings updated successfully',
    })
  } catch (error) {
    console.error('Update privacy settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
