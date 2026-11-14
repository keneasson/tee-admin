/**
 * Native source (docs/ECCLESIA_SCHEDULES.md §Sources): rows are entered in TEE
 * Admin itself (`POST /api/ecclesia/[name]/schedule`), so there is nothing to
 * read. Sync skips native entries.
 */
import type { Connection, ScheduleSource } from './types'

export const nativeSource: ScheduleSource<Record<string, never>> = {
  kind: 'native',
  async connect(ecclesiaId): Promise<Connection<Record<string, never>>> {
    return { ecclesiaId, kind: 'native', config: {} }
  },
  async listTables() {
    return []
  },
  async readRows() {
    return []
  },
}
