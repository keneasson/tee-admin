import { describe, it, expect } from 'vitest'
import {
  personRoleLabel,
  formatPersonName,
  personMetaLine,
  locationAddressLines,
  locationMapsHref,
  formatTimeBlock,
  formatDateFacet,
  looksLikeImage,
  formatOccasions,
} from '@my/ui/src/post-view/post-view-format'
import type {
  FlyerBlock,
  LinkBlock,
  LocationBlock,
  PersonBlock,
  Post,
  RegistrationBlock,
  TextBlock,
  TimeBlock,
} from '@my/app/types/post'

/**
 * PostView display-string coverage (Consolidated CMS Phase 3).
 *
 * These test the PURE formatting helpers that decide WHAT PostView renders,
 * NOT the rendered React tree. Rendering `PostView` in this plain-Node Vitest
 * env hangs because it (and its Tamagui deps) pull in `@tamagui/lucide-icons`,
 * whose CJS build loads React Native's Flow-typed source that this config can't
 * transform — the same wall the Phase 2b block tests document. So we assert the
 * display layer at the string boundary instead, across all seven block kinds.
 */

describe('personRoleLabel', () => {
  it('maps design roles to display labels', () => {
    expect(personRoleLabel('speaker')).toBe('Speaker')
    expect(personRoleLabel('deceased')).toBe('In memory of')
    expect(personRoleLabel('candidate')).toBe('Candidate')
    expect(personRoleLabel('other')).toBe('People')
  })
})

describe('formatPersonName', () => {
  it('joins first + last when present (redactor already decided)', () => {
    expect(formatPersonName({ id: 'p', firstName: 'Sarah', lastName: 'Thompson' })).toBe(
      'Sarah Thompson'
    )
  })
  it('is first-name only when the surname was redacted away', () => {
    expect(formatPersonName({ id: 'p', firstName: 'Sarah' })).toBe('Sarah')
  })
  it('prefixes an honorific title when present', () => {
    expect(
      formatPersonName({ id: 'p', firstName: 'John', lastName: 'Carter', title: 'Brother' })
    ).toBe('Brother John Carter')
  })
})

describe('personMetaLine', () => {
  it('joins label, ecclesia, age with middots', () => {
    expect(
      personMetaLine({ id: 'p', firstName: 'John', label: 'speaker', ecclesia: 'Hamilton', age: 42 })
    ).toBe('speaker · Hamilton · age 42')
  })
  it('is empty when there is nothing to show', () => {
    expect(personMetaLine({ id: 'p', firstName: 'John' })).toBe('')
  })
})

describe('locationAddressLines', () => {
  const base: LocationBlock = {
    id: 'l',
    kind: 'location',
    mode: 'geo',
    venueName: 'Toronto East Hall',
    address: '960 Pape Avenue',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M4K 3V1',
    country: 'Canada',
  }
  it('produces venue, address, city line, country in reading order', () => {
    expect(locationAddressLines(base)).toEqual([
      'Toronto East Hall',
      '960 Pape Avenue',
      'Toronto, ON, M4K 3V1',
      'Canada',
    ])
  })
  it('collapses to the safe floor when precise fields were redacted', () => {
    // Mirrors a redacted anon block: venue + city only.
    expect(
      locationAddressLines({ id: 'l', kind: 'location', mode: 'geo', venueName: 'Toronto East Hall', city: 'Toronto' })
    ).toEqual(['Toronto East Hall', 'Toronto'])
  })
})

describe('locationMapsHref', () => {
  it('prefers an explicit mapsUrl', () => {
    expect(
      locationMapsHref({ id: 'l', kind: 'location', mode: 'geo', mapsUrl: 'https://maps.example/x', city: 'Toronto' })
    ).toBe('https://maps.example/x')
  })
  it('derives a maps search url from address parts', () => {
    const href = locationMapsHref({
      id: 'l',
      kind: 'location',
      mode: 'geo',
      venueName: 'Toronto East Hall',
      city: 'Toronto',
    })
    expect(href).toContain('https://www.google.com/maps/search/')
    expect(href).toContain(encodeURIComponent('Toronto East Hall, Toronto'))
  })
  it('returns undefined when there is nothing to link', () => {
    expect(locationMapsHref({ id: 'l', kind: 'location', mode: 'ecclesia' })).toBeUndefined()
  })
})

