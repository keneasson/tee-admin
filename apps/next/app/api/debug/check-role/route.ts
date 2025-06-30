import { NextRequest, NextResponse } from 'next/server'
import { getUserFromLegacyDirectory, getRoleFromLegacyUser } from '@my/app/provider/auth/get-user-from-legacy'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  
  if (!email) {
    return NextResponse.json({ 
      error: 'Email parameter required',
      usage: 'Add ?email=your@email.com to check role assignment'
    }, { status: 400 })
  }

  try {
    console.log('🔍 Debug: Checking role for email:', email)
    
    // Step 1: Look up user in directory
    const legacyUser = await getUserFromLegacyDirectory({ email })
    if (!legacyUser) {
      return NextResponse.json({
        success: false,
        email,
        found: false,
        message: 'User not found in directory',
        role: 'guest'
      })
    }

    // Step 2: Determine role
    const role = await getRoleFromLegacyUser({ user: legacyUser })
    
    return NextResponse.json({
      success: true,
      email,
      found: true,
      directoryUser: {
        FirstName: legacyUser.FirstName,
        LastName: legacyUser.LastName,
        Email: legacyUser.Email,
        ecclesia: legacyUser.ecclesia,
      },
      assignedRole: role,
      message: `Role ${role} assigned successfully`
    })
    
  } catch (error) {
    console.error('❌ Debug API error:', error)
    return NextResponse.json({
      success: false,
      email,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to check role'
    }, { status: 500 })
  }
}