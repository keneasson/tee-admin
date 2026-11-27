import { NextResponse } from 'next/server'
import { testSigninOptions } from '@/utils/test-signin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/test-signin-options (#349): does this deployment offer test
 * sign-in, and as which test people? Names and labels only. The key is never
 * sent to the client. On production this always answers `{ enabled: false }`.
 */
export async function GET() {
  return NextResponse.json(testSigninOptions(), { headers: { 'Cache-Control': 'no-store' } })
}
