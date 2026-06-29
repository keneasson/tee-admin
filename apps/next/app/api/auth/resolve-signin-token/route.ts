import { NextRequest, NextResponse } from 'next/server'
import { verifyEcclesiaToken } from '@/utils/email/ecclesia-token'

/**
 * GET /api/auth/resolve-signin-token?token=… — resolve a one-click login token
 * to the email it was minted for. Used by /auth/signin-token to know who to
 * sign in (the actual sign-in goes through the NextAuth 'otp' provider, which
 * re-verifies the token, so this endpoint only needs to surface the email and
 * validity for the UI).
 */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Missing token' }, { status: 400 })
  }

  const result = await verifyEcclesiaToken(token)
  return NextResponse.json({
    valid: result.valid,
    expired: result.expired ?? false,
    email: result.email ?? null,
  })
}
