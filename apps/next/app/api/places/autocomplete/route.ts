import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function POST(request: NextRequest) {
  try {
    const { input, sessionToken, country } = await request.json()

    if (!input || typeof input !== 'string' || input.length < 3) {
      return NextResponse.json({ success: true, predictions: [] })
    }

    if (!GOOGLE_PLACES_API_KEY) {
      console.warn('GOOGLE_PLACES_API_KEY not configured - returning empty predictions')
      return NextResponse.json({ success: true, predictions: [] })
    }

    // Map app country codes to Google's ISO codes
    const COUNTRY_TO_GOOGLE: Record<string, string> = {
      CA: 'ca',
      US: 'us',
      UK: 'gb',
      AU: 'au',
      NZ: 'nz',
      ZA: 'za',
    }

    const params = new URLSearchParams({
      input,
      key: GOOGLE_PLACES_API_KEY,
    })

    // Restrict to single country if provided, otherwise no restriction
    const googleCountry = country ? COUNTRY_TO_GOOGLE[country] || country.toLowerCase() : null
    if (googleCountry) {
      params.set('components', `country:${googleCountry}`)
    }

    if (sessionToken) {
      params.set('sessiontoken', sessionToken)
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`
    )

    if (!response.ok) {
      console.error('Google Places API error:', response.status, response.statusText)
      return NextResponse.json({ success: true, predictions: [] })
    }

    const data = await response.json()

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API status:', data.status, data.error_message)
      return NextResponse.json({ success: true, predictions: [] })
    }

    const predictions = (data.predictions || []).map(
      (p: {
        place_id: string
        description: string
        structured_formatting: {
          main_text: string
          secondary_text: string
        }
      }) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text,
      })
    )

    return NextResponse.json({ success: true, predictions })
  } catch (error) {
    console.error('Places autocomplete error:', error)
    return NextResponse.json({ success: true, predictions: [] })
  }
}
