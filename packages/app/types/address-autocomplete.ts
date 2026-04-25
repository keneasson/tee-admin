export interface PlacePrediction {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

export interface ParsedAddress {
  streetAddress: string
  city: string
  province: string
  postalCode: string
  country: string // App codes: CA, US, UK, AU, NZ, ZA
  formattedAddress: string
  name?: string
  lat?: number
  lng?: number
  placeId?: string // Google Places ID
}

/** Generate a Google Maps directions URL from address data */
export function buildMapsUrl(address: {
  lat?: number
  lng?: number
  formattedAddress?: string
  streetAddress?: string
  city?: string
  province?: string
  postalCode?: string
}): string {
  const base = 'https://www.google.com/maps/search/?api=1&query='
  if (address.lat && address.lng) {
    return `${base}${address.lat},${address.lng}`
  }
  const parts = [
    address.streetAddress || address.formattedAddress,
    address.city,
    address.province,
    address.postalCode,
  ].filter(Boolean).join(', ')
  return `${base}${encodeURIComponent(parts)}`
}
