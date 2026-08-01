import { describe, it, expect } from 'vitest'
import { redactBlock, redactPost, canSee } from '@my/app/utils/redact-post'
import { ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import type {
  LinkBlock,
  LocationBlock,
  PersonBlock,
  Post,
  RegistrationBlock,
  TextBlock,
  TimeBlock,
} from '@my/app/types/post'

const anon = ANONYMOUS_VIEWER // anonymous / public-web
const member: Viewer = { assurance: 'authenticated', role: 'member', tenant: 'Toronto East', email: 'm@x.z' }
const admin: Viewer = { assurance: 'authenticated', role: 'admin', tenant: 'Toronto East', email: 'a@x.z' }
// A recognized (email-token) viewer — capped at member reach on the web, but the
// newsletter-email channel lifts them to member tier for PII.
const recognized: Viewer = { assurance: 'recognized', role: 'member', tenant: 'Toronto East', email: 'r@x.z' }

// ── PiiClass: name (PersonBlock) ─────────────────────────────────────────────
describe('redactBlock — PiiClass name (PersonBlock)', () => {
  const block: PersonBlock = {
    id: 'p1',
    kind: 'person',
    role: 'candidate',
    people: [{ firstName: 'Joshua', lastName: 'Archibald', ecclesia: 'Toronto East', title: 'Brother' }],
  }

  it('anon / public-web → first name only, no lastName on the object', () => {
    const r = redactBlock(block, anon) as PersonBlock
    expect(r.people[0]).toEqual({ firstName: 'Joshua', ecclesia: 'Toronto East', title: 'Brother' })
    expect(r.people[0]).not.toHaveProperty('lastName')
  })

  it('authenticated member → full name', () => {
    const r = redactBlock(block, member) as PersonBlock
    expect(r.people[0].lastName).toBe('Archibald')
  })

  it('newsletter-email channel → full name even for a recognized viewer', () => {
    const r = redactBlock(block, recognized, 'newsletter-email') as PersonBlock
    expect(r.people[0].lastName).toBe('Archibald')
  })
})

// ── PiiClass: bio (PersonBlock.bio) ──────────────────────────────────────────
describe('redactBlock — PiiClass bio', () => {
  const block: PersonBlock = {
    id: 'p2',
    kind: 'person',
    role: 'deceased',
    people: [{ firstName: 'Tom', lastName: 'Perks', bio: 'A long obituary', age: 84 }],
  }

  it('anon → bio omitted (name floored)', () => {
    const r = redactBlock(block, anon) as PersonBlock
    expect(r.people[0]).not.toHaveProperty('bio')
    expect(r.people[0]).toEqual({ firstName: 'Tom', age: 84 })
  })

  it('member → bio shown', () => {
    const r = redactBlock(block, member) as PersonBlock
    expect(r.people[0].bio).toBe('A long obituary')
  })

  it('newsletter-email → bio shown', () => {
    const r = redactBlock(block, recognized, 'newsletter-email') as PersonBlock
    expect(r.people[0].bio).toBe('A long obituary')
  })
})

// ── PiiClass: contact (PersonBlock.contact + RegistrationBlock) ──────────────
describe('redactBlock — PiiClass contact', () => {
  const person: PersonBlock = {
    id: 'p3',
    kind: 'person',
    role: 'contact',
    people: [{ firstName: 'Sue', lastName: 'Green', contact: '416-555-1212' }],
  }
  const reg: RegistrationBlock = {
    id: 'r1',
    kind: 'registration',
    required: true,
    registrationUrl: 'https://reg',
    contactEmail: 'sue@x.z',
    contactPhone: '416-555-1212',
  }

  it('anon → contact omitted from person', () => {
    const r = redactBlock(person, anon) as PersonBlock
    expect(r.people[0]).not.toHaveProperty('contact')
  })

  it('anon → registration email/phone dropped, url kept', () => {
    const r = redactBlock(reg, anon) as RegistrationBlock
    expect(r).not.toHaveProperty('contactEmail')
    expect(r).not.toHaveProperty('contactPhone')
    expect(r.registrationUrl).toBe('https://reg')
    expect(r.required).toBe(true)
  })

  it('member → contact + registration email/phone shown', () => {
    expect((redactBlock(person, member) as PersonBlock).people[0].contact).toBe('416-555-1212')
    const r = redactBlock(reg, member) as RegistrationBlock
    expect(r.contactEmail).toBe('sue@x.z')
    expect(r.contactPhone).toBe('416-555-1212')
  })

  it('newsletter-email → contact shown', () => {
    expect((redactBlock(person, recognized, 'newsletter-email') as PersonBlock).people[0].contact).toBe('416-555-1212')
  })
})

// ── PiiClass: location-precise (LocationBlock) ───────────────────────────────
describe('redactBlock — PiiClass location-precise', () => {
  const block: LocationBlock = {
    id: 'l1',
    kind: 'location',
    mode: 'geo',
    label: 'Service',
    venueName: 'Toronto East Hall',
    city: 'Toronto',
    province: 'ON',
    country: 'Canada',
    address: '123 Main St',
    postalCode: 'M1 1M1',
    lat: 43.7,
    lng: -79.3,
    directions: 'Turn left',
    mapsUrl: 'https://maps',
  }

  it('anon → venue + city/province/country only; street/geo dropped', () => {
    const r = redactBlock(block, anon) as LocationBlock
    expect(r.venueName).toBe('Toronto East Hall')
    expect(r.city).toBe('Toronto')
    expect(r.province).toBe('ON')
    expect(r.country).toBe('Canada')
    expect(r.label).toBe('Service')
    for (const k of ['address', 'postalCode', 'lat', 'lng', 'directions', 'mapsUrl']) {
      expect(r).not.toHaveProperty(k)
    }
  })

  it('member → full location', () => {
    const r = redactBlock(block, member) as LocationBlock
    expect(r.address).toBe('123 Main St')
    expect(r.lat).toBe(43.7)
  })

  it('newsletter-email → full location for a recognized viewer', () => {
    const r = redactBlock(block, recognized, 'newsletter-email') as LocationBlock
    expect(r.address).toBe('123 Main St')
  })

  it('private residence → block dropped entirely for anon (returns null)', () => {
    const home: LocationBlock = { id: 'l2', kind: 'location', mode: 'plain', venueName: 'The Smith home', address: '5 Elm', privateResidence: true }
    expect(redactBlock(home, anon)).toBeNull()
    expect(redactBlock(home, member)).not.toBeNull()
    expect(redactBlock(home, recognized, 'newsletter-email')).not.toBeNull()
  })
})

// ── PiiClass: none (TimeBlock / LinkBlock / TextBlock pass-through) ───────────
describe('redactBlock — PiiClass none passes through', () => {
  it('time block unchanged', () => {
    const t: TimeBlock = { id: 't1', kind: 'time', label: 'Baptism', startsAt: '2026-09-01T18:00:00Z', timezone: 'America/Toronto' }
    expect(redactBlock(t, anon)).toEqual(t)
  })
  it('link block unchanged', () => {
    const l: LinkBlock = { id: 'k1', kind: 'link', url: 'https://x', label: 'More' }
    expect(redactBlock(l, anon)).toEqual(l)
  })
  it('text block field passes through (protected by reach, not field scrub)', () => {
    const tb: TextBlock = { id: 'x1', kind: 'text', body: 'hello', containsPii: false }
    expect(redactBlock(tb, anon)).toEqual(tb)
  })
})

// ── redactPost reach gating ──────────────────────────────────────────────────
describe('redactPost — reach gating', () => {
  const base: Omit<Post, 'visibility' | 'blocks'> = {
    id: 'post1',
    tenant: 'Toronto East',
    authorId: 'author',
    title: 'Test',
    occasion: ['funeral'],
    sharingScope: 'own',
    lifecycle: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'ready',
  }

  it('post-level members visibility → anon gets null', () => {
    const post: Post = { ...base, visibility: 'members', blocks: [] }
    expect(redactPost(post, anon)).toBeNull()
    expect(redactPost(post, member)).not.toBeNull()
  })

  it('block-level members override → dropped for anon, kept for member', () => {
    const post: Post = {
      ...base,
      visibility: 'public',
      blocks: [
        { id: 'pub', kind: 'text', body: 'public copy', containsPii: false },
        { id: 'mem', kind: 'text', body: 'members copy', containsPii: true, visibility: 'members' },
        { id: 'fly', kind: 'flyer', visibility: 'members', document: { id: 'd', documentType: 'upload', fileName: 'f', originalName: 'f.pdf', fileUrl: 'u', fileSize: 1, mimeType: 'application/pdf', uploadedAt: new Date(), uploadedBy: 'x' } },
      ],
    }
    const rAnon = redactPost(post, anon)!
    expect(rAnon.blocks.map((b) => b.id)).toEqual(['pub'])
    const rMember = redactPost(post, member)!
    expect(rMember.blocks.map((b) => b.id)).toEqual(['pub', 'mem', 'fly'])
  })

  it('newsletter-email channel lifts a recognized viewer to member reach', () => {
    const post: Post = {
      ...base,
      visibility: 'public',
      blocks: [{ id: 'mem', kind: 'text', body: 'members copy', containsPii: true, visibility: 'members' }],
    }
    // recognized on public web → member text dropped
    expect(redactPost(post, recognized)!.blocks).toHaveLength(0)
    // recognized via newsletter-email → member text kept
    expect(redactPost(post, recognized, { channel: 'newsletter-email' })!.blocks).toHaveLength(1)
  })

  it('admins-only block hidden from a member but shown to admin', () => {
    const post: Post = {
      ...base,
      visibility: 'public',
      blocks: [{ id: 'adm', kind: 'text', body: 'admin note', containsPii: false, visibility: 'admins' }],
    }
    expect(redactPost(post, member)!.blocks).toHaveLength(0)
    expect(redactPost(post, admin)!.blocks).toHaveLength(1)
  })
})

// ── canSee tier matrix ───────────────────────────────────────────────────────
describe('canSee', () => {
  it('public reachable by everyone', () => {
    expect(canSee('public', anon)).toBe(true)
  })
  it('members not reachable by anon on public web', () => {
    expect(canSee('members', anon)).toBe(false)
    expect(canSee('members', member)).toBe(true)
  })
  it('members reachable via newsletter-email regardless of viewer', () => {
    expect(canSee('members', anon, 'newsletter-email')).toBe(true)
  })
  it('admins reachable only by admin+', () => {
    expect(canSee('admins', member)).toBe(false)
    expect(canSee('admins', admin)).toBe(true)
    // newsletter-email caps at member tier, not admins
    expect(canSee('admins', anon, 'newsletter-email')).toBe(false)
  })
})
