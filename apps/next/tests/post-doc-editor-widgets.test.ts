import { describe, it, expect } from 'vitest'
import type { PersonBlock } from '@my/app/types/post'
import {
  splitPersonName,
  suggestionToPerson,
  plainNameToPerson,
  pickUniquePersonMatch,
  addPerson,
  removePerson,
  patchPerson,
} from '@my/app/features/post-editor/resolvers/person-resolve'
import {
  wallTimeToUtc,
  utcToWallTime,
  utcToWallParts,
  combineWall,
} from '@my/app/features/post-editor/resolvers/time-resolve'
import { looksLikeUrl, normalizeUrl } from '@my/app/features/post-editor/resolvers/link-resolve'
import { isImageMime, hasFlyerImage } from '@my/app/features/post-editor/resolvers/flyer-resolve'
import {
  parseFee,
  formatFee,
  deadlineDateToIso,
  isoToDeadlineDate,
} from '@my/app/features/post-editor/resolvers/registration-resolve'
import type { FlyerBlock } from '@my/app/types/post'

/**
 * Pure block-mapping for the 2R-2 widgets (Person / Time / Link). The Tamagui
 * components own fetch + rendering; these deterministic mappings are what the
 * tests pin — no React.
 */

describe('person: splitPersonName', () => {
  it('splits first + last', () => {
    expect(splitPersonName('John Smith')).toEqual({ firstName: 'John', lastName: 'Smith' })
  })
  it('keeps multi-word last names', () => {
    expect(splitPersonName('Mary Anne Van Der Berg')).toEqual({
      firstName: 'Mary',
      lastName: 'Anne Van Der Berg',
    })
  })
  it('single token has no last name', () => {
    expect(splitPersonName('Madonna')).toEqual({ firstName: 'Madonna' })
  })
  it('collapses whitespace and trims', () => {
    expect(splitPersonName('  John   Smith  ')).toEqual({ firstName: 'John', lastName: 'Smith' })
  })
  it('blank → empty first name', () => {
    expect(splitPersonName('   ')).toEqual({ firstName: '' })
  })
})

describe('person: mapping to BlockPerson', () => {
  it('directory match copies name + ecclesia, mints a fresh id (no directory id)', () => {
    const p = suggestionToPerson({ id: 'dir-123', name: 'Jane Doe', ecclesia: 'Toronto East' })
    expect(p).toMatchObject({ firstName: 'Jane', lastName: 'Doe', ecclesia: 'Toronto East' })
    expect(p.id).not.toBe('dir-123')
    expect(p.id).toBeTruthy()
  })
  it('plain typed name has no ecclesia', () => {
    const p = plainNameToPerson('Visiting Brother')
    expect(p).toMatchObject({ firstName: 'Visiting', lastName: 'Brother' })
    expect(p.ecclesia).toBeUndefined()
  })
})

describe('person: pickUniquePersonMatch', () => {
  const list = [
    { id: '1', name: 'John Smith' },
    { id: '2', name: 'John Smithson' },
  ]
  it('auto-resolves an exact single name match', () => {
    expect(pickUniquePersonMatch('john smith', list)?.id).toBe('1')
  })
  it('does not auto-resolve when multiple results and no exact', () => {
    expect(pickUniquePersonMatch('john', list)).toBeUndefined()
  })
  it('resolves when there is exactly one result', () => {
    expect(pickUniquePersonMatch('anything', [{ id: '9', name: 'Solo Person' }])?.id).toBe('9')
  })
})

describe('person: immutable list ops', () => {
  const base: PersonBlock = { id: 'b', kind: 'person', role: 'speaker', people: [] }
  it('add/remove/patch never mutate the input', () => {
    const one = addPerson(base, { id: 'p1', firstName: 'A' })
    expect(base.people).toHaveLength(0)
    expect(one.people).toHaveLength(1)
    const patched = patchPerson(one, 'p1', { title: 'Brother' })
    expect(one.people[0].title).toBeUndefined()
    expect(patched.people[0].title).toBe('Brother')
    const removed = removePerson(patched, 'p1')
    expect(removed.people).toHaveLength(0)
    expect(patched.people).toHaveLength(1)
  })
})

