import { NextRequest, NextResponse } from 'next/server'
import { findCredentialsUserByEmail } from '../../../../utils/dynamodb/credentials-users'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email') || 'ken.easson@gmail.com'

    console.log('🔍 Debug DB test for email:', email)

    // Call the findCredentialsUserByEmail function directly
    const user = await findCredentialsUserByEmail(email)

    console.log('📊 findCredentialsUserByEmail result:', !!user)

    if (user) {
      console.log('✅ User found:', user.id)
      return NextResponse.json({
        success: true,
        found: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          provider: user.provider,
          emailVerified: user.emailVerified,
          hasPassword: !!user.hashedPassword,
        },
      })
    } else {
      console.log('❌ No user found')
      return NextResponse.json({
        success: true,
        found: false,
        message: 'No user found with this email',
      })
    }
  } catch (error) {
    console.error('💥 Error in debug DB test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
