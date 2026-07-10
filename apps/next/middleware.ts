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

  // Assurance model (#80): a session is `authenticated`; a tokenized email link
  // (?token=) makes the visitor `recognized` — partially verified, allowed to
  // VIEW anything an email points them at (their preferences, "more details",
  // etc.). Only mutations / sensitive pages step up to `authenticated` (the
  // Verify flow), enforced at the route/data layer via getTrust().
  //
  // The edge can't reach DynamoDB to cryptographically verify the token, so this
  // treats *presence* as recognized for the VIEW gate only — the page/API
  // re-validates it before exposing any real data, so a bogus token gets past
  // this gate but sees nothing. The middleware is a UX gate, not the auth
  // boundary; getTrust() remains authoritative.
  const recognized = !!req.auth || !!req.nextUrl.searchParams.get('token')

  // Hub sign-in gate: echadhub.org has no public face yet, so require at least a
  // recognized visitor for content pages (Facebook-style). Auth flows (/auth/*)
  // and API routes (incl. NextAuth /api/auth) stay open; static assets are
  // excluded by the matcher. Tenant domains with a public face (tee-admin.com)
  // are unaffected.
  if (
    tenant?.id === 'echadhub' &&
    !recognized &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/api')
  ) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

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
