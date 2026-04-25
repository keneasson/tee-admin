import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { searchEcclesia } from '../../../../utils/dynamodb/locations'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const callerRole = (session.user as any).role as string || ROLES.GUEST
    if (callerRole === ROLES.GUEST || callerRole === ROLES.DECEASED) {
      return NextResponse.json({ error: 'Member access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limitParam = searchParams.get('limit')
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Query must be at least 2 characters',
      })
    }

    const limit = limitParam ? parseInt(limitParam, 10) : 5
    const ecclesias = await searchEcclesia(query.trim(), limit)
    
    return NextResponse.json({
      success: true,
      data: ecclesias,
    })
  } catch (error) {
    console.error('Error searching ecclesia:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search ecclesia',
      },
      { status: 500 }
    )
  }
}