import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { personForSessionEmail } from '@/utils/session-person'
import { hasSpeakerFacts, parseSpeakerFactsEdit } from '@my/app/utils/speaker-eligibility'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Try primary email first, then fall back to secondary email lookup
    let person = await personForSessionEmail(session.user.email)
    if (!person) {
      const persons = await personRepository.getAllPersonsByEmail(session.user.email)
      person = persons[0] || null
    }

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
        firstName: person.firstName,
        lastName: person.lastName,
        role: person.role || 'guest',
        ecclesia: person.ecclesia,
        // Recorded facts (§9b); null = not set.
        gender: person.gender ?? null,
        baptized: person.baptized ?? null,
        baptismDate: person.baptismDate ?? null,
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
    const { ecclesia, firstName, lastName } = body

    // Build updates object from provided fields
    const updates: Record<string, string> = {}

    if (ecclesia !== undefined) {
      if (typeof ecclesia !== 'string' || ecclesia.trim().length === 0) {
        return NextResponse.json(
          { error: 'Ecclesia name is required' },
          { status: 400 }
        )
      }
      updates.ecclesia = ecclesia.trim()
    }

    if (firstName !== undefined) {
      if (typeof firstName !== 'string' || firstName.trim().length === 0) {
        return NextResponse.json(
          { error: 'First name cannot be empty' },
          { status: 400 }
        )
      }
      if (firstName.trim().length > 50) {
        return NextResponse.json(
          { error: 'First name is too long (max 50 characters)' },
          { status: 400 }
        )
      }
      updates.firstName = firstName.trim()
    }

    if (lastName !== undefined) {
      if (typeof lastName !== 'string' || lastName.trim().length === 0) {
        return NextResponse.json(
          { error: 'Last name cannot be empty' },
          { status: 400 }
        )
      }
      if (lastName.trim().length > 50) {
        return NextResponse.json(
          { error: 'Last name is too long (max 50 characters)' },
          { status: 400 }
        )
      }
      updates.lastName = lastName.trim()
    }

    // Recorded facts (§9b): gender / baptized / baptismDate, null = Not set.
    const parsedFacts = parseSpeakerFactsEdit(body)
    if (!parsedFacts.ok) return NextResponse.json({ error: parsedFacts.error }, { status: 400 })
    const facts = parsedFacts.facts

    if (Object.keys(updates).length === 0 && !hasSpeakerFacts(facts)) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Try primary email first, then fall back to secondary email lookup
    let person = await personForSessionEmail(session.user.email)
    if (!person) {
      const persons = await personRepository.getAllPersonsByEmail(session.user.email)
      person = persons[0] || null
    }

    if (!person) {
      return NextResponse.json(
        { error: 'User profile not found. Please contact an administrator.' },
        { status: 404 }
      )
    }

    if (hasSpeakerFacts(facts)) await personRepository.setSpeakerFacts(person.personId, facts, person.personId)
    const updated =
      Object.keys(updates).length > 0
        ? await personRepository.updatePerson(person.personId, updates)
        : ((await personRepository.getById(person.personId)) ?? person)

    return NextResponse.json({
      success: true,
      ecclesia: updated.ecclesia,
      firstName: updated.firstName,
      lastName: updated.lastName,
      displayName: updated.displayName,
      gender: updated.gender ?? null,
      baptized: updated.baptized ?? null,
      baptismDate: updated.baptismDate ?? null,
    })
  } catch (error) {
    console.error('Update user profile error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
