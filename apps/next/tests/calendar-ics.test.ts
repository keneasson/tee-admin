import { describe, it, expect } from 'vitest'
import { buildIcs, escapeIcsText, foldIcsLine, type BuildIcsInput } from '../utils/calendar/ics'
import { buildGoogleCalendarUrl } from '../utils/calendar/google-calendar-link'
import { zonedTimeToUtc } from '../utils/calendar/zoned-time'

const NOW = new Date('2026-02-01T12:00:00Z')

const base: BuildIcsInput = {
  uid: 'speaker-invite-abc123@tee-admin.com',
  sequence: 0,
  method: 'PUBLISH',
  start: { date: '2026-03-01', time: '11:00' },
  durationMinutes: 90,
  timezone: 'America/Toronto',
  title: 'Memorial exhortation at Example Ecclesia',
  description: 'Exhort at the Memorial.\nChange: https://tee-admin.com/invite/abc123',
  locationName: 'Example Christadelphian Hall',
  address: '123 Example Street, Example City, ON A1A 1A1',
  url: 'https://tee-admin.com/invite/abc123',
  organizer: { name: 'Example Ecclesia', email: 'noreply@example.com' },
  now: NOW,
}

const unfold = (ics: string) => ics.replace(/\r\n /g, '')

describe('zonedTimeToUtc (America/Toronto, across DST)', () => {
  it('winter (EST, UTC-5)', () => {
    expect(zonedTimeToUtc({ date: '2026-03-01', time: '11:00' }, 'America/Toronto').toISOString()).toBe(
      '2026-03-01T16:00:00.000Z'
    )
  })
  it('the Sunday DST starts (2026-03-08) is already EDT at 11:00', () => {
    expect(zonedTimeToUtc({ date: '2026-03-08', time: '11:00' }, 'America/Toronto').toISOString()).toBe(
      '2026-03-08T15:00:00.000Z'
    )
  })
  it('the evening before DST starts is still EST', () => {
    expect(zonedTimeToUtc({ date: '2026-03-07', time: '19:30' }, 'America/Toronto').toISOString()).toBe(
      '2026-03-08T00:30:00.000Z'
    )
  })
  it('the Sunday DST ends (2026-11-01) is back on EST at 11:00', () => {
    expect(zonedTimeToUtc({ date: '2026-11-01', time: '11:00' }, 'America/Toronto').toISOString()).toBe(
      '2026-11-01T16:00:00.000Z'
    )
  })
  it('the Saturday before DST ends is still EDT', () => {
    expect(zonedTimeToUtc({ date: '2026-10-31', time: '11:00' }, 'America/Toronto').toISOString()).toBe(
      '2026-10-31T15:00:00.000Z'
    )
  })
  it('rejects an unknown zone and malformed input', () => {
    expect(() => zonedTimeToUtc({ date: '2026-03-01', time: '11:00' }, 'Not/AZone')).toThrow()
    expect(() => zonedTimeToUtc({ date: '03/01/2026', time: '11:00' }, 'America/Toronto')).toThrow()
  })
})

describe('escapeIcsText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf')
  })
})

describe('foldIcsLine', () => {
  it('leaves a 75-octet line alone', () => {
    const line = 'X'.repeat(75)
    expect(foldIcsLine(line)).toBe(line)
  })
  it('folds at 75 octets with CRLF + space, and unfolds to the original', () => {
    const line = `DESCRIPTION:${'abcdefghij'.repeat(20)}`
    const folded = foldIcsLine(line)
    for (const physical of folded.split('\r\n')) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75)
    }
    expect(folded.split('\r\n').slice(1).every((l) => l.startsWith(' '))).toBe(true)
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })
  it('never splits a multi-byte UTF-8 character', () => {
    const line = `SUMMARY:${'é'.repeat(80)}`
    const folded = foldIcsLine(line)
    for (const physical of folded.split('\r\n')) {
      const bytes = new TextEncoder().encode(physical)
      expect(bytes.length).toBeLessThanOrEqual(75)
      // Round-trips cleanly = no broken sequences.
      expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(physical)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })
})