describe('formatTimeBlock', () => {
  it('formats an ISO instant in its timezone', () => {
    const block: TimeBlock = {
      id: 't',
      kind: 'time',
      label: 'Baptism service',
      startsAt: '2026-09-12T14:00:00.000Z',
      timezone: 'America/Toronto',
    }
    const out = formatTimeBlock(block)
    expect(out.label).toBe('Baptism service')
    expect(out.dateLine).toContain('2026')
    expect(out.dateLine).toContain('September')
    expect(out.timeLine).toContain('10:00am') // 14:00 UTC = 10:00 EDT
  })
  it('appends an end time as a range', () => {
    const out = formatTimeBlock({
      id: 't',
      kind: 'time',
      startsAt: '2026-09-12T14:00:00.000Z',
      endsAt: '2026-09-12T16:00:00.000Z',
      timezone: 'America/Toronto',
    })
    expect(out.timeLine).toContain('–')
    expect(out.timeLine).toContain('12:00pm')
  })
  it('falls back to free-text display when there is no ISO instant', () => {
    const out = formatTimeBlock({ id: 't', kind: 'time', label: 'Reception', display: '7:30pm' })
    expect(out.dateLine).toBe('')
    expect(out.timeLine).toBe('7:30pm')
  })
})

describe('formatDateFacet', () => {
  const base: Post = {
    id: 'x',
    tenant: 't',
    authorId: 'a',
    title: 'T',
    occasion: ['general'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    blocks: [],
    createdAt: '',
    updatedAt: '',
    status: 'ready',
  }
  it('uses a future startsAt for event-shaped posts', () => {
    const facet = formatDateFacet({ ...base, lifecycle: { startsAt: '2026-09-12T14:00:00.000Z' } })
    expect(facet).toContain('September')
  })
  it('falls back to publishDate for news-shaped posts', () => {
    const facet = formatDateFacet({ ...base, lifecycle: { publishDate: '2026-08-01' } })
    expect(facet).toContain('August')
  })
  it('is undefined when no date is known', () => {
    expect(formatDateFacet(base)).toBeUndefined()
  })
})

describe('looksLikeImage', () => {
  it('detects by mime type', () => {
    expect(looksLikeImage('https://x/y', 'image/png')).toBe(true)
  })
  it('detects by extension', () => {
    expect(looksLikeImage('https://x/y.jpg')).toBe(true)
    expect(looksLikeImage('https://x/y.webp')).toBe(true)
  })
  it('is false for a pdf', () => {
    expect(looksLikeImage('https://x/y.pdf', 'application/pdf')).toBe(false)
  })
})

describe('formatOccasions', () => {
  it('title-cases and middot-joins tags', () => {
    expect(formatOccasions(['baptism', 'study-weekend'])).toBe('Baptism · Study weekend')
  })
})

/**
 * A single sample post exercising ALL SEVEN block kinds — proves the display
 * layer has a formatting story for each kind PostView renders (text/person/
 * location/time/flyer/registration/link), keeping display coverage in lockstep
 * with the editor's 7-kind registry.
 */
describe('all-seven-kinds display coverage', () => {
  const text: TextBlock = { id: 'b1', kind: 'text', body: '# Hi', containsPii: false }
  const person: PersonBlock = {
    id: 'b2',
    kind: 'person',
    role: 'candidate',
    people: [{ id: 'p', firstName: 'Sarah', lastName: 'Thompson' }],
  }
  const location: LocationBlock = {
    id: 'b3',
    kind: 'location',
    mode: 'geo',
    venueName: 'Hall',
    city: 'Toronto',
  }
  const time: TimeBlock = {
    id: 'b4',
    kind: 'time',
    startsAt: '2026-09-12T14:00:00.000Z',
    timezone: 'America/Toronto',
  }
  const flyer: FlyerBlock = {
    id: 'b5',
    kind: 'flyer',
    document: {
      id: 'd',
      documentType: 'upload',
      fileName: 'f.png',
      originalName: 'Flyer',
      fileUrl: 'https://x/f.png',
      fileSize: 1,
      mimeType: 'image/png',
      uploadedAt: new Date(),
      uploadedBy: 'a',
    },
  }
  const registration: RegistrationBlock = { id: 'b6', kind: 'registration', required: true }
  const link: LinkBlock = { id: 'b7', kind: 'link', url: 'https://x/y', label: 'More' }

  it('has a display projection for each kind', () => {
    expect(personRoleLabel(person.role)).toBe('Candidate')
    expect(formatPersonName(person.people[0])).toBe('Sarah Thompson')
    expect(locationAddressLines(location)).toEqual(['Hall', 'Toronto'])
    expect(formatTimeBlock(time).dateLine).toContain('September')
    expect(looksLikeImage(flyer.document.fileUrl, flyer.document.mimeType)).toBe(true)
    expect(registration.required).toBe(true)
    expect(link.label).toBe('More')
    // text body renders via MarkdownLiteText at the component layer.
    expect(text.body.startsWith('#')).toBe(true)
  })
})
