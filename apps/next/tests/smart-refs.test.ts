/**
 * Smart references (plan §0 R6): a post stores a person or ecclesia id; one
 * batch read resolves them, shaped per viewer tier (ADR-0005) and per the
 * person's own privacy. Exercised against the in-memory DynamoDB, through the
 * real writers (PersonRepository → CARD, createEcclesia → alias, officeRepository).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const m = await import('./fixtures/fake-dynamo')
  return m.fakeLibDynamodb(m.sharedFake)
})
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async () => true),
}))
// The global setup stubs NextResponse without headers; this route's
// Cache-Control is part of the contract, so use a minimal real-shaped one.
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) =>
      new Response(JSON.stringify(data), { status: init?.status ?? 200, headers: init?.headers }),
  },
}))
const viewerMock = vi.hoisted(() => ({ current: null as any }))
vi.mock('../utils/resolve-viewer', () => ({ resolveViewer: vi.fn(async () => viewerMock.current) }))

let n = 0
vi.mock('uuid', () => ({ v4: () => `uuid-${++n}` }))

import { sharedFake as fake } from './fixtures/fake-dynamo'
import { PersonRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { officeRepository } from '@my/app/provider/dynamodb/repositories/office-repository'
import { privacyRepository } from '@my/app/provider/dynamodb/repositories/privacy-repository'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { clearEcclesiaIdCache, resetPeopleIndexReadyCache, writeIndexMarker } from '@my/app/provider/dynamodb/people-index'
import { parseSmartRefs, resolvePostReferences, resolveSmartRefs } from '@my/app/services/smart-refs-service'
import { redactPost } from '@my/app/utils/redact-post'
import { storeReferences } from '@my/app/utils/post-references'
import { officeKind } from '@my/app/utils/smart-refs-shape'
import { ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import type { Post, RegistrationBlock } from '@my/app/types/post'
import type { SmartEcclesia, SmartPerson } from '@my/app/types/smart-refs'
import { createEcclesia } from '../utils/dynamodb/locations'
import { POST } from '../app/api/smart-refs/route'

const persons = new PersonRepository()
const EAST = 'Toronto East Ecclesia'
const WEST = 'Toronto West Ecclesia'
const EID = 'toronto-east-ecclesia'

const recognized: Viewer = { assurance: 'recognized', role: 'member', tenant: EAST, email: 'reader@example.org' }
const memberEast: Viewer = { assurance: 'authenticated', role: 'member', tenant: EAST, email: 'reader@example.org' }
const memberWest: Viewer = { assurance: 'authenticated', role: 'member', tenant: WEST, email: 'far@example.org' }
const guestEast: Viewer = { assurance: 'authenticated', role: 'guest', tenant: EAST, email: 'guest@example.org' }
const adminEast: Viewer = { assurance: 'authenticated', role: 'admin', tenant: EAST, email: 'admin@example.org' }

let ana: string // default privacy (ecclesia_and_connections), email + phone
let ben: string // phone private, email open to any signed-in reader
let rb: string // holds the Recording Brother office
let rep: string // holds a Rep office

async function seed() {
  await createEcclesia({ name: EAST, country: 'CA', province: 'ON', city: 'Toronto', venue: 'East Hall', address: '1 Hall St', postalCode: 'A1A 1A1' })
  ana = (await persons.create({ email: 'ana@example.org', firstName: 'Ana', lastName: 'Alpha', ecclesia: EAST, role: 'member' })).personId
  await persons.addPhone(ana, { type: 'mobile' as any, number: '555-0101' })
  ben = (await persons.create({ email: 'ben@example.org', firstName: 'Ben', lastName: 'Beta', ecclesia: EAST, role: 'member' })).personId
  await persons.addPhone(ben, { type: 'mobile' as any, number: '555-0202' })
  await privacyRepository.updatePrivacySettings('ben@example.org', { showPhone: 'private', showEmail: 'authenticated' } as any)
  rb = (await persons.create({ email: 'rb@example.org', firstName: 'Rob', lastName: 'Gamma', ecclesia: EAST, role: 'member' })).personId
  rep = (await persons.create({ email: 'rep@example.org', firstName: 'Rae', lastName: 'Delta', ecclesia: EAST, role: 'member' })).personId
  await officeRepository.saveOffice({ ecclesiaId: EID, role: 'recording-brother', email: 'recbro@example.org', phone: '555-0300' })
  await officeRepository.assignHolder(EID, 'recording-brother', rb, 't1')
  await officeRepository.saveOffice({ ecclesiaId: EID, role: 'inter-ecclesia-rep' })
  await officeRepository.assignHolder(EID, 'inter-ecclesia-rep', rep, 't1')
  await writeIndexMarker({})
}

beforeEach(async () => {
  fake.reset()
  n = 0
  clearEcclesiaIdCache()
  resetPeopleIndexReadyCache()
  await seed()
  fake.calls.length = 0
})

const person = async (id: string, viewer: Viewer) => (await resolveSmartRefs([{ type: 'person', id }], viewer))[0] as SmartPerson
const ecclesia = async (viewer: Viewer) => (await resolveSmartRefs([{ type: 'ecclesia', id: EID }], viewer))[0] as SmartEcclesia

describe('person reference, per tier', () => {
  it('anonymous: the first-name floor, every other field withheld for sign-in', async () => {
    const p = await person(ana, ANONYMOUS_VIEWER)
    expect(p).toEqual({
      type: 'person',
      id: ana,
      found: true,
      firstName: 'Ana',
      withheld: [
        { field: 'lastName', reason: 'sign-in' },
        { field: 'email', reason: 'sign-in' },
        { field: 'phone', reason: 'sign-in' },
      ],
    })
    expect(JSON.stringify(p)).not.toMatch(/Alpha|ana@example|555/)
  })

  it('recognized (email-link reader, same ecclesia): full name, email and phone (ADR-0005 full tier)', async () => {
    expect(await person(ana, recognized)).toMatchObject({
      firstName: 'Ana', lastName: 'Alpha', email: 'ana@example.org', phone: '555-0101', withheld: [],
    })
  })

  it("member: email and phone per the PERSON's privacy", async () => {
    expect(await person(ana, memberEast)).toMatchObject({ email: 'ana@example.org', phone: '555-0101', withheld: [] })
    // Ben: phone private, email open to any signed-in reader.
    const b = await person(ben, memberEast)
    expect(b).toMatchObject({ lastName: 'Beta', email: 'ben@example.org', withheld: [{ field: 'phone', reason: 'scope' }], canRequestContact: true })
    expect(b.phone).toBeUndefined()
  })

  it('member of another ecclesia: default privacy withholds contact for scope, unless the person connected with them', async () => {
    const p = await person(ana, memberWest)
    expect(p).toMatchObject({ lastName: 'Alpha', withheld: [{ field: 'email', reason: 'scope' }, { field: 'phone', reason: 'scope' }] })
    expect(p.email).toBeUndefined()
    fake.seed([{ pkey: 'USER#ana@example.org', skey: 'CONNECTION#far@example.org', status: 'active' }])
    expect(await person(ana, memberWest)).toMatchObject({ email: 'ana@example.org', phone: '555-0101', withheld: [] })
  })

  it('a guest account in the same ecclesia has no member standing', async () => {
    expect((await person(ana, guestEast)).withheld.map((w) => w.reason)).toEqual(['scope', 'scope'])
  })

  it('admin (same ecclesia) sees past privacy; a reader always sees themself', async () => {
    expect(await person(ben, adminEast)).toMatchObject({ email: 'ben@example.org', phone: '555-0202', withheld: [] })
    expect(await person(ben, { ...memberWest, email: 'ben@example.org' })).toMatchObject({ phone: '555-0202', withheld: [] })
  })

  it('unknown and suspicious people are not found', async () => {
    const odd = (await persons.create({ email: 'odd@example.org', firstName: 'Odd', lastName: 'One', ecclesia: EAST, role: 'member' })).personId
    await persons.updatePerson(odd, { role: 'suspicious' } as any)
    expect(await resolveSmartRefs([{ type: 'person', id: 'nobody' }, { type: 'person', id: odd }], adminEast)).toEqual([
      { type: 'person', id: 'nobody', found: false },
      { type: 'person', id: odd, found: false },
    ])
  })
})

describe('ecclesia reference, per tier', () => {
  it('anonymous: name, venue, city and office titles; holders at the first-name floor without their id', async () => {
    const e = await ecclesia(ANONYMOUS_VIEWER)
    expect(e).toMatchObject({
      type: 'ecclesia', id: EID, found: true, name: EAST,
      location: { venue: 'East Hall', city: 'Toronto', province: 'ON', country: 'CA' },
      withheld: [{ field: 'address', reason: 'sign-in' }, { field: 'postalCode', reason: 'sign-in' }],
    })
    expect(e.offices.map((o) => [o.kind, o.title, o.holder?.firstName])).toEqual([
      ['rb', 'Recording Brother', 'Rob'],
      ['rep', 'Inter-Ecclesia Representative', 'Rae'],
    ])
    expect(e.offices[0].withheld).toEqual([{ field: 'email', reason: 'sign-in' }, { field: 'phone', reason: 'sign-in' }])
    expect(e.offices[0].holder?.id).toBeUndefined()
    expect(JSON.stringify(e)).not.toMatch(/1 Hall St|recbro@|Gamma|rb@example|555-0300/)
  })

  it('member: street address, office channels, and RB/Rep holders as person references through the person tiers', async () => {
    const e = await ecclesia(memberEast)
    expect(e.location).toMatchObject({ address: '1 Hall St', postalCode: 'A1A 1A1' })
    expect(e.withheld).toEqual([])
    const [rbOffice, repOffice] = e.offices
    expect(rbOffice).toMatchObject({ officeId: 'recording-brother', email: 'recbro@example.org', phone: '555-0300', withheld: [] })
    expect(rbOffice.holder).toMatchObject({ id: rb, firstName: 'Rob', lastName: 'Gamma', email: 'rb@example.org' })
    expect(repOffice.holder).toMatchObject({ id: rep, lastName: 'Delta' })
  })

  it('office kinds read the same before and after the RB/Rep slot ids (#280)', () => {
    expect(['recording-brother', 'rb', 'inter-ecclesia-rep', 'rep#2', 'treasurer'].map((role) => officeKind({ role }))).toEqual([
      'rb', 'rb', 'rep', 'rep', 'treasurer',
    ])
    expect(officeKind({ role: 'rep#2', kind: 'rep' } as any)).toBe('rep')
  })

  it('an unknown ecclesia is not found', async () => {
    expect(await resolveSmartRefs([{ type: 'ecclesia', id: 'nowhere' }], memberEast)).toEqual([
      { type: 'ecclesia', id: 'nowhere', found: false },
    ])
  })
})

describe('a batch of mixed references', () => {
  it('resolves in request order with BatchGet + keyed Query only — no Scan', async () => {
    const results = await resolveSmartRefs(
      [{ type: 'person', id: ben }, { type: 'ecclesia', id: EID }, { type: 'person', id: 'nobody' }, { type: 'person', id: rb }],
      memberWest
    )
    expect(results.map((r) => [r.type, r.found])).toEqual([['person', true], ['ecclesia', true], ['person', false], ['person', true]])
    expect((results[0] as SmartPerson).email).toBe('ben@example.org') // 'authenticated' email reaches another ecclesia
    expect((results[3] as SmartPerson).email).toBeUndefined() // default privacy does not
    const ops = fake.calls.map((c) => c.op)
    expect(ops).not.toContain('Scan')
    expect(new Set(ops)).toEqual(new Set(['BatchGet', 'Query']))
    expect(ops.filter((o) => o === 'Query')).toHaveLength(1) // the ecclesia's offices
  })

  it('validates input: types, ids, size; de-duplicates', () => {
    expect(parseSmartRefs([{ type: 'person', id: 'a' }, { type: 'person', id: 'a' }, { type: 'ecclesia', id: 'a' }])).toEqual({
      refs: [{ type: 'person', id: 'a' }, { type: 'ecclesia', id: 'a' }],
    })
    expect(parseSmartRefs('x')).toHaveProperty('error')
    expect(parseSmartRefs([{ type: 'office', id: 'a' }])).toHaveProperty('error')
    expect(parseSmartRefs([{ type: 'person', id: 'PERSON#a/../b' }])).toHaveProperty('error')
    expect(parseSmartRefs(Array.from({ length: 51 }, (_, i) => ({ type: 'person', id: `p${i}` })))).toHaveProperty('error')
  })
})

describe('POST /api/smart-refs', () => {
  const call = (body: unknown) =>
    POST(new Request('http://x/api/smart-refs', { method: 'POST', body: JSON.stringify(body) }) as any)

  it('answers per viewer, never cached', async () => {
    viewerMock.current = ANONYMOUS_VIEWER
    const res = await call({ refs: [{ type: 'person', id: ana }, { type: 'ecclesia', id: EID }] })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const body = await res.json()
    expect(body.indexReady).toBe(true)
    expect(body.results[0]).toMatchObject({ firstName: 'Ana' })
    expect(body.results[0].email).toBeUndefined()

    viewerMock.current = memberEast
    const member = await (await call({ refs: [{ type: 'person', id: ana }] })).json()
    expect(member.results[0]).toMatchObject({ email: 'ana@example.org', phone: '555-0101' })
  })

  it('rejects bad input', async () => {
    expect((await call({ refs: [{ type: 'nope', id: 'x' }] })).status).toBe(400)
    const bad = await POST(new Request('http://x/api/smart-refs', { method: 'POST', body: '{' }) as any)
    expect(bad.status).toBe(400)
  })

  it('before the people index is built: no results and says so (never a false "not found")', async () => {
    fake.reset()
    resetPeopleIndexReadyCache()
    viewerMock.current = memberEast
    expect(await (await call({ refs: [{ type: 'person', id: ana }] })).json()).toEqual({ results: [], indexReady: false })
  })
})

describe('registration contact stored as a reference', () => {
  const reg = (over: Partial<RegistrationBlock>): RegistrationBlock => ({ id: 'r1', kind: 'registration', ...over }) as RegistrationBlock

  it('a write drops the copied email/phone when the contact names a person; a hand-typed contact keeps its snapshot', () => {
    const [referenced, typed] = storeReferences([
      reg({ contactPerson: { firstName: 'Ana', personId: 'p1' }, contactEmail: 'ana@example.org', contactPhone: '1', contactWithheld: true }),
      reg({ id: 'r2', contactPerson: { firstName: 'Zed' }, contactEmail: 'zed@example.org' }),
    ])
    expect(referenced).toEqual(reg({ contactPerson: { firstName: 'Ana', personId: 'p1' } }))
    expect(typed).toEqual(reg({ id: 'r2', contactPerson: { firstName: 'Zed' }, contactEmail: 'zed@example.org' }))
  })

  it('postRepository stores the reference shape', async () => {
    const post = await postRepository.createPost({
      tenant: EAST, authorId: 'a', title: 'T', occasion: ['general'], visibility: 'public',
      blocks: [reg({ contactPerson: { firstName: 'Ana', personId: ana }, contactEmail: 'old@example.org' })],
    } as any)
    const stored = (await postRepository.getPost(post.id))!.blocks[0] as RegistrationBlock
    expect(stored.contactEmail).toBeUndefined()
    expect(stored.contactPerson?.personId).toBe(ana)
  })

  const postWith = (block: RegistrationBlock): Post =>
    ({ id: 'post1', tenant: EAST, authorId: 'a', title: 'T', occasion: ['general'], visibility: 'public', lifecycle: {}, blocks: [block], createdAt: 't', updatedAt: 't', status: 'published' }) as any

  it('a read fills the contact from the person for the viewer, then redaction runs as before', async () => {
    const post = postWith(reg({ contactPerson: { firstName: 'Ana', personId: ana } }))

    const member = redactPost(await resolvePostReferences(post, memberEast), memberEast)!
    expect(member.blocks[0]).toMatchObject({ contactPerson: { firstName: 'Ana', lastName: 'Alpha', personId: ana }, contactEmail: 'ana@example.org', contactPhone: '555-0101' })
    expect(member.withheld).toBeUndefined()

    const anon = redactPost(await resolvePostReferences(post, ANONYMOUS_VIEWER), ANONYMOUS_VIEWER)!
    expect(anon.blocks[0]).toEqual(reg({ contactPerson: { firstName: 'Ana' }, contactWithheld: true, contactWithheldReason: 'sign-in' }))
    expect(anon.withheld).toEqual(['contact'])

    const far = redactPost(await resolvePostReferences(post, memberWest), memberWest)!
    expect(far.blocks[0]).toMatchObject({ contactWithheld: true, contactWithheldReason: 'scope' })
    expect((far.blocks[0] as RegistrationBlock).contactEmail).toBeUndefined()
    expect(far.withheld).toBeUndefined() // signing in would not help: no sign-in banner
  })

  it('a post with no references, or before the index exists, reads exactly as stored', async () => {
    const snapshot = postWith(reg({ contactPerson: { firstName: 'Zed' }, contactEmail: 'zed@example.org' }))
    fake.calls.length = 0
    expect(await resolvePostReferences(snapshot, memberEast)).toBe(snapshot)
    expect(fake.calls).toHaveLength(0)

    fake.reset()
    resetPeopleIndexReadyCache()
    const referenced = postWith(reg({ contactPerson: { firstName: 'Ana', personId: ana } }))
    expect(await resolvePostReferences(referenced, memberEast)).toBe(referenced)
  })
})
