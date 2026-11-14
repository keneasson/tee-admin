import { NextResponse } from 'next/server'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { scheduleEcclesiaId } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import { scheduleRegistryRepository } from '@my/app/provider/dynamodb/repositories/schedule-registry-repository'
import { envSpreadsheetIds, getScheduleRegistry } from '@my/app/provider/schedule-sources/registry'
import { badRequest, noStore, readJson, scheduleManagerContext } from '@/utils/ecclesia-schedules/http'
import { draftEntry, entryView, isScheduleKind, withRosterRoles } from '@/utils/ecclesia-schedules/entries'

/**
 * PUT /api/ecclesia-schedules/[scheduleId][?ecclesia=X] (docs/ECCLESIA_SCHEDULES.md §API)
 *
 *   Site-configured schedule (Toronto East):  { rosterRoles: string[] }
 *     only which fields name a person; the source stays the site configuration
 *   Any other ecclesia:  { name?, active?, source: { spreadsheetId, tab },
 *                          mapping: { dateColumn, timeColumn?, fields: [{ column, key, rosterRole }] } }
 *     the sheet must already be claimed by this ecclesia (POST …/connect)
 *
 *   200 { entry } | 400 | 403 | 409 { code: 'CLAIMED' }
 */
export async function PUT(request: Request, { params }: { params: Promise<{ scheduleId: string }> }) {
  const ctx = await scheduleManagerContext(request)
  if (!ctx.ok) return ctx.response
  const { scheduleId } = await params
  if (!isScheduleKind(scheduleId)) return badRequest('Unknown schedule.')
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON body')

  const meta = { updatedBy: ctx.person.personId, now: new Date().toISOString() }
  const registry = await getScheduleRegistry(ctx.ecclesia)
  const current = registry.find((e) => e.scheduleId === scheduleId)

  if (current?.source.kind === 'env') {
    const next = withRosterRoles(current, body.rosterRoles, meta)
    if (!next.ok) return badRequest(next.error)
    await scheduleRegistryRepository.putEntry(next.entry)
    return NextResponse.json({ entry: entryView(next.entry) }, { headers: noStore })
  }

  if (HOME_ECCLESIA.isHomeEcclesia(ctx.ecclesia)) {
    return badRequest('Toronto East schedules come from the site configuration.', 'HOME_SITE_CONFIG')
  }

  const draft = draftEntry(ctx.ecclesia, scheduleId, body, meta)
  if (!draft.ok) return badRequest(draft.error)
  const entry = { ...draft.entry, ...(current?.lastSync ? { lastSync: current.lastSync } : {}) }
  const spreadsheetId = entry.source.spreadsheetId!
  if (envSpreadsheetIds().has(spreadsheetId)) {
    return badRequest('That sheet is part of the site configuration and cannot be connected.', 'SITE_SHEET')
  }

  const ecclesiaId = scheduleEcclesiaId(ctx.ecclesia)
  const claim = await scheduleRegistryRepository.getSheetClaim(spreadsheetId)
  if (!claim || claim.ecclesiaId !== ecclesiaId) {
    return NextResponse.json(
      { error: 'Connect this sheet first (paste its link on the setup page).', code: 'CLAIMED' },
      { status: 409, headers: noStore }
    )
  }

  await scheduleRegistryRepository.putEntry(entry)

  // Moved to another sheet: release the old one unless another schedule here still uses it.
  const previous = current?.source.spreadsheetId
  if (previous && previous !== spreadsheetId) {
    const stillUsed = registry.some((e) => e.scheduleId !== scheduleId && e.source.spreadsheetId === previous)
    if (!stillUsed) await scheduleRegistryRepository.releaseSheetClaim(previous, ecclesiaId)
  }

  return NextResponse.json({ entry: entryView(entry) }, { headers: noStore })
}
