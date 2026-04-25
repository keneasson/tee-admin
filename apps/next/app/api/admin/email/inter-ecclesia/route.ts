import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { getInterEcclesiaEvents } from '@my/app/services/event-service'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { EventType } from '@my/app/types/events'

/**
 * Inter-Ecclesia Events API
 * GET: Fetch events eligible for inter-ecclesia sharing
 * Query params:
 *   - types: comma-separated list of event types (default: funeral,baptism,wedding,engagement)
 *   - ecclesia: hosting ecclesia filter (default: Toronto East)
 *   - daysBack: days to look back (default: 30)
 *   - daysAhead: days to look ahead (default: 60)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for admin/owner role
    const userRole = session.user.role
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const typesParam = searchParams.get('types')
    const ecclesiaParam = searchParams.get('ecclesia')
    const daysBackParam = searchParams.get('daysBack')
    const daysAheadParam = searchParams.get('daysAhead')

    // Parse event types
    const eventTypes = typesParam
      ? (typesParam.split(',') as EventType[])
      : undefined

    // Build options
    const options: {
      hostingEcclesia?: string
      eventTypes?: EventType[]
      daysBack?: number
      daysAhead?: number
    } = {}

    if (eventTypes) options.eventTypes = eventTypes
    if (ecclesiaParam) options.hostingEcclesia = ecclesiaParam
    if (daysBackParam) options.daysBack = parseInt(daysBackParam, 10)
    if (daysAheadParam) options.daysAhead = parseInt(daysAheadParam, 10)

    const events = await getInterEcclesiaEvents(options)

    return NextResponse.json({
      events,
      total: events.length,
      filters: {
        eventTypes: options.eventTypes || ['study-weekend', 'funeral', 'baptism', 'wedding', 'engagement', 'general'],
        hostingEcclesia: options.hostingEcclesia || 'Toronto East',
        daysBack: options.daysBack || 30,
        daysAhead: options.daysAhead || 90,
      }
    })

  } catch (error) {
    console.error('Error in inter-ecclesia events API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
