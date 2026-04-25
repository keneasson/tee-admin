import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { isValidRegion } from '@my/app/config/regions'

/**
 * PATCH /api/admin/people/[personId]/managed-regions
 *
 * Assigns the set of regions that a person (with admin role) oversees.
 * Owner-only. Feature-flag gated on MULTI_TENANT_INIT — returns 404 when off.
 *
 * Body: { managedRegions: string[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ personId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Feature flag gate — return 404 when the feature is disabled so the
    // endpoint appears not to exist for non-owners and non-flagged sessions.
    const flagEnabled = await checkFeatureFlagFromDB(
      FEATURE_FLAGS.MULTI_TENANT_INIT,
      session as any
    )
    if (!flagEnabled) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Resolve the caller's role from their PersonRecord (authoritative source).
    const callerEmail = session.user.email.toLowerCase()
    const callerPerson = await personRepository.getByEmail(callerEmail)
    const callerRole = callerPerson?.role || (session.user as any).role || ROLES.GUEST

    if (callerRole !== ROLES.OWNER) {
      return NextResponse.json(
        { error: 'Only owners can assign managed regions' },
        { status: 403 }
      )
    }

    const { personId } = await params
    if (!personId) {
      return NextResponse.json({ error: 'Missing personId' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { managedRegions } = body as { managedRegions?: unknown }

    if (!Array.isArray(managedRegions)) {
      return NextResponse.json(
        { error: 'managedRegions must be an array of region ids' },
        { status: 400 }
      )
    }

    // Normalise + validate
    const normalised: string[] = []
    for (const raw of managedRegions) {
      if (typeof raw !== 'string') {
        return NextResponse.json(
          { error: 'managedRegions must contain only string values' },
          { status: 400 }
        )
      }
      const trimmed = raw.trim()
      if (!trimmed) continue
      if (!isValidRegion(trimmed)) {
        return NextResponse.json(
          { error: `Unknown region id: ${trimmed}` },
          { status: 400 }
        )
      }
      if (!normalised.includes(trimmed)) {
        normalised.push(trimmed)
      }
    }

    // Ensure the target person exists
    const target = await personRepository.getById(personId)
    if (!target) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 })
    }

    // Persist
    await personRepository.updatePerson(personId, {
      managedRegions: normalised,
    })

    return NextResponse.json({
      success: true,
      managedRegions: normalised,
    })
  } catch (error) {
    console.error('Error updating managed regions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update managed regions' },
      { status: 500 }
    )
  }
}
