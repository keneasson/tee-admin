import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * GET /api/user/lookup?email=xxx - Look up a person by email
 * Returns { found: true, firstName, lastName } or { found: false }
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Require at least member role
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json(
        { error: 'Member access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email parameter' },
        { status: 400 }
      )
    }

    const person = await personRepository.getByEmail(email.toLowerCase())

    if (person) {
      return NextResponse.json({
        found: true,
        firstName: person.firstName,
        lastName: person.lastName,
        displayName: person.displayName,
      })
    }

    return NextResponse.json({ found: false })
  } catch (error) {
    console.error('Lookup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
