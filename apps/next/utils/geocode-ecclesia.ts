/**
 * Server-side geocoding for ecclesia records.
 * Called when an ecclesia's address or city changes.
 * Uses Google Places Text Search to geocode, stores lat/lng on the record.
 */

import { findNearbyEcclesias, MAX_SHARING_RADIUS_KM } from '@my/app/utils/geo'
import { getAllEcclesia, updateEcclesiaFields } from './dynamodb/locations'
import type { EcclesiaData } from './dynamodb/locations'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

interface GeocodeResult {
  latitude: number
  longitude: number
  locationSource: 'address' | 'city'
}

/**
 * Geocode an address or city using Google Geocoding API.
 * Tries address first, falls back to city + province + country.
 */
async function geocode(ecclesia: EcclesiaData): Promise<GeocodeResult | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('⚠️ GOOGLE_PLACES_API_KEY not set, skipping geocoding')
    return null
  }

  // Try full address first
  const addressParts = [ecclesia.address, ecclesia.city, ecclesia.province, ecclesia.country].filter(Boolean)
  const cityParts = [ecclesia.city, ecclesia.province, ecclesia.country].filter(Boolean)

  for (const { query, source } of [
    { query: addressParts.join(', '), source: 'address' as const },
    { query: cityParts.join(', '), source: 'city' as const },
  ]) {
    if (!query) continue

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`
      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location
        return { latitude: lat, longitude: lng, locationSource: source }
      }
    } catch (error) {
      console.warn(`⚠️ Geocoding failed for "${query}":`, error)
    }
  }

  return null
}

/**
 * Geocode an ecclesia and update its lat/lng in DynamoDB.
 * Also recomputes nearbyEcclesias for this ecclesia and all affected neighbours.
 *
 * Call this when:
 * - Ecclesia address, city, province, or country changes
 * - Ecclesia lat/lng is manually set
 * - A new ecclesia is created
 */
export async function geocodeAndUpdateEcclesia(ecclesia: EcclesiaData): Promise<void> {
  // Skip if coordinates already manually set
  if (ecclesia.locationSource === 'manual' && ecclesia.latitude && ecclesia.longitude) {
    console.log(`📍 ${ecclesia.name} has manual coordinates, skipping geocode`)
    await recomputeNearbyEcclesias(ecclesia)
    return
  }

  const result = await geocode(ecclesia)
  if (!result) {
    console.warn(`⚠️ Could not geocode ${ecclesia.name}`)
    return
  }

  console.log(`📍 Geocoded ${ecclesia.name}: ${result.latitude}, ${result.longitude} (from ${result.locationSource})`)

  // Update this ecclesia's coordinates
  await updateEcclesiaFields(ecclesia.name, {
    latitude: result.latitude,
    longitude: result.longitude,
    locationSource: result.locationSource,
  })

  // Recompute nearby lists
  await recomputeNearbyEcclesias({
    ...ecclesia,
    latitude: result.latitude,
    longitude: result.longitude,
  })
}

/**
 * Recompute nearbyEcclesias for a given ecclesia and update affected neighbours.
 * Only updates ecclesias whose nearby list actually changed.
 */
async function recomputeNearbyEcclesias(ecclesia: EcclesiaData): Promise<void> {
  if (!ecclesia.latitude || !ecclesia.longitude) return

  const allEcclesias = await getAllEcclesia()

  // Compute this ecclesia's nearby list at MAX radius (1000km).
  // Individual ecclesias filter down to their configured radius at query time.
  const nearbyNames = findNearbyEcclesias(
    { name: ecclesia.name, latitude: ecclesia.latitude, longitude: ecclesia.longitude, country: ecclesia.country },
    allEcclesias.map(e => ({ name: e.name, latitude: e.latitude, longitude: e.longitude, country: e.country })),
    MAX_SHARING_RADIUS_KM
  )

  // Update this ecclesia
  const currentNearby = ecclesia.nearbyEcclesias || []
  if (JSON.stringify(nearbyNames.sort()) !== JSON.stringify(currentNearby.sort())) {
    await updateEcclesiaFields(ecclesia.name, { nearbyEcclesias: nearbyNames })
    console.log(`📍 Updated nearby list for ${ecclesia.name}: ${nearbyNames.length} ecclesias`)
  }

  // Update neighbours that should now include/exclude this ecclesia
  for (const other of allEcclesias) {
    if (other.name === ecclesia.name) continue
    if (!other.latitude || !other.longitude) continue

    const otherNearby = findNearbyEcclesias(
      { name: other.name, latitude: other.latitude, longitude: other.longitude, country: other.country },
      [...allEcclesias.map(e => ({ name: e.name, latitude: e.latitude, longitude: e.longitude, country: e.country })),
       { name: ecclesia.name, latitude: ecclesia.latitude, longitude: ecclesia.longitude, country: ecclesia.country }],
      MAX_SHARING_RADIUS_KM
    )

    const otherCurrentNearby = other.nearbyEcclesias || []
    if (JSON.stringify(otherNearby.sort()) !== JSON.stringify(otherCurrentNearby.sort())) {
      await updateEcclesiaFields(other.name, { nearbyEcclesias: otherNearby })
      console.log(`📍 Updated nearby list for ${other.name}: ${otherNearby.length} ecclesias`)
    }
  }
}
