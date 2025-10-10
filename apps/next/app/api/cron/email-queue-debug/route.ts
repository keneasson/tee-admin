import { NextRequest, NextResponse } from 'next/server'
import { sendQueueRepo } from '@my/app/provider/dynamodb/repositories/send-queue-repository'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (authHeader !== `Bearer ${process.env.EMAIL_SENDER_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Use America/Toronto timezone for date/time calculations
    const torontoTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
    const currentDate = torontoTime.toISOString().split('T')[0]
    const currentTime = `${String(torontoTime.getHours()).padStart(2, '0')}:${String(torontoTime.getMinutes()).padStart(2, '0')}`
    const currentDay = torontoTime.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Toronto' }).toLowerCase()

    const allSchedules = await sendQueueRepo.getAllSchedules()
    const todaySchedules = allSchedules.filter(schedule =>
      schedule.enabled &&
      schedule.dayOfWeek === currentDay
    )

    const debug = {
      serverTime: {
        utc: now.toISOString(),
        toronto: torontoTime.toISOString(),
        currentDate,
        currentTime,
        currentDay,
        currentMinutes: torontoTime.getHours() * 60 + torontoTime.getMinutes(),
      },
      schedules: {
        all: allSchedules.map(s => ({
          type: s.emailType,
          day: s.dayOfWeek,
          time: s.time,
          enabled: s.enabled,
          testMode: s.testMode,
        })),
        today: todaySchedules.map(s => ({
          type: s.emailType,
          time: s.time,
          scheduleMinutes: parseInt(s.time.split(':')[0]) * 60 + parseInt(s.time.split(':')[1]),
          timeUntilSend: (parseInt(s.time.split(':')[0]) * 60 + parseInt(s.time.split(':')[1])) - (torontoTime.getHours() * 60 + torontoTime.getMinutes()),
        })),
      },
    }

    return NextResponse.json(debug)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Debug failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
