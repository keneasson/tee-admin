import type { ScheduleTypeKey } from '@my/app/config/schedule-fields'
import type { ColumnMapping, LastSync, ScheduleRowInput } from '@my/app/provider/schedule-sources/types'

/** One schedule as `GET /api/ecclesia-schedules` returns it. */
export interface ScheduleEntryView {
  scheduleId: string
  name: string
  kind: ScheduleTypeKey
  active: boolean
  /** Toronto East's schedules from the site configuration: only roster roles are editable. */
  siteConfigured: boolean
  source: { kind: 'env' } | { kind: 'google-sheets' | 'native'; spreadsheetId?: string; tab?: string }
  mapping: ColumnMapping
  lastSync: LastSync | null
  updatedAt: string | null
}

export interface RegistryResponse {
  ecclesia: string
  canPickEcclesia: boolean
  /** Toronto East: schedules come from the site configuration; no sheets connected here. */
  siteManaged: boolean
  serviceAccountEmail: string | null
  entries: ScheduleEntryView[]
}

export interface ConnectResponse {
  spreadsheetId: string
  title: string | null
  tabs: Array<{ name: string; headers: string[] }>
}

export interface PreviewResponse {
  status: 'preview'
  rows: ScheduleRowInput[]
  total: number
}

export interface SyncResponse {
  status: 'ok' | 'skipped'
  rows?: number
  failed?: number
  reason?: string
}

export interface ApiError {
  error?: string
  code?: string
  serviceAccountEmail?: string | null
}

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiError }
