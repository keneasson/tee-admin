import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { featureFlagRepository } from '@my/app/provider/dynamodb/repositories/feature-flag-repository'
import {
  DEFAULT_FEATURE_FLAG_CONFIGS,
  type FeatureFlagConfig,
} from '@my/app/features/feature-flags/feature-flags'

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
    // A flag can live only as a code default (the admin page lists it from
    // DEFAULT_FEATURE_FLAG_CONFIGS); its first save creates the row.
    const codeDefault = DEFAULT_FEATURE_FLAG_CONFIGS[flag]
    if (!existing && !codeDefault) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Partial<FeatureFlagConfig> = {}

    if (body.description !== undefined) updates.description = body.description
    if (body.visibleTo !== undefined) updates.visibleTo = body.visibleTo
    if (body.users !== undefined) updates.users = body.users

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updated = existing
      ? await featureFlagRepository.updateFlag(flag, updates)
      : await featureFlagRepository.createFlag(flag, { ...codeDefault, ...updates })

    return NextResponse.json({ success: true, flag: updated })
  } catch (error) {
    console.error('Error updating feature flag:', error)
    return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/feature-flags/[flag]
 * Delete a flag (feature has been released). Owner only.
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