describe('buildIcs', () => {
  it('produces a CRLF-only RFC 5545 PUBLISH with UTC times', () => {
    const ics = buildIcs(base)
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    const lines = unfold(ics).split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('METHOD:PUBLISH')
    expect(lines).toContain('UID:speaker-invite-abc123@tee-admin.com')
    expect(lines).toContain('SEQUENCE:0')
    expect(lines).toContain('DTSTAMP:20260201T120000Z')
    expect(lines).toContain('DTSTART:20260301T160000Z')
    expect(lines).toContain('DTEND:20260301T173000Z')
    expect(lines).toContain('STATUS:CONFIRMED')
    expect(lines).toContain(
      'LOCATION:Example Christadelphian Hall\\, 123 Example Street\\, Example City\\, ON A1A 1A1'
    )
    expect(lines).toContain('DESCRIPTION:Exhort at the Memorial.\\nChange: https://tee-admin.com/invite/abc123')
    expect(lines).toContain('ORGANIZER;CN=Example Ecclesia:mailto:noreply@example.com')
    for (const physical of ics.split('\r\n')) {
      expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75)
    }
  })

  it('across the DST change, a summer date shifts its UTC hour', () => {
    const lines = unfold(buildIcs({ ...base, start: { date: '2026-03-08', time: '11:00' } })).split('\r\n')
    expect(lines).toContain('DTSTART:20260308T150000Z')
  })

  it('an update keeps the UID and carries the higher SEQUENCE', () => {
    const lines = unfold(buildIcs({ ...base, sequence: 2, start: { date: '2026-03-15', time: '11:00' } })).split(
      '\r\n'
    )
    expect(lines).toContain('UID:speaker-invite-abc123@tee-admin.com')
    expect(lines).toContain('SEQUENCE:2')
  })

  it('cancel = METHOD:CANCEL + STATUS:CANCELLED, same UID', () => {
    const lines = unfold(buildIcs({ ...base, method: 'CANCEL', sequence: 3 })).split('\r\n')
    expect(lines).toContain('METHOD:CANCEL')
    expect(lines).toContain('STATUS:CANCELLED')
    expect(lines).toContain('UID:speaker-invite-abc123@tee-admin.com')
    expect(lines).toContain('SEQUENCE:3')
    expect(lines).not.toContain('STATUS:CONFIRMED')
  })

  it('quotes an organizer CN containing a comma', () => {
    const lines = unfold(buildIcs({ ...base, organizer: { name: 'Example, Ecclesia', email: 'a@example.com' } })).split(
      '\r\n'
    )
    expect(lines).toContain('ORGANIZER;CN="Example, Ecclesia":mailto:a@example.com')
  })

  it('rejects a negative sequence', () => {
    expect(() => buildIcs({ ...base, sequence: -1 })).toThrow()
  })
})

describe('buildGoogleCalendarUrl', () => {
  it('builds the TEMPLATE link with UTC dates and the hall zone', () => {
    const url = new URL(
      buildGoogleCalendarUrl({
        start: { date: '2026-11-01', time: '11:00' },
        durationMinutes: 90,
        timezone: 'America/Toronto',
        title: 'Memorial exhortation at Example Ecclesia',
        description: 'Line one\nLine & two',
        locationName: 'Example Hall',
        address: '123 Example Street',
      })
    )
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('text')).toBe('Memorial exhortation at Example Ecclesia')
    expect(url.searchParams.get('dates')).toBe('20261101T160000Z/20261101T173000Z')
    expect(url.searchParams.get('details')).toBe('Line one\nLine & two')
    expect(url.searchParams.get('location')).toBe('Example Hall, 123 Example Street')
    expect(url.searchParams.get('ctz')).toBe('America/Toronto')
  })
})
