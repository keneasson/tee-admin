import { NextRequest, NextResponse } from 'next/server'
import { searchEcclesia } from '../../../../utils/dynamodb/locations'

export async function GET(request: NextRequest) {
  try {
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