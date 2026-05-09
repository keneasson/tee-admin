import { NextResponse } from 'next/server'
import { auth } from '../../../../utils/auth'
import { ROLES } from '@my/app/provider/auth/auth-roles'
// vercel.json is the authoritative cron list right now (DB-driven EventBridge
// system isn't live yet). Imported via resolveJsonModule so the file is
// bundled into the serverless function — no runtime fs read.
import vercelConfig from '../../../../vercel.json'

interface VercelCron {
  path: string
  schedule: string
}

interface ScheduledEmail {
  reason: string
  cronExpression: string
  nextFiringUtcMs: number
}

const REASON_FROM_PATH = /^\/api\/email\/([a-z-]+)$/

// Parse a single field of a cron expression that may be "*", a single int,
// or a comma-separated list. Returns null for unsupported forms (ranges,
// step values, etc.) so we can fall back gracefully.
function parseCronField(field: string, min: number, max: number): number[] | null {
  if (field === '*') {
    const out: number[] = []
    for (let i = min; i <= max; i++) out.push(i)
    return out
  }
  const values: number[] = []
  for (const part of field.split(',')) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < min || n > max) return null
    values.push(n)
  }
  return values
}

// Compute the next firing time (UTC ms) for a cron expression. Vercel cron
// always runs in UTC.
function nextFiringUtcMs(expression: string, fromMs = Date.now()): number | null {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [m, h, dom, mon, dow] = parts

  // We only support paths that fire on day-of-week (the only shape used in
  // vercel.json today). day-of-month and month must be wildcards.
  if (dom !== '*' || mon !== '*') return null

  const minutes = parseCronField(m, 0, 59)
  const hours = parseCronField(h, 0, 23)
  const daysOfWeek = parseCronField(dow, 0, 6)
  if (!minutes || !hours || !daysOfWeek) return null

  // Walk forward up to 7 days looking for the next matching slot
  const from = new Date(fromMs)
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const candidate = new Date(Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth(),
      from.getUTCDate() + dayOffset
    ))
    if (!daysOfWeek.includes(candidate.getUTCDay())) continue
    for (const hour of hours) {
      for (const minute of minutes) {
        const slot = Date.UTC(
          candidate.getUTCFullYear(),
          candidate.getUTCMonth(),
          candidate.getUTCDate(),
          hour,
          minute
        )
        if (slot > fromMs) return slot
      }
    }
  }
  return null
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const userRole = session.user.role
  if (!userRole || ![ROLES.OWNER, ROLES.ADMIN].includes(userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const crons = ((vercelConfig as { crons?: VercelCron[] }).crons) ?? []
  const now = Date.now()
  const schedules: ScheduledEmail[] = crons
    .map((c): ScheduledEmail | null => {
      const reasonMatch = REASON_FROM_PATH.exec(c.path)
      if (!reasonMatch) return null
      const next = nextFiringUtcMs(c.schedule, now)
      if (next == null) return null
      return {
        reason: reasonMatch[1],
        cronExpression: c.schedule,
        nextFiringUtcMs: next,
      }
    })
    .filter((s): s is ScheduledEmail => s !== null)
    .sort((a, b) => a.nextFiringUtcMs - b.nextFiringUtcMs)

  return NextResponse.json({ schedules })
}
