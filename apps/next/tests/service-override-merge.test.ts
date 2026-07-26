import { describe, it, expect } from 'vitest'
import {
  normalizeToISODate,
  overrideKey,
  applyOverrideToProgramItem,
} from '@my/app/utils/service-overrides/merge'
import type { ServiceOccurrenceOverrideRecord } from '@my/app/provider/dynamodb/service-override-types'
import { redactScheduleData } from '@my/app/utils/redact-schedule'
import { ANONYMOUS_VIEWER } from '@my/app/utils/viewer-pii'

/**
 * The UTC date key is the fragile part of the overlay: the admin listing, the web
 * transform (/api/upcoming-program) and the email transform (get_upcoming_program)
 * must all derive the SAME `serviceType#YYYY-MM-DD` key from different date
 * representations, or an override silently fails to match its occurrence.
 */
describe('normalizeToISODate (UTC date key)', () => {
  it('derives the date from UTC components of a Date object', () => {
    // 2025-08-03T23:30:00Z is still Aug 3 in UTC regardless of the host timezone.
    expect(normalizeToISODate(new Date('2025-08-03T23:30:00.000Z'))).toBe('2025-08-03')
    expect(normalizeToISODate(new Date('2025-08-03T00:00:00.000Z'))).toBe('2025-08-03')
  })

  it('takes the date part of an ISO datetime string as-is (no re-parse drift)', () => {
    expect(normalizeToISODate('2025-08-03T15:00:00.000Z')).toBe('2025-08-03')
    expect(normalizeToISODate('2025-12-25T04:59:59.000Z')).toBe('2025-12-25')
  })

  it('passes a plain YYYY-MM-DD through unchanged', () => {
    expect(normalizeToISODate('2025-08-03')).toBe('2025-08-03')
  })

  it('returns empty string for unparseable / missing input', () => {
    expect(normalizeToISODate('')).toBe('')
    expect(normalizeToISODate(null)).toBe('')
    expect(normalizeToISODate(undefined)).toBe('')
    expect(normalizeToISODate('not a date')).toBe('')
    expect(normalizeToISODate(new Date('invalid'))).toBe('')
  })

  it('agrees across the representations of the same occurrence (cross-path match)', () => {
    // Admin listing keys off the ISO date string; the transform keys off a Date /
    // ISO DateTime. All three must collapse to one key so the override matches.
    const fromIsoDate = normalizeToISODate('2025-08-03')
    const fromDateTime = normalizeToISODate('2025-08-03T18:00:00.000Z')
    const fromDateObj = normalizeToISODate(new Date('2025-08-03T18:00:00.000Z'))
    expect(fromIsoDate).toBe(fromDateTime)
    expect(fromDateTime).toBe(fromDateObj)
    expect(overrideKey('memorial', fromIsoDate)).toBe('memorial#2025-08-03')
  })
})

describe('applyOverrideToProgramItem', () => {
  const override: ServiceOccurrenceOverrideRecord = {
    ecclesia: 'Toronto East',
    serviceType: 'memorial',
    date: '2025-08-03',
    status: 'cancelled',
    message: 'No service at our hall',
    note: 'Joint meeting at Toronto West',
    attendOptions: [{ id: 'o1', mode: 'stream', label: 'West Stream' }],
  } as ServiceOccurrenceOverrideRecord

  it('merges override fields onto the item without dropping synced roster fields', () => {
    const item: Record<string, any> = { Key: 'memorial', Exhort: 'Bro A', Preside: 'Bro B' }
    const result = applyOverrideToProgramItem(item, override)
    expect(result.Exhort).toBe('Bro A') // synced field preserved
    expect(result.overrideStatus).toBe('cancelled')
    expect(result.overrideMessage).toBe('No service at our hall')
    expect(result.overrideNote).toBe('Joint meeting at Toronto West')
    expect(result.attendOptions).toHaveLength(1)
  })

  it('is a no-op when there is no matching override', () => {
    const item: Record<string, any> = { Key: 'memorial', Exhort: 'Bro A' }
    const result = applyOverrideToProgramItem(item, undefined)
    expect(result.overrideStatus).toBeUndefined()
    expect(result).toEqual({ Key: 'memorial', Exhort: 'Bro A' })
  })
})

/**
 * Slice A (#110): per-ROLE field overlay. The override's `roleFields` map writes
 * onto the program item's matching role columns at read time; roster columns NOT in
 * the map keep their synced Sheets value. `tee-schedules` is never touched.
 */
describe('applyOverrideToProgramItem — roleFields (roster overlay)', () => {
  const makeOverride = (roleFields: Record<string, string>): ServiceOccurrenceOverrideRecord =>
    ({
      ecclesia: 'Toronto East',
      serviceType: 'memorial',
      date: '2025-08-03',
      roleFields,
    }) as ServiceOccurrenceOverrideRecord

  it('applies each roleFields entry onto the matching role column', () => {
    const item: Record<string, any> = {
      Key: 'memorial',
      Exhort: 'Bro Synced',
      Preside: 'Bro Preside',
      Organist: 'Sis Organist',
    }
    const result = applyOverrideToProgramItem(item, makeOverride({ Exhort: 'Bro Override' }))
    expect(result.Exhort).toBe('Bro Override') // overridden
    expect(result.Preside).toBe('Bro Preside') // untouched (absent key)
    expect(result.Organist).toBe('Sis Organist') // untouched (absent key)
  })

  it('leaves columns absent from roleFields untouched, and overrides multiple keys', () => {
    const item: Record<string, any> = {
      Key: 'memorial',
      Exhort: 'Bro A',
      Preside: 'Bro B',
      Steward: 'Bro C',
    }
    const result = applyOverrideToProgramItem(
      item,
      makeOverride({ Exhort: 'Bro X', Steward: 'Bro Z' })
    )
    expect(result.Exhort).toBe('Bro X')
    expect(result.Steward).toBe('Bro Z')
    expect(result.Preside).toBe('Bro B') // untouched
  })

  it('an overridden role value is still first-name-only redacted for an anon viewer', () => {
    const item: Record<string, any> = { Key: 'memorial', Exhort: 'Bro Synced' }
    applyOverrideToProgramItem(item, makeOverride({ Exhort: 'Jonathan Bowen' }))
    // Merge runs BEFORE redaction on the anon read path, so the overridden full name
    // must collapse to the first name just like a synced value would.
    const [safe] = redactScheduleData([item], ANONYMOUS_VIEWER, 'public-web')
    expect(safe.Exhort).toBe('Jonathan')
  })

  it('reveals the overridden full name on the member/newsletter channel', () => {
    const item: Record<string, any> = { Key: 'memorial', Exhort: 'Bro Synced' }
    applyOverrideToProgramItem(item, makeOverride({ Exhort: 'Jonathan Bowen' }))
    const [full] = redactScheduleData([item], ANONYMOUS_VIEWER, 'newsletter-email')
    expect(full.Exhort).toBe('Jonathan Bowen')
  })
})
