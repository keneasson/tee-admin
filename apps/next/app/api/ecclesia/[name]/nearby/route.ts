import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { getEcclesiaByName } from '@/utils/dynamodb/locations'
import { checkFeatureFlagFromDB } from '@my/app/features/feature-flags/use-feature-flag-wrapper'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { haversineDistance, DEFAULT_SHARING_RADIUS_KM } from '@my/app/utils/geo'

/**
 * GET /api/ecclesia/[name]/nearby
 *
 * Returns the list of ecclesias within the target ecclesia's sharing radius.
 * Nearby candidates are pre-computed (up to 1000km) in `EcclesiaData.nearbyEcclesias`;
 * this endpoint fetches each candidate's basic info, computes distance via the
 * Haversine formula, filters to `sharingRadiusKm` (default 300km), and returns
 * the list sorted by distance ascending.
 *
 * Gated behind the MULTI_TENANT_INIT feature flag — returns 404 when off.
 */

type NearbyEcclesia = {
  name: string
  displayName?: string
  distanceKm?: number
  country?: string
  province?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    // Session is optional (public directory data), but used for feature flag eval
    const session = await auth().catch(() => null)

    const flagEnabled = await checkFeatureFlagFromDB(
      FEATURE_FLAGS.MULTI_TENANT_INIT,
      session as any
    )
    if (!flagEnabled) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { name } = await params
    const ecclesiaName = decodeURIComponent(name)

    const target = await getEcclesiaByName(ecclesiaName)
    if (!target) {
      return NextResponse.json({ error: 'Ecclesia not found' }, { status: 404 })
    }

    const candidateNames = target.nearbyEcclesias || []
    if (candidateNames.length === 0) {
      return NextResponse.json({ nearbyEcclesias: [] as NearbyEcclesia[] })
    }

    const radiusKm = target.sharingRadiusKm ?? DEFAULT_SHARING_RADIUS_KM

    // Fetch each candidate in parallel (GSI1 lookups are O(1) each)
    const candidates = await Promise.all(
      candidateNames.map((n) => getEcclesiaByName(n).catch(() => null))
    )

    const results: NearbyEcclesia[] = []
    for (const c of candidates) {
      if (!c) continue
      if (c.name === target.name) continue

      let distanceKm: number | undefined = undefined
      if (
        typeof target.latitude === 'number' &&
        typeof target.longitude === 'number' &&
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number'
      ) {
        distanceKm = haversineDistance(
          target.latitude,
          target.longitude,
          c.latitude,
          c.longitude
        )
      }

      // Filter by radius when distance is known. If distance unknown, include
      // the ecclesia only if it's already on the pre-computed nearby list
      // (it is, by construction) — we let it through with no distance.
      if (typeof distanceKm === 'number' && distanceKm > radiusKm) {
        continue
      }

      results.push({
        name: c.name,
        displayName: c.name,
        distanceKm,
        country: c.country,
        province: c.province,
      })
    }

    // Sort by distance ascending; unknown distances last, alphabetical tiebreak
    results.sort((a, b) => {
      const aHas = typeof a.distanceKm === 'number'
      const bHas = typeof b.distanceKm === 'number'
      if (aHas && bHas) {
        const diff = (a.distanceKm as number) - (b.distanceKm as number)
        if (diff !== 0) return diff
      } else if (aHas && !bHas) {
        return -1
      } else if (!aHas && bHas) {
        return 1
      }
      return (a.displayName || a.name).localeCompare(b.displayName || b.name)
    })

    return NextResponse.json({ nearbyEcclesias: results })
  } catch (error) {
    console.error('Error fetching nearby ecclesias:', error)
    return NextResponse.json(
      { error: 'Failed to fetch nearby ecclesias' },
      { status: 500 }
    )
  }
}
