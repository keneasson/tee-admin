import { NextResponse } from 'next/server'
import { listNewsItems } from '@my/app/services/news-service'

/**
 * Public News API — returns active news items (expired items are filtered out).
 * In single-tenant deployments this returns all active news. Multi-tenant
 * resolution via news-sharing-resolver is wired into the data layer for
 * future MULTI_TENANT_INIT use.
 */
export async function GET() {
  try {
    const items = await listNewsItems({ includeExpired: false })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Error listing news (public):', error)
    return NextResponse.json({ error: 'Failed to list news' }, { status: 500 })
  }
}
