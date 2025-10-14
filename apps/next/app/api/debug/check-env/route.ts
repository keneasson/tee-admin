import { NextResponse } from 'next/server'

/**
 * DEBUG ONLY - Check what EMAIL_SENDER_SECRET is set to
 * REMOVE THIS AFTER DEBUGGING
 */
export async function GET() {
  const secret = process.env.EMAIL_SENDER_SECRET

  return NextResponse.json({
    has_secret: !!secret,
    secret_length: secret?.length || 0,
    secret_first_chars: secret?.substring(0, 4) || 'NOT_SET',
    secret_last_chars: secret?.substring(secret.length - 4) || 'NOT_SET',
    expected_auth: `Bearer ${secret}`,
  })
}
