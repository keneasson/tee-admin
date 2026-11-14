import { SCHEDULE_TYPE_CATALOGUE, SCHEDULE_TYPE_KEYS, type ScheduleTypeKey } from '@my/app/config/schedule-fields'
import type { MappedField, RegistryEntry } from '@my/app/provider/schedule-sources/types'
import { scheduleEcclesiaId } from '@my/app/provider/dynamodb/repositories/schedule-repository'

/**
 * Turning setup-page input into registry entries (docs/ECCLESIA_SCHEDULES.md
 * §Registry). Pure: the routes do the reads, claims and writes.
 */

export function isScheduleKind(value: unknown): value is ScheduleTypeKey {
  return typeof value === 'string' && (SCHEDULE_TYPE_KEYS as string[]).includes(value)
}

export type DraftResult = { ok: true; entry: RegistryEntry } | { ok: false; error: string }

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * A google-sheets entry from the setup page's draft. `scheduleId` = kind this
 * round. Every mapped field must be a catalogue field of that kind, once.
 */
export function draftEntry(
  ecclesia: string,
  scheduleId: string,
  body: Record<string, any>,
  meta: { updatedBy: string; now: string }
): DraftResult {
  if (!isScheduleKind(scheduleId)) return { ok: false, error: 'Unknown schedule.' }
  const def = SCHEDULE_TYPE_CATALOGUE[scheduleId]
  const spreadsheetId = str(body.source?.spreadsheetId)
  const tab = str(body.source?.tab)
  if (!spreadsheetId || !tab) return { ok: false, error: 'Choose a sheet and a tab.' }

  const dateColumn = str(body.mapping?.dateColumn)
  if (!dateColumn) return { ok: false, error: 'Choose the column that holds the date.' }
  const timeColumn = str(body.mapping?.timeColumn)

  const rawFields: unknown[] = Array.isArray(body.mapping?.fields) ? body.mapping.fields : []
  const fields: MappedField[] = []
  const seen = new Set<string>()
  for (const raw of rawFields) {
    const f = (raw ?? {}) as Record<string, unknown>
    const column = str(f.column)
    const key = str(f.key)
    if (!column || !key) continue
    const cat = def.fields.find((c) => c.key === key)
    if (!cat) return { ok: false, error: `"${key}" is not a ${def.defaultLabel} field.` }
    if (seen.has(key)) return { ok: false, error: `${cat.defaultLabel} is mapped twice.` }
    seen.add(key)
    fields.push({ column, key, label: str(f.label) || cat.defaultLabel, rosterRole: f.rosterRole === true })
  }
  if (fields.length === 0) return { ok: false, error: 'Map at least one column to a field.' }

  return {
    ok: true,
    entry: {
      ecclesiaId: scheduleEcclesiaId(ecclesia),
      ecclesia,
      scheduleId,
      name: str(body.name) || def.defaultLabel,
      kind: scheduleId,
      active: body.active !== false,
      source: { kind: 'google-sheets', spreadsheetId, tab },
      mapping: { dateColumn, ...(timeColumn ? { timeColumn } : {}), fields },
      updatedBy: meta.updatedBy,
      updatedAt: meta.now,
    },
  }
}

/**
 * A site-configured entry with only its roster-role toggles changed — the one
 * thing editable on Toronto East's built-in schedules. Unknown keys are ignored.
 */
export function withRosterRoles(
  current: RegistryEntry,
  rosterRoles: unknown,
  meta: { updatedBy: string; now: string }
): DraftResult {
  if (!Array.isArray(rosterRoles) || rosterRoles.some((r) => typeof r !== 'string')) {
    return { ok: false, error: 'Site-configured schedules only change which fields name a person.' }
  }
  const on = new Set(rosterRoles as string[])
  const { builtIn: _builtIn, ...rest } = current
  return {
    ok: true,
    entry: {
      ...rest,
      mapping: { ...current.mapping, fields: current.mapping.fields.map((f) => ({ ...f, rosterRole: on.has(f.key) })) },
      updatedBy: meta.updatedBy,
      updatedAt: meta.now,
    },
  }
}

/** What the setup page sees of an entry: never a site sheet ID (there is none to hide, but be explicit). */
export function entryView(entry: RegistryEntry) {
  const siteConfigured = entry.source.kind === 'env'
  return {
    scheduleId: entry.scheduleId,
    name: entry.name,
    kind: entry.kind,
    active: entry.active,
    siteConfigured,
    source: siteConfigured
      ? { kind: 'env' as const }
      : { kind: entry.source.kind, spreadsheetId: entry.source.spreadsheetId, tab: entry.source.tab },
    mapping: entry.mapping,
    lastSync: entry.lastSync ?? null,
    updatedAt: entry.updatedAt ?? null,
  }
}

export type EntryView = ReturnType<typeof entryView>
