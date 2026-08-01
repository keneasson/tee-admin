import { describe, it, expect } from 'vitest'
import { legacyToPost } from '@my/app/utils/legacy-to-post'
import { redactPost } from '@my/app/utils/redact-post'
import { ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import type { Event } from '@my/app/types/events'
import type { NewsItem } from '@my/app/types/news'
import type { LocationBlock, PersonBlock, TextBlock } from '@my/app/types/post'

const anon = ANONYMOUS_VIEWER
const member: Viewer = { assurance: 'authenticated', role: 'member', tenant: 'Toronto East', email: 'm@x.z' }

const baseEvent = {
  id: 'e1',
  createdBy: 'author',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  active: true,
  documents: [],
} as unknown as Event

function person(blocks: PersonBlock[], role: PersonBlock['role']) {
  return blocks.find((b) => b.role === role)
}

// ── Funeral ─────────────────────────────────────────────────────────────────
describe('legacyToPost — funeral', () => {
  const funeral = {
    ...baseEvent,
    type: 'funeral',
    title: 'Funeral of Tom Perks',
    serviceDate: new Date('2026-03-01T15:00:00Z'),
    deceased: { title: 'Brother', firstName: 'Tom', lastName: 'Perks', age: 84, obituary: 'obit text' },
    aboutDeceased: 'tribute text',
    description: 'Private family notes',
    documents: [{ id: 'd', documentType: 'upload', fileName: 'f', originalName: 'order.pdf', fileUrl: 'u', fileSize: 1, mimeType: 'application/pdf', uploadedAt: new Date(), uploadedBy: 'x' }],
    locations: {
      service: { name: 'Toronto East Hall', city: 'Toronto', province: 'ON', address: '123 Main St', postalCode: 'M1 1M1' },
      visitation: { name: 'The Perks home', address: '5 Elm Ave', privateResidence: true },
    },
  } as unknown as Event

  const post = legacyToPost(funeral)
  const persons = post.blocks.filter((b): b is PersonBlock => b.kind === 'person')
  const locations = post.blocks.filter((b): b is LocationBlock => b.kind === 'location')

  it('maps deceased → PersonBlock with name + bio(obituary+about) + title + age', () => {
    const d = person(persons, 'deceased')!
    expect(d.people[0].firstName).toBe('Tom')
    expect(d.people[0].lastName).toBe('Perks')
    expect(d.people[0].title).toBe('Brother')
    expect(d.people[0].age).toBe(84)
    expect(d.people[0].bio).toContain('tribute text')
    expect(d.people[0].bio).toContain('obit text')
  })

  it('funeral → PII-bearing occasion → description text + flyer default to members reach', () => {
    const text = post.blocks.find((b): b is TextBlock => b.kind === 'text')!
    expect(text.visibility).toBe('members')
    expect(text.containsPii).toBe(true)
    const flyer = post.blocks.find((b) => b.kind === 'flyer')!
    expect(flyer.visibility).toBe('members')
  })

  it('maps FuneralLocations → labelled LocationBlocks; private residence flagged', () => {
    const service = locations.find((l) => l.label === 'Service')!
    expect(service.address).toBe('123 Main St')
    const visitation = locations.find((l) => l.label === 'Visitation')!
    expect(visitation.privateResidence).toBe(true)
  })

  it('redacted for anon: first name only, bio dropped, private residence + members blocks removed', () => {
    const r = redactPost(post, anon)!
    const d = r.blocks.filter((b): b is PersonBlock => b.kind === 'person').find((b) => b.role === 'deceased')!
    expect(d.people[0]).not.toHaveProperty('lastName')
    expect(d.people[0]).not.toHaveProperty('bio')
    // private-residence visitation dropped; service floored to venue+city
    const locs = r.blocks.filter((b): b is LocationBlock => b.kind === 'location')
    expect(locs.map((l) => l.label)).toEqual(['Service'])
    expect(locs[0]).not.toHaveProperty('address')
    // members-only text + flyer removed
    expect(r.blocks.some((b) => b.kind === 'text')).toBe(false)
    expect(r.blocks.some((b) => b.kind === 'flyer')).toBe(false)
  })

  it('newsletter-email channel = member tier: full names, full location, bio, members blocks kept', () => {
    const r = redactPost(post, anon, { channel: 'newsletter-email' })!
    const d = r.blocks.filter((b): b is PersonBlock => b.kind === 'person').find((b) => b.role === 'deceased')!
    expect(d.people[0].lastName).toBe('Perks')
    expect(d.people[0].bio).toContain('obit text')
    const locs = r.blocks.filter((b): b is LocationBlock => b.kind === 'location')
    expect(locs.map((l) => l.label).sort()).toEqual(['Service', 'Visitation'])
    expect(locs.find((l) => l.label === 'Service')!.address).toBe('123 Main St')
    expect(r.blocks.some((b) => b.kind === 'text')).toBe(true)
    expect(r.blocks.some((b) => b.kind === 'flyer')).toBe(true)
  })
})

// ── Baptism ──────────────────────────────────────────────────────────────────
describe('legacyToPost — baptism', () => {
  const baptism = {
    ...baseEvent,
    type: 'baptism',
    title: 'Baptism',
    baptismDate: new Date('2026-09-01T18:00:00Z'),
    candidate: { firstName: 'Joshua', lastName: 'Archibald', testimony: 'my testimony', baptismStatement: 'stmt' },
    aboutCandidate: 'A private bio',
    sponsors: [{ firstName: 'Gord', lastName: 'Easson', role: 'proposer' }],
    location: { name: 'TE Hall', city: 'Toronto', address: '123 Main St' },
  } as unknown as Event

  const post = legacyToPost(baptism)
  const persons = post.blocks.filter((b): b is PersonBlock => b.kind === 'person')

  it('occasion is baptism', () => {
    expect(post.occasion).toEqual(['baptism'])
  })

  it('candidate → PersonBlock with bio combining about + testimony + statement', () => {
    const c = person(persons, 'candidate')!
    expect(c.people[0].firstName).toBe('Joshua')
    expect(c.people[0].bio).toContain('A private bio')
    expect(c.people[0].bio).toContain('my testimony')
    expect(c.people[0].bio).toContain('stmt')
  })

  it('sponsors → PersonBlock with sub-role label', () => {
    const s = person(persons, 'sponsor')!
    expect(s.people[0]).toMatchObject({ firstName: 'Gord', lastName: 'Easson', label: 'proposer' })
  })

  it('redacted for anon: candidate first-name only, bio gone', () => {
    const r = redactPost(post, anon)!
    const c = r.blocks.filter((b): b is PersonBlock => b.kind === 'person').find((b) => b.role === 'candidate')!
    expect(c.people[0]).toEqual({ firstName: 'Joshua' })
  })
})

// ── Engagement ───────────────────────────────────────────────────────────────
describe('legacyToPost — engagement', () => {
  const engagement = {
    ...baseEvent,
    type: 'engagement',
    title: 'Engagement',
    engagementProposed: 'Brother Gord Easson',
    engagementTo: 'Sister Jessica Millar',
    engagementAnnouncement: 'We are pleased to announce…',
  } as unknown as Event

  const post = legacyToPost(engagement)

  it('free-text engagement names → members-only TextBlock (containsPii)', () => {
    const text = post.blocks.find((b): b is TextBlock => b.kind === 'text')!
    expect(text.visibility).toBe('members')
    expect(text.containsPii).toBe(true)
    expect(text.body).toContain('Gord Easson')
    expect(text.body).toContain('Jessica Millar')
  })

  it('anon sees no engagement text at all', () => {
    const r = redactPost(post, anon)!
    expect(r.blocks.some((b) => b.kind === 'text')).toBe(false)
  })

  it('member sees the engagement text', () => {
    const r = redactPost(post, member)!
    expect(r.blocks.some((b) => b.kind === 'text')).toBe(true)
  })
})

// ── News ─────────────────────────────────────────────────────────────────────
describe('legacyToPost — news', () => {
  const baseNews = {
    id: 'n1',
    ecclesiaId: 'Toronto East',
    authorId: 'author',
    title: 'Update',
    publishedAt: new Date('2026-05-01'),
    expiresAt: new Date('2026-05-22'),
    durationWeeks: 3,
    sharingScope: 'own',
    createdAt: new Date('2026-05-01'),
    updatedAt: new Date('2026-05-01'),
  } as unknown as NewsItem

  it('medical news → occasion [news,medical], body + flyer default members', () => {
    const item: NewsItem = { ...baseNews, category: 'medical', body: 'Sister Jane is in hospital', documents: [{ id: 'd', documentType: 'upload', fileName: 'f', originalName: 'x.pdf', fileUrl: 'u', fileSize: 1, mimeType: 'application/pdf', uploadedAt: new Date(), uploadedBy: 'x' }] }
    const post = legacyToPost(item)
    expect(post.occasion).toEqual(['news', 'medical'])
    const text = post.blocks.find((b): b is TextBlock => b.kind === 'text')!
    expect(text.visibility).toBe('members')
    expect(post.blocks.find((b) => b.kind === 'flyer')!.visibility).toBe('members')
    // anon sees neither body nor flyer
    const r = redactPost(post, anon)!
    expect(r.blocks).toHaveLength(0)
    // member sees both
    expect(redactPost(post, member)!.blocks).toHaveLength(2)
  })

  it('general news → occasion [news], body stays public', () => {
    const item: NewsItem = { ...baseNews, category: 'general', body: 'Hall repainted' }
    const post = legacyToPost(item)
    expect(post.occasion).toEqual(['news'])
    const text = post.blocks.find((b): b is TextBlock => b.kind === 'text')!
    expect(text.visibility).toBeUndefined()
    expect(text.containsPii).toBe(false)
    // anon still sees the body
    expect(redactPost(post, anon)!.blocks.some((b) => b.kind === 'text')).toBe(true)
  })

  it('maps news lifecycle from publishedAt/expiresAt', () => {
    const item: NewsItem = { ...baseNews, category: 'announcement', body: 'x' }
    const post = legacyToPost(item)
    expect(post.occasion).toEqual(['news', 'announcement'])
    expect(post.lifecycle.publishDate).toBe(new Date('2026-05-01').toISOString())
    expect(post.lifecycle.expiresAt).toBe(new Date('2026-05-22').toISOString())
    expect(post.tenant).toBe('Toronto East')
  })
})
