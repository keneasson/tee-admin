/**
 * Pure wall-clock ⇄ UTC conversions for the {@link TimePicker} (Consolidated CMS
 * 2R-2). A TimeBlock stores an ISO-8601 UTC `startsAt` + IANA `timezone` (the
 * codebase's storage convention, see utils/timezone.ts). The picker edits a
 * wall-clock date + time IN that zone; these convert both ways so "7:30pm in
 * Toronto" round-trips to the correct instant across DST.
 *
 * Same algorithm as the block-form TimeBlock editor, extracted here so it is
 * unit-testable and shared without pulling in Tamagui.
 */

/** Wall-clock 'YYYY-MM-DDTHH:mm' in `timeZone` → UTC ISO instant (undefined if blank/invalid). */
export function wallTimeToUtc(local: string, timeZone: string): string | undefined {
  if (!local) return undefined
  // Treat the wall-clock string as if it were UTC, then subtract the zone's
  // offset at that instant to get the true UTC instant.
  const asUtc = new Date(`${local}:00Z`)
  if (Number.isNaN(asUtc.getTime())) return undefined
  const inZone = new Date(asUtc.toLocaleString('en-US', { timeZone }))
  const inUtc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offset = inZone.getTime() - inUtc.getTime()
  return new Date(asUtc.getTime() - offset).toISOString()
}

/** UTC ISO instant → wall-clock 'YYYY-MM-DDTHH:mm' in `timeZone` (empty if blank/invalid). */
export function utcToWallTime(iso: string | undefined, timeZone: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/** UTC ISO → separate `date` ('YYYY-MM-DD') and `time` ('HH:mm') for the two inputs. */
export function utcToWallParts(
  iso: string | undefined,
  timeZone: string
): { date: string; time: string } {
  const wall = utcToWallTime(iso, timeZone)
  if (!wall) return { date: '', time: '' }
  const [date, time] = wall.split('T')
  return { date: date ?? '', time: time ?? '' }
}

/**
 * Combine a `date` input + optional `time` input into a wall-clock string, or ''
 * when there's no date. A date with no time defaults to midnight so a date-only
 * event still yields a valid instant.
 */
export function combineWall(date: string, time: string): string {
  if (!date) return ''
  return `${date}T${time || '00:00'}`
}
