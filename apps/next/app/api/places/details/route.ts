import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import type { ParsedAddress } from '@my/app/types/address-autocomplete'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

// Map Google country codes to app codes
const COUNTRY_CODE_MAP: Record<string, string> = {
  CA: 'CA',
  US: 'US',
  GB: 'UK',
  AU: 'AU',
  NZ: 'NZ',
  ZA: 'ZA',
}

interface AddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

function parseAddressComponents(components: AddressComponent[]): ParsedAddress {
  let streetNumber = ''
  let route = ''
  let city = ''
  let province = ''
  let postalCode = ''
  let countryCode = ''

  for (const component of components) {
    const types = component.types
    if (types.includes('street_number')) {
      streetNumber = component.long_name
    } else if (types.includes('route')) {
      route = component.long_name
    } else if (types.includes('locality')) {
      city = component.long_name
    } else if (types.includes('sublocality_level_1') && !city) {
      city = component.long_name
    } else if (types.includes('administrative_area_level_1')) {
      province = component.short_name
    } else if (types.includes('postal_code')) {
      postalCode = component.long_name
    } else if (types.includes('country')) {
      countryCode = component.short_name
    }
  }

  const streetAddress = [streetNumber, route].filter(Boolean).join(' ')
  const country = COUNTRY_CODE_MAP[countryCode] || countryCode

  return {
    streetAddress,
    city,
    province,
    postalCode,
    country,
    formattedAddress: '',
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json({ success: false, error: 'Member access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const placeId = searchParams.get('placeId')
    const sessionToken = searchParams.get('sessionToken')

    if (!placeId) {
      return NextResponse.json(
        { success: false, error: 'placeId is required' },
        { status: 400 }
      )
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Places API not configured' },
        { status: 503 }
      )
    }

    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'address_components,formatted_address,geometry,name',
      key: GOOGLE_PLACES_API_KEY,
    })

    if (sessionToken) {
      params.set('sessiontoken', sessionToken)
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`
    )

    if (!response.ok) {
      console.error('Google Places Details API error:', response.status)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch place details' },
        { status: 502 }
      )
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('Google Places Details status:', data.status, data.error_message)
      return NextResponse.json(
        { success: false, error: `Places API error: ${data.status}` },
        { status: 502 }
      )
    }

    const result = data.result
    const parsed = parseAddressComponents(result.address_components || [])
    parsed.formattedAddress = result.formatted_address || ''
    parsed.name = result.name
    parsed.placeId = placeId

    if (result.geometry?.location) {
      parsed.lat = result.geometry.location.lat
      parsed.lng = result.geometry.location.lng
    }

    return NextResponse.json({ success: true, address: parsed })
  } catch (error) {
    console.error('Places details error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
