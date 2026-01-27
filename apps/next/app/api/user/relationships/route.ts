import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { relationshipRepository } from '@my/app/provider/dynamodb/repositories/relationship-repository'
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

    return NextResponse.json({
      success: true,
      relationships: familyMembers.map(rel => ({
        targetEmail: rel.targetEmail,
        relationshipType: rel.relationshipType,
        status: rel.status,
        createdAt: rel.createdAt,
      })),
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
    const { targetEmail, relationshipType } = body

    // Validate required fields
    if (!targetEmail || !relationshipType) {
      return NextResponse.json(
        { error: 'Missing required fields: targetEmail, relationshipType' },
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

    // Can't create relationship with yourself
    if (targetEmail === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot create relationship with yourself' },
        { status: 400 }
      )
    }

    // Check if relationship already exists
    const exists = await relationshipRepository.hasRelationship(
      session.user.email,
      targetEmail,
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
      targetEmail,
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
