import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import {
  getAllOrganizations,
  createOrganization,
} from '@/utils/dynamodb/organizations'
import type { OrganizationType } from '@my/app/provider/dynamodb/types'

/**
 * GET /api/organizations - List all organizations
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

    const organizations = await getAllOrganizations()
    return NextResponse.json({ success: true, organizations })
  } catch (error) {
    console.error('Error listing organizations:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to list organizations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/organizations - Create a new organization
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
    const { name, type, description, country, province, city, contactEmail, website, memberEcclesias } = body

    if (!name || !country || !province || !city) {
      return NextResponse.json(
        { error: 'name, country, province, and city are required' },
        { status: 400 }
      )
    }

    const validTypes: OrganizationType[] = ['fraternal_gathering', 'bible_school', 'charity', 'youth_group', 'other']
    const orgType: OrganizationType = validTypes.includes(type) ? type : 'other'

    const organization = await createOrganization({
      name,
      type: orgType,
      description,
      country,
      province,
      city,
      contactEmail,
      website,
      memberEcclesias,
    })

    return NextResponse.json({ success: true, organization }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ConditionalCheckFailedException') {
      return NextResponse.json(
        { error: 'An organization with this name already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating organization:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create organization' },
      { status: 500 }
    )
  }
}
