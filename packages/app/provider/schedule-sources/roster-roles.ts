/**
 * Catalogue fields that name a person in the home ecclesia's built-in schedules
 * (docs/ECCLESIA_SCHEDULES.md §Registry). Pure, so the setup screen can use the
 * same list for its default "names a person" toggles without pulling in the
 * registry's database code. Declared once; `registry.ts` re-exports it.
 */
import type { ScheduleTypeKey } from '../../config/schedule-fields'

export const BUILT_IN_ROSTER_ROLES: Readonly<Partial<Record<ScheduleTypeKey, readonly string[]>>> = {
  memorial: ['Exhort', 'Preside', 'Reading1', 'Reading2'],
  bibleClass: ['Presider', 'Speaker'],
  cyc: ['speaker'],
}
