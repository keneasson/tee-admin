import { NextResponse } from 'next/server'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { getScheduleRegistry } from '@my/app/provider/schedule-sources/registry'
import { serviceAccountEmail } from '@my/app/provider/schedule-sources/google-sheets'
import { noStore, scheduleManagerContext } from '@/utils/ecclesia-schedules/http'
import { entryView } from '@/utils/ecclesia-schedules/entries'

/**
 * GET /api/ecclesia-schedules[?ecclesia=X] (docs/ECCLESIA_SCHEDULES.md §API)
 *   → { ecclesia, canPickEcclesia, siteManaged, serviceAccountEmail, entries: EntryView[] }
 *
 * `siteManaged`: the home ecclesia, whose schedules come from the site
 * configuration — it cannot connect sheets here (only roster roles are editable).
 *
 * The ecclesia's schedule registry (stored entries, plus Toronto East's
 * site-configured built-ins) and the address a sheet must be shared with.
 * Owner, or the Recording Brother / a Rep of that ecclesia.
 */
export async function GET(request: Request) {
  const ctx = await scheduleManagerContext(request)
  if (!ctx.ok) return ctx.response
  const entries = await getScheduleRegistry(ctx.ecclesia)
  return NextResponse.json(
    {
      ecclesia: ctx.ecclesia,
      canPickEcclesia: ctx.role === ROLES.OWNER,
      siteManaged: HOME_ECCLESIA.isHomeEcclesia(ctx.ecclesia),
      serviceAccountEmail: serviceAccountEmail(),
      entries: entries.map(entryView),
    },
    { headers: noStore }
  )
}