describe('time: wall-clock ⇄ UTC round-trip', () => {
  const tz = 'America/Toronto'
  it('round-trips a summer (EDT) instant', () => {
    const iso = wallTimeToUtc('2026-07-15T19:30', tz)
    expect(iso).toBe('2026-07-15T23:30:00.000Z') // EDT = UTC-4
    expect(utcToWallTime(iso, tz)).toBe('2026-07-15T19:30')
  })
  it('round-trips a winter (EST) instant', () => {
    const iso = wallTimeToUtc('2026-01-15T19:30', tz)
    expect(iso).toBe('2026-01-16T00:30:00.000Z') // EST = UTC-5
    expect(utcToWallTime(iso, tz)).toBe('2026-01-15T19:30')
  })
  it('blank/invalid → undefined / empty', () => {
    expect(wallTimeToUtc('', tz)).toBeUndefined()
    expect(utcToWallTime(undefined, tz)).toBe('')
  })
  it('utcToWallParts splits date and time', () => {
    const iso = wallTimeToUtc('2026-07-15T19:30', tz)
    expect(utcToWallParts(iso, tz)).toEqual({ date: '2026-07-15', time: '19:30' })
    expect(utcToWallParts(undefined, tz)).toEqual({ date: '', time: '' })
  })
  it('combineWall defaults a missing time to midnight, blank date → empty', () => {
    expect(combineWall('2026-07-15', '')).toBe('2026-07-15T00:00')
    expect(combineWall('2026-07-15', '09:00')).toBe('2026-07-15T09:00')
    expect(combineWall('', '09:00')).toBe('')
  })
})

describe('link: looksLikeUrl / normalizeUrl', () => {
  it('recognizes schemes and bare domains', () => {
    expect(looksLikeUrl('https://example.com')).toBe(true)
    expect(looksLikeUrl('example.com')).toBe(true)
    expect(looksLikeUrl('example.com/register')).toBe(true)
    expect(looksLikeUrl('mailto:a@b.com')).toBe(true)
  })
  it('rejects prose', () => {
    expect(looksLikeUrl('our website')).toBe(false)
    expect(looksLikeUrl('register here')).toBe(false)
    expect(looksLikeUrl('')).toBe(false)
  })
  it('prepends https:// only to bare domains', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com')
    expect(normalizeUrl('https://example.com')).toBe('https://example.com')
    expect(normalizeUrl('mailto:a@b.com')).toBe('mailto:a@b.com')
    expect(normalizeUrl('  example.com/x ')).toBe('https://example.com/x')
    expect(normalizeUrl('')).toBe('')
  })
})

describe('flyer: isImageMime / hasFlyerImage', () => {
  const flyer = (fileUrl: string): FlyerBlock => ({
    id: 'f',
    kind: 'flyer',
    document: {
      id: 'd',
      documentType: 'upload',
      fileName: '',
      originalName: '',
      fileUrl,
      fileSize: 0,
      mimeType: '',
      uploadedAt: new Date(0),
      uploadedBy: '',
    },
  })
  it('recognizes image MIME types (case-insensitive), rejects others/blank', () => {
    expect(isImageMime('image/png')).toBe(true)
    expect(isImageMime('IMAGE/JPEG')).toBe(true)
    expect(isImageMime('application/pdf')).toBe(false)
    expect(isImageMime('')).toBe(false)
    expect(isImageMime(undefined)).toBe(false)
  })
  it('hasFlyerImage is false for a blank document, true once a fileUrl is set', () => {
    expect(hasFlyerImage(flyer(''))).toBe(false)
    expect(hasFlyerImage(flyer('   '))).toBe(false)
    expect(hasFlyerImage(flyer('https://cdn/x.png'))).toBe(true)
  })
})

describe('registration: parseFee / formatFee', () => {
  it('parses forgiving currency strings, drops blank/invalid/negative', () => {
    expect(parseFee('25')).toBe(25)
    expect(parseFee('$25.50')).toBe(25.5)
    expect(parseFee('1,200')).toBe(1200)
    expect(parseFee('  10 ')).toBe(10)
    expect(parseFee('')).toBeUndefined()
    expect(parseFee('free')).toBeUndefined()
    expect(parseFee('-5')).toBeUndefined()
  })
  it('formatFee renders the stored number, empty when unset', () => {
    expect(formatFee(25)).toBe('25')
    expect(formatFee(0)).toBe('0')
    expect(formatFee(undefined)).toBe('')
  })
})

describe('registration: deadline date ⇄ ISO', () => {
  const tz = 'America/Toronto'
  it('a date input becomes a start-of-day ISO in the zone, round-trips back', () => {
    const iso = deadlineDateToIso('2026-09-15', tz)
    expect(iso).toBe('2026-09-15T04:00:00.000Z') // EDT midnight = 04:00Z
    expect(isoToDeadlineDate(iso, tz)).toBe('2026-09-15')
  })
  it('blank date → undefined; undefined ISO → empty date', () => {
    expect(deadlineDateToIso('', tz)).toBeUndefined()
    expect(isoToDeadlineDate(undefined, tz)).toBe('')
  })
})
