/**
 * The projection writers stay in sync with their sources on every create,
 * update and delete — exercised through the REAL write paths
 * (`PersonRepository`, `locations.ts`) against an in-memory DynamoDB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const m = await import('./fixtures/fake-dynamo')
  return m.fakeLibDynamodb(m.sharedFake)
})
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async () => flagState.signin),
}))
const flagState = vi.hoisted(() => ({ signin: false }))

let uuidCounter = 0
vi.mock('uuid', () => ({ v4: () => `id-${++uuidCounter}` }))

import { sharedFake as fake } from './fixtures/fake-dynamo'
import { PersonRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import {
  clearEcclesiaIdCache,
  getEcclesiaOffices,
  getOfficesHeldBy,
  getPeopleCards,
  listEcclesiaDirectory,
  listPeopleCards,
  listPeopleCardsByEcclesiaId,
  refreshPersonProjections,
  resetPeopleIndexReadyCache,
  searchPeopleByNamePrefix,
  writeIndexMarker,
} from '@my/app/provider/dynamodb/people-index'
import {
  createEcclesia,
  deleteEcclesia,
  findRecordingBrotherEcclesia,
  getAllEcclesia,
  updateEcclesia,
  updateEcclesiaFields,
} from '../utils/dynamodb/locations'
import { loadDirectoryPeople } from '../app/api/people/load-directory'

const repo = new PersonRepository()
const projectionKeys = (pkey: string) =>
  fake
    .items()
    .filter((i) => i.pkey === pkey && (i.skey === 'CARD' || i.skey.startsWith('NAMETOK#') || i.skey.startsWith('OFFICE#')))
    .map((i) => i.skey)
    .sort()

beforeEach(() => {
  fake.reset()
  uuidCounter = 0
  clearEcclesiaIdCache()
  resetPeopleIndexReadyCache()
  flagState.signin = false
  delete process.env.PEOPLE_INDEX_WRITES
  delete process.env.PEOPLE_INDEX_READS
})

async function seedEcclesia(name = 'Toronto East Ecclesia', city = 'Toronto') {
  return createEcclesia({ name, country: 'CA', province: 'ON', city })
}

describe('person projections follow every person write', () => {
  it('create → CARD + name tokens; findable by typeahead, roster and ecclesia', async () => {
    await seedEcclesia()
    const p = await repo.create({ email: 'Jo@Example.org', firstName: 'Joanna', lastName: 'Smith', ecclesia: 'Toronto East Ecclesia' })

    expect(projectionKeys(`PERSON#${p.personId}`)).toEqual(['CARD', 'NAMETOK#joanna', 'NAMETOK#smith'])
    const [card] = await listPeopleCards()
    expect(card).toMatchObject({ personId: p.personId, primaryEmail: 'jo@example.org', ecclesiaId: 'toronto-east-ecclesia' })
    expect(card.emails).toEqual([expect.objectContaining({ email: 'jo@example.org', emailType: 'primary' })])
    expect((await listPeopleCardsByEcclesiaId('toronto-east-ecclesia')).map((c) => c.personId)).toEqual([p.personId])
    expect((await searchPeopleByNamePrefix('smi jo')).map((m) => m.personId)).toEqual([p.personId])
    expect(await searchPeopleByNamePrefix('smi ann')).toEqual([])
  })

  it('rename replaces the old name tokens and re-sorts the card', async () => {
    const p = await repo.create({ email: 'a@x.org', firstName: 'Ann', lastName: 'Lee', ecclesia: 'Elsewhere' })
    await repo.updatePerson(p.personId, { firstName: 'Anna', lastName: 'Park' })

    expect(projectionKeys(`PERSON#${p.personId}`)).toEqual(['CARD', 'NAMETOK#anna', 'NAMETOK#park'])
    expect(await searchPeopleByNamePrefix('lee')).toEqual([])
    expect((await getPeopleCards([p.personId])).get(p.personId)).toMatchObject({ displayName: 'Anna Park', gsi4sk: `park#anna#${p.personId}` })
  })

  it('phone and email changes reach the card', async () => {
    const p = await repo.create({ email: 'b@x.org', firstName: 'Ben', lastName: 'Ng', ecclesia: 'Elsewhere' })
    const phone = await repo.addPhone(p.personId, { type: 'mobile', number: '416-555-0101' })
    await repo.addEmail(p.personId, { email: 'Ben.Work@x.org', emailType: 'secondary', order: 1, verified: false, sesSubscribed: false, sesStatus: 'active' })
    let card = (await getPeopleCards([p.personId])).get(p.personId)!
    expect(card.phoneDigits).toEqual(['4165550101'])
    expect(card.emails.map((e) => e.email)).toEqual(['b@x.org', 'ben.work@x.org'])

    await repo.markEmailSesStatusByAddress('ben.work@x.org', 'bounced')
    await repo.deletePhone(p.personId, phone.phoneId)
    card = (await getPeopleCards([p.personId])).get(p.personId)!
    expect(card.phoneDigits).toEqual([])
    expect(card.emails.find((e) => e.email === 'ben.work@x.org')?.sesStatus).toBe('bounced')
  })

  it('a base update/delete (not a named method) still refreshes', async () => {
    const p = await repo.create({ email: 'c@x.org', firstName: 'Cy', lastName: 'Ro', ecclesia: 'Elsewhere' })
    await repo.update(`PERSON#${p.personId}`, 'PROFILE', { role: 'admin' })
    expect((await getPeopleCards([p.personId])).get(p.personId)?.role).toBe('admin')

    await repo.delete(`PERSON#${p.personId}`, 'PROFILE')
    expect(projectionKeys(`PERSON#${p.personId}`)).toEqual([])
    expect(await listPeopleCards()).toEqual([])
  })

  it('REP office references move with the person and vanish when cleared', async () => {
    await seedEcclesia('Cambridge Ecclesia', 'Cambridge')
    await seedEcclesia('Guelph Ecclesia', 'Guelph')
    const p = await repo.create({ email: 'r@x.org', firstName: 'Rae', lastName: 'Po', ecclesia: 'Cambridge Ecclesia' })

    await repo.setInterEcclesiaRep(p.personId, true)
    expect(await getEcclesiaOffices('cambridge-ecclesia', 'REP')).toEqual([expect.objectContaining({ personId: p.personId })])
    expect(await getOfficesHeldBy(p.personId)).toEqual([expect.objectContaining({ office: 'REP', ecclesiaId: 'cambridge-ecclesia' })])

    await repo.updatePerson(p.personId, { ecclesia: 'Guelph Ecclesia' })
    expect(await getEcclesiaOffices('cambridge-ecclesia')).toEqual([])
    expect(await getEcclesiaOffices('guelph-ecclesia', 'REP')).toHaveLength(1)

    await repo.setInterEcclesiaRep(p.personId, false)
    expect(await getEcclesiaOffices('guelph-ecclesia')).toEqual([])
    expect(await getOfficesHeldBy(p.personId)).toEqual([])
  })

  it('never writes a source item, and a re-run is a no-op', async () => {
    const p = await repo.create({ email: 'd@x.org', firstName: 'Di', lastName: 'Al', ecclesia: 'Elsewhere' })
    const sourceBefore = fake.items().filter((i) => ['PROFILE'].includes(i.skey) || i.skey.startsWith('EMAIL#'))
    fake.calls.length = 0
    const diff = await refreshPersonProjections(p.personId)
    expect(diff).toEqual({ puts: [], deletes: [], unchanged: 3 })
    expect(fake.calls.filter((c) => c.op === 'Put' || c.op === 'Delete' || c.op === 'Update')).toEqual([])
    expect(fake.items().filter((i) => ['PROFILE'].includes(i.skey) || i.skey.startsWith('EMAIL#'))).toEqual(sourceBefore)
  })

  it('PEOPLE_INDEX_WRITES=off stops the writer', async () => {
    process.env.PEOPLE_INDEX_WRITES = 'off'
    const p = await repo.create({ email: 'e@x.org', firstName: 'Ed', lastName: 'Ox', ecclesia: 'Elsewhere' })
    expect(projectionKeys(`PERSON#${p.personId}`)).toEqual([])
  })
})

describe('ecclesia projections follow every ecclesia write', () => {
  it('create → directory entry; list by country without a Scan', async () => {
    await seedEcclesia()
    await createEcclesia({ name: 'Ann Arbor', country: 'US', province: 'MI', city: 'Ann Arbor' })
    expect((await listEcclesiaDirectory()).map((e) => e.ecclesiaId)).toEqual(['toronto-east-ecclesia', 'ann-arbor'])
    expect((await listEcclesiaDirectory({ country: 'US' })).map((e) => e.name)).toEqual(['Ann Arbor'])

    await writeIndexMarker({})
    fake.calls.length = 0
    const all = await getAllEcclesia()
    expect(all.map((e) => e.name).sort()).toEqual(['Ann Arbor', 'Toronto East Ecclesia'])
    expect(fake.calls.some((c) => c.op === 'Scan')).toBe(false)
  })

  it('before the backfill marker exists, reads stay on the legacy path', async () => {
    await seedEcclesia()
    fake.calls.length = 0
    await getAllEcclesia()
    expect(fake.calls.some((c) => c.op === 'Scan')).toBe(true)
  })

  it('rename keeps the stable id and re-points the alias', async () => {
    await seedEcclesia('Old Name', 'Barrie')
    await updateEcclesia('Old Name', { name: 'New Name', country: 'CA', province: 'ON', city: 'Barrie' })
    const dir = await listEcclesiaDirectory()
    expect(dir).toEqual([expect.objectContaining({ ecclesiaId: 'old-name', name: 'New Name', ecclesiaSkey: 'Barrie#New Name' })])
  })

  it('RB assignment writes both office halves and the sign-in email entry; clearing removes them', async () => {
    await seedEcclesia()
    const rb = await repo.create({ email: 'rb@x.org', firstName: 'Rob', lastName: 'Bee', ecclesia: 'Toronto East Ecclesia' })
    await updateEcclesiaFields('Toronto East Ecclesia', {
      recordingBrotherPersonId: rb.personId,
      recordingBrotherEmail: 'office@x.org',
      recordingBrotherName: 'Rob Bee',
    })
    expect(await getEcclesiaOffices('toronto-east-ecclesia', 'RB')).toEqual([expect.objectContaining({ personId: rb.personId })])
    expect(await getOfficesHeldBy(rb.personId)).toEqual([expect.objectContaining({ office: 'RB' })])

    // A person write never removes the ecclesia-owned RB reference.
    await repo.updatePerson(rb.personId, { firstName: 'Robert' })
    expect(await getOfficesHeldBy(rb.personId)).toHaveLength(1)

    // Sign-in lookup: legacy unless the flag is on and the index is built.
    await writeIndexMarker({})
    fake.calls.length = 0
    flagState.signin = true
    expect((await findRecordingBrotherEcclesia('Office@x.org'))?.name).toBe('Toronto East Ecclesia')
    expect(fake.calls.some((c) => c.op === 'Scan')).toBe(false)

    await updateEcclesiaFields('Toronto East Ecclesia', { recordingBrotherPersonId: '', recordingBrotherEmail: '', recordingBrotherName: '' })
    expect(await getEcclesiaOffices('toronto-east-ecclesia')).toEqual([])
    expect(await getOfficesHeldBy(rb.personId)).toEqual([])
    expect(await findRecordingBrotherEcclesia('office@x.org')).toBeNull()
  })

  it('delete removes the alias and RB references', async () => {
    await seedEcclesia()
    await updateEcclesiaFields('Toronto East Ecclesia', { recordingBrotherPersonId: 'p-rb' })
    await deleteEcclesia('Toronto East Ecclesia')
    expect(fake.items().filter((i) => i.pkey.startsWith('ECCLESIA_ID#') || i.skey.startsWith('OFFICE#'))).toEqual([])
  })
})

describe('directory reads (/api/people, /api/people/guests)', () => {
  it('use one card Query once the index is built, the legacy Scans before', async () => {
    const p = await repo.create({ email: 'f@x.org', firstName: 'Fay', lastName: 'Um', ecclesia: 'Elsewhere' })
    await repo.addPhone(p.personId, { type: 'mobile', number: '905-555-0199' })

    fake.calls.length = 0
    const before = await loadDirectoryPeople({ withPhones: true })
    expect(before.source).toBe('scan')
    expect(fake.calls.filter((c) => c.op === 'Scan')).toHaveLength(2)

    await writeIndexMarker({})
    resetPeopleIndexReadyCache()
    fake.calls.length = 0
    const after = await loadDirectoryPeople({ withPhones: true })
    expect(after.source).toBe('index')
    expect(fake.calls.some((c) => c.op === 'Scan')).toBe(false)
    expect(after.people).toEqual(before.people)
  })

  it('PEOPLE_INDEX_READS=off forces the legacy path', async () => {
    await writeIndexMarker({})
    process.env.PEOPLE_INDEX_READS = 'off'
    expect((await loadDirectoryPeople()).source).toBe('scan')
  })
})
