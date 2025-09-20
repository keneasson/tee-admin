import { NextRequest, NextResponse } from 'next/server'

/**
 * Events API - DEPRECATED
 * This endpoint is being phased out in favor of proper separation:
 * - Public events: /api/events/public
 * - Admin events: /api/admin/events
 *
 * This route now redirects to the appropriate endpoint.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const publicOnly = url.searchParams.get('public') === 'true'

  if (publicOnly) {
    // Redirect to public endpoint
    const publicUrl = new URL('/api/events/public', url.origin)
    url.searchParams.delete('public')
    publicUrl.search = url.searchParams.toString()
    return NextResponse.redirect(publicUrl)
  } else {
    // Redirect to admin endpoint
    const adminUrl = new URL('/api/admin/events', url.origin)
    adminUrl.search = url.searchParams.toString()
    return NextResponse.redirect(adminUrl)
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url)
  const adminUrl = new URL('/api/admin/events', url.origin)
  return NextResponse.redirect(adminUrl, { status: 308 })
}

export async function PUT(request: NextRequest) {
  const url = new URL(request.url)
  const adminUrl = new URL('/api/admin/events', url.origin)
  return NextResponse.redirect(adminUrl, { status: 308 })
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const adminUrl = new URL('/api/admin/events', url.origin)
  adminUrl.search = url.searchParams.toString()
  return NextResponse.redirect(adminUrl, { status: 308 })
}