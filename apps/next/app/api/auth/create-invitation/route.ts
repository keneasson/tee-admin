import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { createInvitationCode } from '../../../../utils/dynamodb/credentials-users'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userRole = session.user.role

    // Only members and admins can create invitation codes
    if (userRole !== ROLES.MEMBER && userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { firstName, lastName, ecclesia, role } = body

    // Validate required fields
    if (!firstName || !lastName || !ecclesia || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate role - only allow guest or member roles to be assigned
    if (role !== ROLES.GUEST && role !== ROLES.MEMBER) {
      return NextResponse.json(
        { error: 'Invalid role. Only guest and member roles can be assigned.' },
        { status: 400 }
      )
    }

    // Create the invitation code
    const code = await createInvitationCode({
      firstName,
      lastName,
      ecclesia,
      role,
      createdBy: session.user.id || session.user.email || 'unknown',
    })

    return NextResponse.json({
      success: true,
      code,
      message: 'Invitation code created successfully',
      invitation: {
        firstName,
        lastName,
        ecclesia,
        role,
        expiresIn: '7 days',
      },
    })
  } catch (error) {
    console.error('Create invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
