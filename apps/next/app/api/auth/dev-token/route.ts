import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

const DEV_KEY = process.env.DEV_AUTH_SERVER_KEY

/**
 * POST /api/auth/dev-token - Exchange server key for a Bearer token
 *
 * Usage:
 *   curl -X POST http://localhost:4000/api/auth/dev-token \
 *     -H "Content-Type: application/json" \
 *     -d '{"key":"<DEV_AUTH_SERVER_KEY>","email":"ken.easson@gmail.com"}'
 *
 * Then use the token:
 *   curl -H "Authorization: Bearer <access_token>" http://localhost:4000/api/people
 */
export async function POST(request: NextRequest) {
  if (!DEV_KEY) {
    return NextResponse.json(
      { error: 'Dev auth not configured' },
      { status: 404 }
    )
  }

  try {
    const body = await request.json()
    const { key, email } = body

    if (!key || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: key, email' },
        { status: 400 }
      )
    }

    // Constant-time comparison to prevent timing attacks
    if (key.length !== DEV_KEY.length || !timingSafeEqual(key, DEV_KEY)) {
      return NextResponse.json(
        { error: 'Invalid key' },
        { status: 401 }
      )
    }

    // Look up person to populate the token with real data
    const person = await personRepository.getByEmail(email.toLowerCase().trim())
    if (!person) {
      return NextResponse.json(
        { error: `No PersonRecord found for ${email}` },
        { status: 404 }
      )
    }

    const secret = new TextEncoder().encode(DEV_KEY)
    const expiresIn = 3600 // 1 hour

    const token = await new SignJWT({
      email: person.primaryEmail,
      name: person.displayName,
      role: person.role || 'guest',
      personId: person.personId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${expiresIn}s`)
      .setSubject(person.personId)
      .sign(secret)

    return NextResponse.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresIn,
      email: person.primaryEmail,
      role: person.role || 'guest',
    })
  } catch (error) {
    console.error('Dev token error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/** Constant-time string comparison */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
