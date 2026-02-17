import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { relationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
import { personRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import type { RelationshipType } from '@my/app/provider/dynamodb/types'

const validRelationshipTypes: RelationshipType[] = [
  'spouse',
  'parent',
  'child',
  'sibling',
  'grandparent',
  'grandchild',
  'extended_family',
  'household_member',
]

/**
 * GET /api/user/relationships - Get all family relationships for current user
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const familyMembers = await relationshipRepository.getFamilyMembers(session.user.email)

    // Look up names for each family member
    const relationshipsWithNames = await Promise.all(
      familyMembers.map(async (rel) => {
        let name: string | undefined
        try {
          const person = await personRepository.getByEmail(rel.targetEmail)
          if (person) {
            name = person.displayName || `${person.firstName || ''} ${person.lastName || ''}`.trim()
          }
        } catch {
          // If lookup fails, just use email
        }
        return {
          email: rel.targetEmail,
          name,
          relationshipType: rel.relationshipType,
          status: rel.status,
          createdAt: rel.createdAt,
        }
      })
    )

    return NextResponse.json({
      success: true,
      relationships: relationshipsWithNames,
    })
  } catch (error) {
    console.error('Get relationships error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/relationships - Create a new family relationship
 *
 * Accepts either:
 * - { targetEmail, relationshipType } - Link to existing person by email
 * - { firstName, lastName, email?, relationshipType } - Create new person if needed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, email, targetEmail, relationshipType } = body

    // Validate relationship type
    if (!relationshipType || !validRelationshipTypes.includes(relationshipType)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Must be one of: ${validRelationshipTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Determine the target email - either provided directly or we need to find/create person
    let familyMemberEmail: string

    if (targetEmail) {
      // Legacy path: direct email provided
      familyMemberEmail = targetEmail
    } else if (firstName) {
      // New path: name provided, find or create person
      if (email) {
        // Check if person exists with this email
        const existingPerson = await personRepository.getByEmail(email)
        if (existingPerson) {
          familyMemberEmail = email
        } else {
          // Create new person with email
          const userPerson = await personRepository.getByEmail(session.user.email)
          const newPerson = await personRepository.create({
            email,
            firstName,
            lastName: lastName || '',
            ecclesia: userPerson?.ecclesia || 'Toronto East',
            memberStatus: getMemberStatusFromRelationship(relationshipType),
          })
          familyMemberEmail = email
        }
      } else {
        // No email - create person without email (use generated placeholder)
        const userPerson = await personRepository.getByEmail(session.user.email)
        const placeholderEmail = `pending-${Date.now()}-${Math.random().toString(36).substring(2, 7)}@family.local`

        await personRepository.create({
          email: placeholderEmail,
          firstName,
          lastName: lastName || '',
          ecclesia: userPerson?.ecclesia || 'Toronto East',
          memberStatus: getMemberStatusFromRelationship(relationshipType),
        })
        familyMemberEmail = placeholderEmail
      }
    } else {
      return NextResponse.json(
        { error: 'Missing required fields: provide either targetEmail or firstName' },
        { status: 400 }
      )
    }

    // Can't create relationship with yourself
    if (familyMemberEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot create relationship with yourself' },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const exists = await relationshipRepository.hasRelationship(
      session.user.email,
      familyMemberEmail,
      relationshipType
    )

    if (exists) {
      return NextResponse.json(
        { error: 'Relationship already exists' },
        { status: 409 }
      )
    }

    // Create bidirectional relationship
    await relationshipRepository.createRelationship(
      session.user.email,
      familyMemberEmail,
      relationshipType
    )

    return NextResponse.json({
      success: true,
      message: 'Relationship created successfully',
    })
  } catch (error) {
    console.error('Create relationship error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Derive member status from relationship type
 */
function getMemberStatusFromRelationship(type: RelationshipType): 'member' | 'visitor' | 'friend' | 'former' {
  switch (type) {
    case 'child':
    case 'grandchild':
      return 'member' // Children are members of the ecclesia
    default:
      return 'member'
  }
}

/**
 * DELETE /api/user/relationships - Remove a family relationship
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const targetEmail = searchParams.get('targetEmail')
    const relationshipType = searchParams.get('relationshipType') as RelationshipType

    if (!targetEmail || !relationshipType) {
      return NextResponse.json(
        { error: 'Missing required parameters: targetEmail, relationshipType' },
        { status: 400 }
      )
    }

    // Validate relationship type
    if (!validRelationshipTypes.includes(relationshipType)) {
      return NextResponse.json(
        { error: `Invalid relationship type. Must be one of: ${validRelationshipTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if relationship exists
    const exists = await relationshipRepository.hasRelationship(
      session.user.email,
      targetEmail,
      relationshipType
    )

    if (!exists) {
      return NextResponse.json(
        { error: 'Relationship not found' },
        { status: 404 }
      )
    }

    // Soft delete (marks as removed)
    await relationshipRepository.removeRelationship(
      session.user.email,
      targetEmail,
      relationshipType
    )

    return NextResponse.json({
      success: true,
      message: 'Relationship removed successfully',
    })
  } catch (error) {
    console.error('Delete relationship error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
