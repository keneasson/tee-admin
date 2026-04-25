/**
 * Geographic utilities for multi-tenant event sharing.
 * Pure math — no external API calls.
 */

const EARTH_RADIUS_KM = 6371

/**
 * Calculate distance between two points using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_KM * c
}

/** Default sharing radius in km */
export const DEFAULT_SHARING_RADIUS_KM = 300

/** Maximum radius for pre-computing nearby ecclesias lists */
export const MAX_SHARING_RADIUS_KM = 1000

/** Valid radius options for ecclesia configuration (100km steps + global) */
export const SHARING_RADIUS_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] as const

/**
 * Check if two locations are within a given radius AND in the same country.
 */
export function isWithinSharingRange(
  loc1: { latitude: number; longitude: number; country: string },
  loc2: { latitude: number; longitude: number; country: string },
  radiusKm: number = DEFAULT_SHARING_RADIUS_KM
): boolean {
  // Never cross international boundaries
  if (loc1.country !== loc2.country) return false

  const distance = haversineDistance(
    loc1.latitude, loc1.longitude,
    loc2.latitude, loc2.longitude
  )

  return distance <= radiusKm
}

/**
 * Find all nearby ecclesias from a list, within radius and same country.
 * Returns names of nearby ecclesias (excluding self).
 */
export function findNearbyEcclesias(
  target: { name: string; latitude: number; longitude: number; country: string },
  allEcclesias: Array<{ name: string; latitude?: number; longitude?: number; country: string }>,
  radiusKm: number = DEFAULT_SHARING_RADIUS_KM
): string[] {
  return allEcclesias
    .filter(e => {
      if (e.name === target.name) return false
      if (!e.latitude || !e.longitude) return false
      return isWithinSharingRange(
        { latitude: target.latitude, longitude: target.longitude, country: target.country },
        { latitude: e.latitude, longitude: e.longitude, country: e.country },
        radiusKm
      )
    })
    .map(e => e.name)
}
