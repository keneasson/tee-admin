import { NextResponse } from 'next/server'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import { scheduleEcclesiaId } from '@my/app/provider/dynamodb/repositories/schedule-repository'
import { scheduleRegistryRepository } from '@my/app/provider/dynamodb/repositories/schedule-registry-repository'
import { envSpreadsheetIds } from '@my/app/provider/schedule-sources/registry'
import {
  googleSheetsSource,
  parseSpreadsheetId,
  ScheduleSourceError,
  serviceAccountEmail,
} from '@my/app/provider/schedule-sources/google-sheets'
import { badRequest, noStore, readJson, scheduleManagerContext } from '@/utils/ecclesia-schedules/http'
import { isScheduleKind } from '@/utils/ecclesia-schedules/entries'

/**
 * POST /api/ecclesia-schedules/connect[?ecclesia=X]  { sheetUrl, scheduleId }
 *   200 { spreadsheetId, title, tabs: [{ name, headers }] }
 *   409 { code: 'NOT_SHARED', serviceAccountEmail }  share the sheet with this address first
 *   409 { code: 'CLAIMED' }                          another ecclesia has connected this sheet
 *   400 { code: 'SITE_SHEET' | 'HOME_SITE_CONFIG' | 'INVALID_INPUT' }
 *
 * Verifies we can open the sheet, claims it for this ecclesia (one sheet → one
 * ecclesia), and lists its tabs with their header rows. Writes only the claim.
 */
export async function POST(request: Request) {
  const ctx = await scheduleManagerContext(request)
  if (!ctx.ok) return ctx.response
  const body = await readJson(request)
  if (!body) return badRequest('Invalid JSON body')

  const scheduleId = body.scheduleId
  if (!isScheduleKind(scheduleId)) return badRequest('Choose which schedule this sheet is for.')
  if (HOME_ECCLESIA.isHomeEcclesia(ctx.ecclesia)) {
    return badRequest('Toronto East schedules come from the site configuration.', 'HOME_SITE_CONFIG')
  }
  const spreadsheetId = parseSpreadsheetId(typeof body.sheetUrl === 'string' ? body.sheetUrl : '')
  if (!spreadsheetId) return badRequest('That does not look like a Google Sheets link. Copy it from the address bar of the sheet.')
  if (envSpreadsheetIds().has(spreadsheetId)) {
    return badRequest('That sheet is part of the site configuration and cannot be connected.', 'SITE_SHEET')
  }

  const ecclesiaId = scheduleEcclesiaId(ctx.ecclesia)
  const email = serviceAccountEmail()

  let connection
  try {
    connection = await googleSheetsSource.connect(ecclesiaId, { mode: 'service-account-share', spreadsheetId })
  } catch (error) {
    if (error instanceof ScheduleSourceError && (error.code === 'NOT_SHARED' || error.code === 'NOT_FOUND')) {
      return NextResponse.json(
        {
          error: email
            ? `We can't open that sheet yet. Share it with ${email} (Viewer is enough), then try again.`
            : "We can't open that sheet yet.",
          code: 'NOT_SHARED',
          serviceAccountEmail: email,
        },
        { status: 409, headers: noStore }
      )
    }
    console.error('[ecclesia-schedules] connect failed:', error)
    return NextResponse.json(
      { error: 'We could not reach Google Sheets. Please try again in a minute.', code: 'READ_FAILED' },
      { status: 502, headers: noStore }
    )
  }

  const claimed = await scheduleRegistryRepository.claimSheet(spreadsheetId, ecclesiaId, scheduleId)
  if (!claimed) {
    return NextResponse.json(
      { error: 'This sheet is already connected to another ecclesia.', code: 'CLAIMED' },
      { status: 409, headers: noStore }
    )
  }

  try {
    const tabs = await googleSheetsSource.listTables(connection)
    return NextResponse.json(
      {
        spreadsheetId,
        title: connection.config.title ?? null,
        tabs: tabs.map((t) => ({ name: t.name, headers: t.headers ?? [] })),
      },
      { headers: noStore }
    )
  } catch (error) {
    console.error('[ecclesia-schedules] list tabs failed:', error)
    return NextResponse.json(
      { error: 'We opened the sheet but could not read its tabs. Please try again.', code: 'READ_FAILED' },
      { status: 502, headers: noStore }
    )
  }
}
