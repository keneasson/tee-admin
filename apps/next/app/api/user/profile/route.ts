import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const person = await personRepository.getByEmail(session.user.email)

    if (!person) {
      return NextResponse.json({
        success: true,
        user: {
          email: session.user.email,
          name: session.user.name,
          role: (session.user as any).role || 'guest',
        }
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: person.personId,
        email: person.primaryEmail,
        name: person.displayName,
        role: person.role || 'guest',
        ecclesia: person.ecclesia,
      }
    })
  } catch (error) {
    console.error('Get user profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ecclesia } = body

    if (!ecclesia || typeof ecclesia !== 'string' || ecclesia.trim().length === 0) {
      return NextResponse.json(
        { error: 'Ecclesia name is required' },
        { status: 400 }
      )
    }

    // Update PersonRecord ecclesia
    const person = await personRepository.getByEmail(session.user.email)
    if (!person) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    await personRepository.updatePerson(person.personId, {
      ecclesia: ecclesia.trim(),
    })

    return NextResponse.json({
      success: true,
      ecclesia: ecclesia.trim(),
    })
  } catch (error) {
    console.error('Update user profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
