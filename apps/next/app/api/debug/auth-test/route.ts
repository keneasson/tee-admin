import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentialsUser } from '../../../../utils/dynamodb/credentials-users'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    console.log('🧪 Debug auth test for:', email)

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing email or password',
        },
        { status: 400 }
      )
    }

    // Call the exact same function as NextAuth
    const user = await verifyCredentialsUser(email, password)

    if (user) {
      console.log('✅ Debug auth test successful for:', email)
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          provider: user.provider,
          emailVerified: user.emailVerified,
        },
      })
    } else {
      console.log('❌ Debug auth test failed for:', email)
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication failed',
        },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('💥 Error in debug auth test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
