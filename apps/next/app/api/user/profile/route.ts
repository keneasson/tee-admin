import { NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { getUserFromDynamoDB } from '../../../../utils/dynamodb/get-user'

export async function GET() {
  try {
    // Check authentication
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user data from DynamoDB
    const user = await getUserFromDynamoDB(session.user.email)

    if (!user) {
      // Return basic session data if no extended profile exists
      return NextResponse.json({
        success: true,
        user: {
          email: session.user.email,
          name: session.user.name,
          role: session.user.role || 'guest',
        }
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        ecclesia: user.ecclesia,
        profile: user.profile,
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
