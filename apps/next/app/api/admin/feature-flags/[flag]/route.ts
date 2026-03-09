import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { featureFlagRepository } from '@my/app/provider/dynamodb/repositories/feature-flag-repository'
import type { FeatureFlagConfig } from '@my/app/features/feature-flags/feature-flags'

/**
 * GET /api/admin/feature-flags/[flag]
 * Get a single flag config. Admin/owner only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flag: string }> }
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

    const { flag } = await params
    const record = await featureFlagRepository.getByName(flag)
    if (!record) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, flag: record })
  } catch (error) {
    console.error('Error fetching feature flag:', error)
    return NextResponse.json({ error: 'Failed to fetch feature flag' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/feature-flags/[flag]
 * Update a flag config. Owner only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flag: string }> }
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

    const { flag } = await params
    const existing = await featureFlagRepository.getByName(flag)
    if (!existing) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Partial<FeatureFlagConfig> = {}

    if (body.enabled !== undefined) updates.enabled = body.enabled
    if (body.rolloutPercentage !== undefined) updates.rolloutPercentage = body.rolloutPercentage
    if (body.userRoles !== undefined) updates.userRoles = body.userRoles
    if (body.description !== undefined) updates.description = body.description
    if (body.environment !== undefined) updates.environment = body.environment
    if (body.userOverrides !== undefined) updates.userOverrides = body.userOverrides

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = await featureFlagRepository.updateFlag(flag, updates)

    return NextResponse.json({ success: true, flag: updated })
  } catch (error) {
    console.error('Error updating feature flag:', error)
    return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/feature-flags/[flag]
 * Delete a flag. Owner only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ flag: string }> }
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

    const { flag } = await params
    const existing = await featureFlagRepository.getByName(flag)
    if (!existing) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    await featureFlagRepository.deleteFlag(flag)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting feature flag:', error)
    return NextResponse.json({ error: 'Failed to delete feature flag' }, { status: 500 })
  }
}
