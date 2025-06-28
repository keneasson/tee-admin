import { NextRequest, NextResponse } from 'next/server'
import { validateInvitationCode } from '../../../../utils/dynamodb/credentials-users'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Invitation code is required' },
        { status: 400 }
      )
    }

    const invitation = await validateInvitationCode(code)
    
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation code' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      invitation: {
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        ecclesia: invitation.ecclesia,
        role: invitation.role,
      },
    })

  } catch (error) {
    console.error('Code validation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}