import { auth } from './utils/auth'
import { NextResponse } from 'next/server'
import type { NextAuthRequest } from 'next-auth/lib'
import { getTenantByHost } from '@my/app/config/tenants'

const ANALYTICS_KEY = process.env.ANALYTICS_INTERNAL_KEY

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl

  // Resolve tenant from Host header and forward as `x-tenant-id` so
  // downstream API routes don't need to redo the lookup. tee-admin.com
  // → 'tee', echadhub.org / .com → 'echadhub'. Unknown hosts get no
  // header set; consumers decide their own fallback strategy.
  const tenant = getTenantByHost(req.headers.get('host'))
  const forwardedHeaders = new Headers(req.headers)
  if (tenant) {
    forwardedHeaders.set('x-tenant-id', tenant.id)
  }
  const passthrough = () => NextResponse.next({ request: { headers: forwardedHeaders } })

  // Check if user is trying to access profile page
  if (pathname.startsWith('/profile')) {
    // If no session, redirect to sign-in
    // BUT check if this might be a post-authentication redirect
    const isFromAuth = req.headers.get('referer')?.includes('/auth/') ||
                       req.nextUrl.searchParams.has('callbackUrl')

    if (!req.auth) {
      if (isFromAuth) {
        // Allow the request through - the page itself will handle auth checking
        return passthrough()
      } else {
        return NextResponse.redirect(new URL('/auth/signin', req.url))
      }
    }
  }

  // Fire-and-forget analytics beacon for page views
  if (ANALYTICS_KEY && !pathname.startsWith('/api/') && !pathname.startsWith('/_next/')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'
    const referer = req.headers.get('referer') || null

    // Extract UTM params
    const utmSource = req.nextUrl.searchParams.get('utm_source') || undefined
    const utmMedium = req.nextUrl.searchParams.get('utm_medium') || undefined
    const utmCampaign = req.nextUrl.searchParams.get('utm_campaign') || undefined

    // Determine the base URL for the internal fetch
    const baseUrl = req.nextUrl.origin

    // Fire-and-forget: do NOT await this
    fetch(`${baseUrl}/api/analytics/collect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-analytics-key': ANALYTICS_KEY,
      },
      body: JSON.stringify({
        page: pathname,
        ip,
        userAgent,
        referer,
        utmSource,
        utmMedium,
        utmCampaign,
      }),
    }).catch(() => {
      // Silently ignore analytics failures
    })
  }

  return passthrough()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
