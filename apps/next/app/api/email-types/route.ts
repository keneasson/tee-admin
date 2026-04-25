import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'

// Email type configuration for scheduling
// Aligns with email sending system (email-send.tsx)
const emailSenders = {
  'sunday-school': {
    name: 'Sunday School',
    description: 'Weekly Sunday school preparation materials',
  },
  newsletter: {
    name: 'Newsletter',
    description: 'Weekly community newsletter and announcements',
  },
  'bible-class': {
    name: 'Bible Class',
    description: 'Bible class study materials and reminders',
  },
  recap: {
    name: 'Memorial Service',
    description: 'Memorial service arrangements and updates',
  },
}

export type AvailableEmailType = keyof typeof emailSenders

/**
 * GET /api/email-types
 * Get all available email types that can be scheduled
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or owner
    const userRole = (session.user as any).role
    if (userRole !== 'admin' && userRole !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Return available email types with metadata
    const emailTypes = Object.entries(emailSenders).map(([key, value]) => ({
      type: key,
      name: value.name,
      description: value.description,
    }))

    return NextResponse.json({ emailTypes })
  } catch (error) {
    console.error('Failed to get email types:', error)
    return NextResponse.json(
      { error: 'Failed to get email types' },
      { status: 500 }
    )
  }
}
