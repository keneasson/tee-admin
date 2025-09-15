/**
 * Pure utility functions for location data transformations
 * No side effects, no dependencies on React or form libraries
 */

export interface LocationData {
  name?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  parking?: string
  directions?: string
}

export interface EcclesiaData {
  name?: string
  address?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  parking?: string
  directions?: string
  hall?: {
    parking?: string
    directions?: string
  }
}

/**
 * Transform ecclesia data into location format
 * Pure function - no side effects
 */
export const formatEcclesiaToLocation = (ecclesia: EcclesiaData | null): LocationData => {
  if (!ecclesia) {
    return {}
  }

  return {
    name: ecclesia.name ? `${ecclesia.name} Hall` : '',
    address: ecclesia.address || '',
    city: ecclesia.city || '',
    province: ecclesia.province || '',
    postalCode: ecclesia.postalCode || '',
    country: ecclesia.country || 'Canada',
    parking: ecclesia.hall?.parking || ecclesia.parking || '',
    directions: ecclesia.hall?.directions || ecclesia.directions || ''
  }
}

/**
 * Check if location data is empty
 * Pure function for validation
 */
export const isLocationEmpty = (location: LocationData): boolean => {
  return !location.name && 
         !location.address && 
         !location.city && 
         !location.province && 
         !location.postalCode
}

/**
 * Format location for display
 * Pure function for presentation
 */
export const formatLocationDisplay = (location: LocationData): string => {
  const parts: string[] = []
  
  if (location.name) parts.push(location.name)
  if (location.address) parts.push(location.address)
  if (location.city || location.province) {
    const cityProvince = [location.city, location.province].filter(Boolean).join(', ')
    if (cityProvince) parts.push(cityProvince)
  }
  if (location.postalCode) parts.push(location.postalCode)
  if (location.country && location.country !== 'Canada') parts.push(location.country)
  
  return parts.join(', ')
}

/**
 * Create field updates for react-hook-form
 * Pure function that returns update instructions
 */
export const createLocationFieldUpdates = (
  location: LocationData, 
  namePrefix: string
): Array<{ field: string; value: any }> => {
  return [
    { field: `${namePrefix}.name`, value: location.name || '' },
    { field: `${namePrefix}.address`, value: location.address || '' },
    { field: `${namePrefix}.city`, value: location.city || '' },
    { field: `${namePrefix}.province`, value: location.province || '' },
    { field: `${namePrefix}.postalCode`, value: location.postalCode || '' },
    { field: `${namePrefix}.country`, value: location.country || 'Canada' },
    { field: `${namePrefix}.parking`, value: location.parking || '' },
    { field: `${namePrefix}.directions`, value: location.directions || '' }
  ]
}