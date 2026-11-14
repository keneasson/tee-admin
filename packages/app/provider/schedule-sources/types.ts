/**
 * Schedule registry + source adapters (docs/ECCLESIA_SCHEDULES.md).
 *
 * A registry entry says, per ecclesia and per kind, where a schedule comes from
 * and how its columns map onto the catalogue fields. A source adapter reads raw
 * rows; `toScheduleRows` (mapping.ts) turns them into the rows
 * `ScheduleRepository.replaceSheetSchedules` writes. Types only — no I/O here.
 */
import type { ScheduleTypeKey } from '../../config/schedule-fields'

/** Where rows come from. `env` = Toronto East's site configuration (sheet_ids). */
export type SourceKind = 'google-sheets' | 'native' | 'env'

export interface ScheduleSourceRef {
  kind: SourceKind
  /** google-sheets only. Never set for `env` — site sheet IDs stay in the env. */
  spreadsheetId?: string
  /** google-sheets: the tab (sheet title) rows are read from. */
  tab?: string
  /** env only: the `sheet_ids` key in the site configuration. */
  envKey?: string
}

/** One source column mapped onto a catalogue field of the entry's kind. */
export interface MappedField {
  /** Header text in the source table. */
  column: string
  /** Catalogue field key (SCHEDULE_TYPE_CATALOGUE[kind].fields[].key). */
  key: string
  label: string
  /** True when this column names a person (a speaker invitation can fill it). */
  rosterRole: boolean
}

export interface ColumnMapping {
  dateColumn: string
  timeColumn?: string
  fields: MappedField[]
}

export interface LastSync {
  at: string
  status: 'ok' | 'error'
  rows: number
  error?: string
}

export interface RegistryEntry {
  ecclesiaId: string
  /** The kind, this round (at most one schedule per kind per ecclesia). */
  scheduleId: string
  name: string
  kind: ScheduleTypeKey
  active: boolean
  source: ScheduleSourceRef
  mapping: ColumnMapping
  lastSync?: LastSync
  updatedBy?: string
  updatedAt?: string
  /** Derived from site configuration at read time; never stored. */
  builtIn?: boolean
}

/** How an ecclesia hands us a table. More modes (oauth, graph) later, same shape. */
export type ConnectInput = { mode: 'service-account-share'; spreadsheetId: string }

export interface Connection<C = unknown> {
  ecclesiaId: string
  kind: SourceKind
  config: C
}

/** A table (tab) within a connected source, with its header row when known. */
export interface TableRef {
  id: string
  name: string
  headers?: string[]
}

/** One source row keyed by header text. */
export type RawRow = Record<string, string | number | boolean | null | undefined>

export interface ScheduleSource<C = unknown> {
  kind: SourceKind
  connect(ecclesiaId: string, input: ConnectInput): Promise<Connection<C>>
  listTables(connection: Connection<C>): Promise<TableRef[]>
  readRows(connection: Connection<C>, table: TableRef): Promise<RawRow[]>
}

/** What `ScheduleRepository.replaceSheetSchedules` takes, one per row. */
export interface ScheduleRowInput {
  ecclesia: string
  date: string
  type: ScheduleTypeKey
  scheduleData: Record<string, string>
  time?: string
  dateTime?: string
  sourceTimezone?: string
}
