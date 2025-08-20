import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    return NextResponse.json({
      authenticated: !!session,
      user: session?.user || null,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Auth status error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check auth status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}