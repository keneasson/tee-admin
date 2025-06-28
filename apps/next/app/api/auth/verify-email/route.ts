import { NextRequest, NextResponse } from 'next/server'
import { verifyEmailToken } from '../../../../utils/dynamodb/credentials-users'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      )
    }

    console.log('Email verification attempt for token:', token)
    const result = await verifyEmailToken(token)
    
    if (!result) {
      console.log('Email verification failed: Invalid or expired token')
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      )
    }

    console.log('Email verification successful for:', result.email)
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now sign in to your account.',
      email: result.email,
    })

  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}