import { NextRequest, NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { userRepository } from '@my/app/provider/dynamodb/repositories/user-repository'
import { TIMEZONE_OPTIONS } from '@my/app/utils/timezone'

/**
 * GET /api/user/preferences
 * Get user preferences (timezone, date format, etc.)
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const preferences = await userRepository.getUserPreferences(session.user.email)

    return NextResponse.json({
      success: true,
      preferences: preferences || {
        timezone: 'America/Toronto',
        useAutoTimezone: false,
        dateFormat: 'long',
        timeFormat: '12h',
      },
    })
  } catch (error) {
    console.error('Get user preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/user/preferences
 * Update user preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { timezone, useAutoTimezone, dateFormat, timeFormat } = body

    // Validate timezone if provided
    if (timezone) {
      const validTimezones = TIMEZONE_OPTIONS.map((t) => t.value)
      if (!validTimezones.includes(timezone)) {
        return NextResponse.json(
          { error: `Invalid timezone. Valid options: ${validTimezones.join(', ')}` },
          { status: 400 }
        )
      }
    }

    // Validate dateFormat if provided
    if (dateFormat && !['long', 'short'].includes(dateFormat)) {
      return NextResponse.json(
        { error: 'Invalid dateFormat. Valid options: long, short' },
        { status: 400 }
      )
    }

    // Validate timeFormat if provided
    if (timeFormat && !['12h', '24h'].includes(timeFormat)) {
      return NextResponse.json(
        { error: 'Invalid timeFormat. Valid options: 12h, 24h' },
        { status: 400 }
      )
    }

    // Build updates object with only provided values
    const updates: Record<string, any> = {}
    if (timezone !== undefined) updates.timezone = timezone
    if (useAutoTimezone !== undefined) updates.useAutoTimezone = useAutoTimezone
    if (dateFormat !== undefined) updates.dateFormat = dateFormat
    if (timeFormat !== undefined) updates.timeFormat = timeFormat

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 })
    }

    const updated = await userRepository.updateUserPreferences(session.user.email, updates)

    return NextResponse.json({
      success: true,
      preferences: updated,
    })
  } catch (error) {
    console.error('Update user preferences error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
