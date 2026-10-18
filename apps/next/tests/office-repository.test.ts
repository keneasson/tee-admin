/**
 * Offices are their own entity (#58): contact channels on the office, the
 * holder as a personId reference with a term history, person → offices by
 * Query. Exercised against the in-memory DynamoDB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const m = await import('./fixtures/fake-dynamo')
  return m.fakeLibDynamodb(m.sharedFake)
})
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async () => true),
}))

import { sharedFake as fake } from './fixtures/fake-dynamo'
import {
  OFFICE_ROLES,
  applyHolderChange,
  normalizeOfficeRole,
  officeRepository,
  withOfficeIndexes,
} from '@my/app/provider/dynamodb/repositories/office-repository'
import { PersonRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { clearEcclesiaIdCache, resetPeopleIndexReadyCache, writeIndexMarker } from '@my/app/provider/dynamodb/people-index'
import { createEcclesia, findRecordingBrotherEcclesia } from '../utils/dynamodb/locations'

let n = 0
vi.mock('uuid', () => ({ v4: () => `uuid-${++n}` }))

const EID = 'toronto-east-ecclesia'
const persons = new PersonRepository()

beforeEach(() => {
  fake.reset()
  n = 0
  clearEcclesiaIdCache()
  resetPeopleIndexReadyCache()
})

describe('office model (pure)', () => {
  it('normalizes roles to slugs', () => {
    expect(normalizeOfficeRole('Recording Brother')).toBe('recording-brother')
    expect(() => normalizeOfficeRole('  ')).toThrow()
  })

  it('a holder change closes the open term and moves the holder index, never the contact channels', () => {
    const base = withOfficeIndexes({
      pkey: `ECCLESIA_ID#${EID}`, skey: 'OFFICE#treasurer', type: 'OFFICE', ecclesiaId: EID, role: 'treasurer',
      title: 'Treasurer', email: 'treasurer@x.org', terms: [], createdAt: 't0', updatedAt: 't0', version: 0,
    })
    const a = applyHolderChange(base, 'p1', 't1')
    const b = applyHolderChange(a, 'p2', 't2')
    expect(b.terms).toEqual([{ personId: 'p1', from: 't1', to: 't2' }, { personId: 'p2', from: 't2' }])
    expect(b).toMatchObject({ holderPersonId: 'p2', holderSince: 't2', email: 'treasurer@x.org', gsi1pk: 'OFFICEHOLDER#p2', gsi3pk: 'OFFICEMAIL#treasurer@x.org' })
    expect(applyHolderChange(b, 'p2', 't3')).toBe(b)
    const vacant = applyHolderChange(b, null, 't4')
    expect(vacant.holderPersonId).toBeUndefined()
    expect(vacant.gsi1pk).toBeUndefined()
    expect(vacant.terms.at(-1)).toEqual({ personId: 'p2', from: 't2', to: 't4' })
  })
})

describe('officeRepository', () => {
  it('stores contact info on the office and only a reference to the holder', async () => {
    const p = await persons.create({ email: 'holder@x.org', firstName: 'Hal', lastName: 'Der', ecclesia: 'Toronto East Ecclesia' })
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'Treasurer', email: 'Treasurer@X.org', phone: '416-555-0000' })
    const office = await officeRepository.assignHolder(EID, OFFICE_ROLES.TREASURER, p.personId, 't1')

    expect(office).toMatchObject({ pkey: `ECCLESIA_ID#${EID}`, skey: 'OFFICE#treasurer', email: 'treasurer@x.org', holderPersonId: p.personId })
    expect(JSON.stringify(office)).not.toContain('holder@x.org')
    expect(JSON.stringify(office)).not.toContain('Hal')
    // The person record is untouched by the office: no office email lands on it.
    expect((await persons.getEmails(p.personId)).map((e) => e.email)).toEqual(['holder@x.org'])

    const withHolder = await officeRepository.getOfficeWithHolder(EID, 'treasurer')
    expect(withHolder?.holder?.displayName).toBe('Hal Der')
  })

  it('person → offices and inbox → office are Queries; the holder changes, the inbox stays', async () => {
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'recording-brother', email: 'recbro@x.org' })
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'treasurer', email: 'treasurer@x.org' })
    await officeRepository.assignHolder(EID, 'recording-brother', 'p1', 't1')
    await officeRepository.assignHolder(EID, 'treasurer', 'p1', 't1')
    expect((await officeRepository.listOfficesHeldBy('p1')).map((o) => o.role).sort()).toEqual(['recording-brother', 'treasurer'])

    await officeRepository.assignHolder(EID, 'treasurer', 'p2', 't2')
    expect((await officeRepository.listOfficesHeldBy('p1')).map((o) => o.role)).toEqual(['recording-brother'])
    expect((await officeRepository.listOfficesHeldBy('p2')).map((o) => o.role)).toEqual(['treasurer'])
    expect((await officeRepository.findOfficesByEmail('Treasurer@x.org')).map((o) => o.holderPersonId)).toEqual(['p2'])
    expect((await officeRepository.listOffices(EID)).map((o) => o.role)).toEqual(['recording-brother', 'treasurer'])
    expect(fake.calls.some((c) => c.op === 'Scan')).toBe(false)
  })

  it('saveOffice never changes the holder; assignHolder needs an existing office', async () => {
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'treasurer', email: 'a@x.org' })
    await officeRepository.assignHolder(EID, 'treasurer', 'p1', 't1')
    const updated = await officeRepository.saveOffice({ ecclesiaId: EID, role: 'treasurer', email: 'b@x.org' })
    expect(updated).toMatchObject({ holderPersonId: 'p1', email: 'b@x.org', gsi3pk: 'OFFICEMAIL#b@x.org' })
    expect(await officeRepository.findOfficesByEmail('a@x.org')).toEqual([])
    await expect(officeRepository.assignHolder(EID, 'secretary', 'p1')).rejects.toThrow(/create it first/)
  })

  it('rejects a stale write, so concurrent holder changes cannot lose a term', async () => {
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'treasurer' })
    const stale = (await officeRepository.getOffice(EID, 'treasurer'))!
    await officeRepository.assignHolder(EID, 'treasurer', 'p1', 't1')
    const spy = vi.spyOn(officeRepository, 'getOffice').mockResolvedValueOnce(stale)
    await expect(officeRepository.assignHolder(EID, 'treasurer', 'p2', 't2')).rejects.toThrow(/conditional/i)
    spy.mockRestore()
    expect((await officeRepository.getOffice(EID, 'treasurer'))!.terms).toEqual([{ personId: 'p1', from: 't1' }])
  })

  it('sign-in RB lookup finds the ecclesia through the Recording Brother office inbox', async () => {
    await createEcclesia({ name: 'Toronto East Ecclesia', country: 'CA', province: 'ON', city: 'Toronto' })
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'recording-brother', email: 'recbro@x.org' })
    await writeIndexMarker({})
    expect((await findRecordingBrotherEcclesia('RecBro@x.org'))?.name).toBe('Toronto East Ecclesia')
    expect(await findRecordingBrotherEcclesia('nobody@x.org')).toBeNull()
  })
})
