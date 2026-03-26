import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import {
  getOrganizationByName,
  updateOrganizationFields,
  deleteOrganization,
} from '@/utils/dynamodb/organizations'

/**
 * GET /api/organizations/[name] - Fetch a single organization
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

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole === ROLES.GUEST || userRole === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const { name } = await params
    const orgName = decodeURIComponent(name)
    const organization = await getOrganizationByName(orgName)

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, organization })
  } catch (error) {
    console.error('Error fetching organization:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/organizations/[name] - Update organization fields
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

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const { name } = await params
    const orgName = decodeURIComponent(name)
    const body = await request.json()

    // Remove immutable fields
    const { name: _, country: __, province: ___, city: ____, createdAt: _____, ...updateFields } = body

    const updated = await updateOrganizationFields(orgName, updateFields)
    if (!updated) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const organization = await getOrganizationByName(orgName)
    return NextResponse.json({ success: true, organization })
  } catch (error) {
    console.error('Error updating organization:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update organization' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/organizations/[name] - Delete an organization
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

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
    }

    const showMultiTenant = await checkFeatureFlagFromDB(FEATURE_FLAGS.MULTI_TENANT_INIT, session as any)
    if (!showMultiTenant) {
      return NextResponse.json({ error: 'Feature not available' }, { status: 403 })
    }

    const { name } = await params
    const orgName = decodeURIComponent(name)

    const deleted = await deleteOrganization(orgName)
    if (!deleted) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting organization:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete organization' },
      { status: 500 }
    )
  }
}
