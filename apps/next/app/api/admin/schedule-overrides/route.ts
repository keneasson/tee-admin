import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { serviceOverrideRepository } from '@my/app/provider/dynamodb/repositories/service-override-repository'
import type { ServiceOverrideType } from '@my/app/provider/dynamodb/service-override-types'
import { normalizeToISODate } from '@my/app/utils/service-overrides/merge'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { invalidateScheduleCache } from '@/utils/cache'

/**
 * Per-occurrence Service Overrides admin API.
 * Scoped to the home ecclesia; gated to ADMIN/OWNER. Overrides live in `tee-admin`
 * and are merged onto the synced schedule at read time (web + email).
 */

const SERVICE_TYPES: ServiceOverrideType[] = ['memorial', 'bibleClass', 'sundaySchool']
const OCCURRENCE_WINDOW_DAYS = 70

const scheduleService = new ScheduleService()

function isValidServiceType(v: any): v is ServiceOverrideType {
  return v === 'memorial' || v === 'bibleClass' || v === 'sundaySchool' || v === 'cyc'
}

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = ((session.user as any).role as string) || ROLES.GUEST
  if (role !== ROLES.ADMIN && role !== ROLES.OWNER) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }
  return { email: session.user.email }
}

/** Short human summary of an occurrence, per service type. */
function summarize(serviceType: ServiceOverrideType, data: Record<string, any>): string {
  switch (serviceType) {
    case 'memorial': {
      const parts = [data.Exhort, data.Preside].filter(Boolean)
      return parts.length ? `Exhort: ${data.Exhort || '—'} · Preside: ${data.Preside || '—'}` : 'No roster (would show "no service")'
    }
    case 'bibleClass':
      return data.Speaker ? `${data.Speaker}${data.Topic ? ` · ${data.Topic}` : ''}` : 'No speaker (sparse)'
    case 'sundaySchool':
      return data.Refreshments ? `Refreshments: ${data.Refreshments}` : 'No refreshments (would show "no Sunday School")'
    default:
      return ''
  }
}

/**
 * GET — returns upcoming occurrences (next 10 weeks across service types) plus the
 * current overrides for the home ecclesia, so the admin UI can list and edit them.
 */
export async function GET() {
  const gate = await requireAdmin()
  if (gate.error) return gate.error

  const ecclesia = HOME_ECCLESIA.canonicalName
  const todayISO = normalizeToISODate(new Date())
  const to = new Date()
  to.setDate(to.getDate() + OCCURRENCE_WINDOW_DAYS)
  const toISO = normalizeToISODate(to)

  try {
    const occurrences: Array<{
      serviceType: ServiceOverrideType
      date: string
      formattedDate: string
      summary: string
    }> = []

    for (const serviceType of SERVICE_TYPES) {
      const schedule = await scheduleService.getScheduleData(serviceType)
      if (!schedule?.content) continue
      for (const data of schedule.content as Record<string, any>[]) {
        const date = normalizeToISODate(data.Date || data.DateTime || data.date)
        if (!date || date < todayISO || date > toISO) continue
        const formattedDate = new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        })
        occurrences.push({ serviceType, date, formattedDate, summary: summarize(serviceType, data) })
      }
    }

    occurrences.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.serviceType.localeCompare(b.serviceType)))

    const overrides = await serviceOverrideRepository.listByDateRange(ecclesia, todayISO, toISO)

    return NextResponse.json(
      { ecclesia, occurrences, overrides },
      { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } }
    )
  } catch (error) {
    console.error('Error loading schedule overrides:', error)
    return NextResponse.json({ error: 'Failed to load schedule overrides' }, { status: 500 })
  }
}

/** PUT/POST — upsert an override for (serviceType, date). */
async function upsert(request: NextRequest) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error

  try {
    const body = await request.json()
    const { serviceType, date, status, message, note, attendOptions } = body

    if (!isValidServiceType(serviceType)) {
      return NextResponse.json({ error: 'Invalid serviceType' }, { status: 400 })
    }
    const normalizedDate = normalizeToISODate(date)
    if (!normalizedDate) {
      return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 })
    }
    if (status !== undefined && status !== 'cancelled' && status !== 'active') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const record = await serviceOverrideRepository.upsert({
      ecclesia: HOME_ECCLESIA.canonicalName,
      serviceType,
      date: normalizedDate,
      status,
      message,
      note,
      attendOptions,
      createdBy: gate.email!,
    })

    await invalidateScheduleCache(serviceType)

    return NextResponse.json(record)
  } catch (error) {
    console.error('Error saving schedule override:', error)
    return NextResponse.json({ error: 'Failed to save schedule override' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  return upsert(request)
}

export async function POST(request: NextRequest) {
  return upsert(request)
}

/** DELETE — remove an override by ?serviceType=&date=. */
export async function DELETE(request: NextRequest) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error

  try {
    const { searchParams } = new URL(request.url)
    const serviceType = searchParams.get('serviceType')
    const date = normalizeToISODate(searchParams.get('date') || '')

    if (!isValidServiceType(serviceType)) {
      return NextResponse.json({ error: 'Invalid serviceType' }, { status: 400 })
    }
    if (!date) {
      return NextResponse.json({ error: 'Invalid or missing date' }, { status: 400 })
    }

    await serviceOverrideRepository.deleteOne(HOME_ECCLESIA.canonicalName, serviceType, date)
    await invalidateScheduleCache(serviceType)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting schedule override:', error)
    return NextResponse.json({ error: 'Failed to delete schedule override' }, { status: 500 })
  }
}
