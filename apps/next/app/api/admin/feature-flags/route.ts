import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { featureFlagRepository } from '@my/app/provider/dynamodb/repositories/feature-flag-repository'
import { checkFeatureFlag } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import type { FeatureFlagConfig } from '@my/app/features/feature-flags/feature-flags'

/**
 * GET /api/admin/feature-flags
 * Returns all flags with configs and whether each is active for the current user.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const configs = await featureFlagRepository.getAllCached()

    const evaluated: Record<string, boolean> = {}
    for (const flagName of Object.keys(configs)) {
      evaluated[flagName] = checkFeatureFlag(flagName, session as any, configs)
    }

    return NextResponse.json({ success: true, flags: configs, evaluated })
  } catch (error) {
    console.error('Error fetching feature flags:', error)
    return NextResponse.json({ error: 'Failed to fetch feature flags' }, { status: 500 })
  }
}

/**
 * POST /api/admin/feature-flags
 * Create a new feature flag. Owner only.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role || ROLES.GUEST
    if (userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 })
    }

    const body = await request.json()
    const { flagName, config } = body as { flagName: string; config: FeatureFlagConfig }

    if (!flagName || !config) {
      return NextResponse.json({ error: `flagName and config are required. Got flagName=${flagName}, config=${JSON.stringify(config)}` }, { status: 400 })
    }

    if (!/^[a-z][a-z0-9_]*$/.test(flagName)) {
      return NextResponse.json(
        { error: 'Flag name must be lowercase alphanumeric with underscores, starting with a letter' },
        { status: 400 }
      )
    }

    const existing = await featureFlagRepository.getByName(flagName)
    if (existing) {
      return NextResponse.json({ error: `Flag "${flagName}" already exists` }, { status: 409 })
    }

    const record = await featureFlagRepository.createFlag(flagName, config)

    return NextResponse.json({ success: true, flag: record }, { status: 201 })
  } catch (error) {
    console.error('Error creating feature flag:', error)
    return NextResponse.json({ error: 'Failed to create feature flag' }, { status: 500 })
  }
}
