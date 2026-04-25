import { NextRequest, NextResponse } from 'next/server'

/**
 * Verification endpoint for testing EventBridge authentication
 *
 * This endpoint verifies that:
 * 1. The EMAIL_SENDER_SECRET environment variable is set correctly
 * 2. EventBridge can authenticate with the API
 * 3. Headers are being passed correctly
 *
 * Usage:
 *   curl -H "Authorization: Bearer YOUR_EMAIL_SENDER_SECRET" \
 *     https://your-domain.vercel.app/api/cron/verify
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  // Check if authorization header is present
  if (!authHeader) {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing authorization header',
        hint: 'Include: Authorization: Bearer YOUR_EMAIL_SENDER_SECRET',
      },
      { status: 401 }
    )
  }

  // Check if EMAIL_SENDER_SECRET is configured
  if (!process.env.EMAIL_SENDER_SECRET) {
    return NextResponse.json(
      {
        success: false,
        message: 'EMAIL_SENDER_SECRET not configured on server',
        hint: 'Set EMAIL_SENDER_SECRET environment variable in Vercel',
      },
      { status: 500 }
    )
  }

  // Verify the secret matches
  const expectedAuth = `Bearer ${process.env.EMAIL_SENDER_SECRET}`
  if (authHeader !== expectedAuth) {
    return NextResponse.json(
      {
        success: false,
        message: 'Invalid authorization token',
        hint: 'Verify EMAIL_SENDER_SECRET matches in both Vercel and EventBridge configuration',
        debug: {
          received: authHeader,
          expected: expectedAuth,
          match: authHeader === expectedAuth,
          receivedLength: authHeader.length,
          expectedLength: expectedAuth.length,
        },
      },
      { status: 401 }
    )
  }

  // Success! Authentication is working
  return NextResponse.json({
    success: true,
    message: 'Authentication successful',
    timestamp: new Date().toISOString(),
    info: {
      ready: true,
      endpoint: '/api/cron/email-queue',
      documentation: '/AWS_EVENTBRIDGE_SETUP.md',
    },
  })
}

// Support POST for testing from EventBridge
export async function POST(req: NextRequest) {
  return GET(req)
}
