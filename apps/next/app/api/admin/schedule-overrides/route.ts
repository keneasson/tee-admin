import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { ScheduleService } from '@my/app/provider/dynamodb/schedule-service'
import { serviceOverrideRepository } from '@my/app/provider/dynamodb/repositories/service-override-repository'
import type { ServiceOverrideType } from '@my/app/provider/dynamodb/service-override-types'
import { normalizeToISODate } from '@my/app/utils/service-overrides/merge'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { SCHEDULE_TYPE_CATALOGUE } from '@my/app/config/schedule-fields'
import { invalidateScheduleCache } from '@/utils/cache'

/**
 * Per-occurrence Service Overrides admin API.
 * Scoped to the home ecclesia; gated to ADMIN/OWNER. Overrides live in `tee-admin`
 * and are merged onto the synced schedule at read time (web + email).
 *
 * TODO(multi-tenant, #110): everything here pins HOME_ECCLESIA and gates on the
 * GLOBAL admin/owner role. When multi-tenant lands, resolve the ecclesia from the
 * request host and authorize against the caller's managedRegions.
 */

const SERVICE_TYPES: ServiceOverrideType[] = ['memorial', 'bibleClass', 'sundaySchool', 'cyc']
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

/**
 * Current synced (Google-Sheets) value for every catalogue field of a service type,
 * so the admin UI can pre-fill the per-role inputs with what's live today. Values are
 * coerced to strings; missing columns become ''.
 */
function syncedFieldsFor(serviceType: ServiceOverrideType, data: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of SCHEDULE_TYPE_CATALOGUE[serviceType].fields) {
    const raw = data[field.key]
    out[field.key] = raw === undefined || raw === null ? '' : String(raw)
  }
  return out
}

/**
 * Validate an incoming `roleFields` payload: a flat map of catalogue fieldKey → string.
 * Unknown keys (not in the type's catalogue) are dropped rather than rejected, so a
 * stale client can't inject arbitrary columns. Returns undefined when nothing valid.
 */
function sanitizeRoleFields(
  serviceType: ServiceOverrideType,
  raw: any
): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const allowed = new Set(SCHEDULE_TYPE_CATALOGUE[serviceType].fields.map((f) => f.key))
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue
    if (typeof value !== 'string') continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Validate an incoming `roleFieldRefs` payload: catalogue fieldKey → PersonRecord
 * personId. Slice B (#110) metadata recording WHICH directory member was picked for
 * a role. Same allow-list discipline as roleFields — unknown/blank keys are dropped.
 * This is metadata only; it is NEVER applied to the program item, so it can't leak to
 * the anon read path. Returns undefined when nothing valid.
 */
function sanitizeRoleFieldRefs(
  serviceType: ServiceOverrideType,
  raw: any
): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const allowed = new Set(SCHEDULE_TYPE_CATALOGUE[serviceType].fields.map((f) => f.key))
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue
    if (typeof value !== 'string' || value.trim().length === 0) continue
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
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
    case 'cyc': {
      if (data.event) return String(data.event)
      const parts = [data.speaker, data.topic].filter(Boolean)
      return parts.length ? parts.join(' · ') : 'No CYC details (sparse)'
    }
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
      syncedFields: Record<string, string>
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
        occurrences.push({
          serviceType,
          date,
          formattedDate,
          summary: summarize(serviceType, data),
          syncedFields: syncedFieldsFor(serviceType, data),
        })
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
    const { serviceType, date, status, message, note, attendOptions, roleFields, roleFieldRefs } =
      body

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
      roleFields: sanitizeRoleFields(serviceType, roleFields),
      roleFieldRefs: sanitizeRoleFieldRefs(serviceType, roleFieldRefs),
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
