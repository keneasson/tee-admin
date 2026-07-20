import { describe, it, expect } from 'vitest'
import { redactEventForViewer } from '@my/app/utils/redact-event'
import { ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import type { Event } from '@my/app/types/events'

const member: Viewer = { assurance: 'authenticated', role: 'member', tenant: 'Toronto East', email: 'm@x.z' }
const recognized: Viewer = { assurance: 'recognized', role: 'member', tenant: 'Toronto East', email: 'r@x.z' }

// A PII-dense event (baptism + funeral + wedding fields on one object for coverage).
const event = {
  id: 'e1',
  title: 'Test',
  type: 'baptism',
  candidate: { firstName: 'Joshua', lastName: 'Archibald', testimony: 'secret', baptismStatement: 'secret' },
  aboutCandidate: 'A long private bio',
  candidatePhoto: { url: 'http://x/p.jpg', fileName: 'p.jpg', originalName: 'p.jpg' },
  sponsors: [{ firstName: 'Gord', lastName: 'Easson', role: 'proposer' }],
  deceased: { firstName: 'Tom', lastName: 'Perks', obituary: 'obit text' },
  aboutDeceased: 'tribute text',
  couple: { bride: { firstName: 'Jess', lastName: 'Millar' }, groom: { firstName: 'Gord', lastName: 'Easson' } },
  weddingParty: [{ firstName: 'Sam', lastName: 'Jones', role: 'best man' }],
  speakers: [
    { firstName: 'Pete', lastName: 'Skariah', ecclesia: 'Toronto West' },
    { firstName: 'Jo', lastName: 'Vance', ecclesia: { name: 'Verdugo Hills', city: 'LA', province: 'CA', country: 'US', address: '10210 Commerce Ave', postalCode: '91042' } },
  ],
  engagementProposed: 'Brother Gord Easson',
  engagementTo: 'Sister Jessica Millar',
  engagementAnnouncement: 'We are pleased to announce…',
  location: { name: 'TE Hall', city: 'Toronto', province: 'ON', address: '123 Main St', postalCode: 'M1 1M1', lat: 43.7, lng: -79.3 },
  registration: { required: true, contactEmail: 'sue@x.z', contactPhone: '416-555-1212', registrationUrl: 'http://reg' },
} as unknown as Event

describe('redactEventForViewer — anonymous (public web)', () => {
  const r = redactEventForViewer(event, ANONYMOUS_VIEWER)

  it('keeps first names, drops last names everywhere', () => {
    expect(r.candidate).toEqual({ firstName: 'Joshua' })
    expect((r.candidate as any).lastName).toBeUndefined()
    expect(r.deceased).toEqual({ firstName: 'Tom' })
    expect(r.sponsors).toEqual([{ firstName: 'Gord', role: 'proposer' }])
    expect(r.couple).toEqual({ bride: { firstName: 'Jess' }, groom: { firstName: 'Gord' } })
    expect(r.weddingParty).toEqual([{ firstName: 'Sam', role: 'best man' }])
    expect(r.speakers![0]).toEqual({ firstName: 'Pete', ecclesia: 'Toronto West' })
  })

  it('floors an object-valued ecclesia to venue (drops its street address)', () => {
    const ec = (r.speakers![1] as any).ecclesia
    expect(ec).toEqual({ name: 'Verdugo Hills', city: 'LA', province: 'CA', country: 'US' })
    expect(ec).not.toHaveProperty('address')
    expect(ec).not.toHaveProperty('postalCode')
    expect((r.speakers![1] as any).lastName).toBeUndefined()
  })

  it('drops all bio / free-text / photo fields', () => {
    expect((r.candidate as any).testimony).toBeUndefined()
    expect((r.candidate as any).baptismStatement).toBeUndefined()
    expect((r as any).aboutCandidate).toBeUndefined()
    expect((r.deceased as any).obituary).toBeUndefined()
    expect((r as any).aboutDeceased).toBeUndefined()
    expect((r as any).engagementProposed).toBeUndefined()
    expect((r as any).engagementTo).toBeUndefined()
    expect((r as any).engagementAnnouncement).toBeUndefined()
    expect((r as any).candidatePhoto).toBeUndefined()
  })

  it('location floor = venue + city + province, no street/postal/geo', () => {
    expect(r.location).toEqual({ name: 'TE Hall', city: 'Toronto', province: 'ON' })
    expect((r.location as any).address).toBeUndefined()
    expect((r.location as any).postalCode).toBeUndefined()
    expect((r.location as any).lat).toBeUndefined()
  })

  it('drops registration contact details, keeps non-PII', () => {
    expect((r.registration as any).contactEmail).toBeUndefined()
    expect((r.registration as any).contactPhone).toBeUndefined()
    expect((r.registration as any).registrationUrl).toBe('http://reg')
  })

  it('does not mutate the original event', () => {
    expect((event.candidate as any).lastName).toBe('Archibald')
    expect((event.location as any).address).toBe('123 Main St')
  })
})

describe('redactEventForViewer — reveal tiers pass through unchanged', () => {
  it('authenticated member sees everything', () => {
    expect(redactEventForViewer(event, member)).toBe(event)
  })
  it('recognized recipient via newsletter-email sees everything', () => {
    expect(redactEventForViewer(event, recognized, 'newsletter-email')).toBe(event)
  })
  it('recognized on public web is redacted (first-name-only)', () => {
    const r = redactEventForViewer(event, recognized, 'public-web')
    expect(r.candidate).toEqual({ firstName: 'Joshua' })
  })
})
