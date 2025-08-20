import { NextRequest, NextResponse } from 'next/server'
import { fetchReadings } from '@my/app/features/newsletter/readings/fetch-readings'

// In-memory cache with timestamp
let readingsCache: {
  data: any[] | null
  lastUpdated: Date | null
  expires: Date | null
} = {
  data: null,
  lastUpdated: null,
  expires: null
}

// GET /api/admin/newsletter/readings/cache - Get cached readings
export async function GET(request: NextRequest) {
  try {
    const now = new Date()
    
    // Check if cache is still valid (expires at midnight)
    const needsRefresh = !readingsCache.data || 
                        !readingsCache.expires || 
                        now > readingsCache.expires
    
    if (needsRefresh) {
      // Fetch fresh readings data
      console.log('Refreshing readings cache...')
      const freshReadings = await fetchReadings()
      
      // Set cache expiry to next midnight
      const nextMidnight = new Date()
      nextMidnight.setDate(nextMidnight.getDate() + 1)
      nextMidnight.setHours(0, 0, 0, 0)
      
      readingsCache = {
        data: freshReadings,
        lastUpdated: now,
        expires: nextMidnight
      }
      
      console.log(`Readings cache updated. Expires: ${nextMidnight.toISOString()}`)
    }
    
    return NextResponse.json({
      success: true,
      readings: readingsCache.data,
      metadata: {
        cached: !needsRefresh,
        lastUpdated: readingsCache.lastUpdated?.toISOString(),
        expires: readingsCache.expires?.toISOString(),
        count: readingsCache.data?.length || 0
      }
    })
    
  } catch (error) {
    console.error('Error fetching cached readings:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch readings' },
      { status: 500 }
    )
  }
}

// POST /api/admin/newsletter/readings/cache - Force refresh cache
export async function POST(request: NextRequest) {
  try {
    console.log('Force refreshing readings cache...')
    const freshReadings = await fetchReadings()
    
    // Set cache expiry to next midnight
    const nextMidnight = new Date()
    nextMidnight.setDate(nextMidnight.getDate() + 1)
    nextMidnight.setHours(0, 0, 0, 0)
    
    readingsCache = {
      data: freshReadings,
      lastUpdated: new Date(),
      expires: nextMidnight
    }
    
    return NextResponse.json({
      success: true,
      message: 'Readings cache force refreshed',
      readings: readingsCache.data,
      metadata: {
        lastUpdated: readingsCache.lastUpdated?.toISOString(),
        expires: readingsCache.expires?.toISOString(),
        count: readingsCache.data?.length || 0
      }
    })
    
  } catch (error) {
    console.error('Error force refreshing readings cache:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to refresh readings cache' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/newsletter/readings/cache - Clear cache
export async function DELETE(request: NextRequest) {
  try {
    readingsCache = {
      data: null,
      lastUpdated: null,
      expires: null
    }
    
    return NextResponse.json({
      success: true,
      message: 'Readings cache cleared'
    })
    
  } catch (error) {
    console.error('Error clearing readings cache:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to clear readings cache' },
      { status: 500 }
    )
  }
}