import { auth } from './utils/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  // Check if user is trying to access profile page
  if (req.nextUrl.pathname.startsWith('/profile')) {
    // If no session, redirect to sign-in
    // BUT check if this might be a post-authentication redirect
    const isFromAuth =
      req.headers.get('referer')?.includes('/auth/') || req.nextUrl.searchParams.has('callbackUrl')

    if (!req.auth) {
      if (isFromAuth) {
        // Allow the request through - the page itself will handle auth checking
        return NextResponse.next()
      } else {
        return NextResponse.redirect(new URL('/auth/signin', req.url))
      }
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/profile/:path*'],
}
