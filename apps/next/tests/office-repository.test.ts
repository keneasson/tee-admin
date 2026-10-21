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
const flag = vi.hoisted(() => ({ on: true }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async () => flag.on),
}))

import { sharedFake as fake } from './fixtures/fake-dynamo'
import {
  OFFICE_ROLES,
  applyHolderChange,
  deriveOfficeFlags,
  diffRecipientAddresses,
  isTestAccountEmail,
  normalizeOfficeRole,
  officeRepository,
  resetOfficesAssignedCache,
  resolveInterEcclesiaContacts,
  withOfficeIndexes,
  type OfficeRecord,
} from '@my/app/provider/dynamodb/repositories/office-repository'
import { PersonRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { clearEcclesiaIdCache, resetPeopleIndexReadyCache, writeIndexMarker } from '@my/app/provider/dynamodb/people-index'
import { createEcclesia, findRecordingBrotherEcclesia, signInOfficeFlags } from '../utils/dynamodb/locations'

let n = 0
vi.mock('uuid', () => ({ v4: () => `uuid-${++n}` }))

const EID = 'toronto-east-ecclesia'
const persons = new PersonRepository()

beforeEach(() => {
  fake.reset()
  n = 0
  clearEcclesiaIdCache()
  resetPeopleIndexReadyCache()
  resetOfficesAssignedCache()
  flag.on = true
})

describe('office model (pure)', () => {
  it('normalizes office ids: one rb, slotted reps, other slugs', () => {
    expect(normalizeOfficeRole('Recording Brother')).toBe('rb')
    expect(normalizeOfficeRole('rb')).toBe('rb')
    expect(normalizeOfficeRole('Rep#2')).toBe('rep#2')
    expect(normalizeOfficeRole('Treasurer')).toBe('treasurer')
    expect(() => normalizeOfficeRole('  ')).toThrow()
    expect(() => normalizeOfficeRole('rep')).toThrow(/slot/)
    expect(() => normalizeOfficeRole('rb#2')).toThrow(/one Recording Brother/)
    expect(() => normalizeOfficeRole('rep#0')).toThrow(/slot/)
  })

  it('derives isRecordingBrother / isInterEcclesiaRep from the offices held', () => {
    expect(deriveOfficeFlags([])).toEqual({ isRecordingBrother: false, isInterEcclesiaRep: false, recordingBrotherOf: [], repOf: [] })
    expect(
      deriveOfficeFlags([
        { kind: 'rb', ecclesiaId: 'b' },
        { kind: 'rep', ecclesiaId: 'a' },
        { kind: 'rep', ecclesiaId: 'a' },
        { kind: 'treasurer', ecclesiaId: 'c' },
      ])
    ).toEqual({ isRecordingBrother: true, isInterEcclesiaRep: true, recordingBrotherOf: ['b'], repOf: ['a'] })
    // The Recording Brother receives inter-ecclesia email too.
    expect(deriveOfficeFlags([{ kind: 'rb', ecclesiaId: 'b' }])).toMatchObject({ isRecordingBrother: true, isInterEcclesiaRep: true })
    expect(deriveOfficeFlags([{ kind: 'treasurer', ecclesiaId: 'b' }])).toMatchObject({ isRecordingBrother: false, isInterEcclesiaRep: false })
  })

  it('test accounts are +hacker plus-tags only', () => {
    expect(isTestAccountEmail('someone+hacker@x.org')).toBe(true)
    expect(isTestAccountEmail('Someone+Hacker2@x.org')).toBe(true)
    expect(isTestAccountEmail('someone+123@x.org')).toBe(false)
    expect(isTestAccountEmail('hacker@x.org')).toBe(false)
    expect(isTestAccountEmail(undefined)).toBe(false)
  })

  it('inter-ecclesia contacts: office inbox first, else holder; test accounts and other offices never count', () => {
    const office = (role: string, extra: Partial<OfficeRecord> = {}): OfficeRecord =>
      withOfficeIndexes({
        pkey: `ECCLESIA_ID#${EID}`, skey: `OFFICE#${role}`, type: 'OFFICE', ecclesiaId: EID, role,
        kind: role.split('#')[0], title: role, terms: [], createdAt: 't0', updatedAt: 't0', version: 0, ...extra,
      })
    const cards = new Map([
      ['p1', { personId: 'p1', primaryEmail: 'Holder@x.org' }],
      ['p2', { personId: 'p2', primaryEmail: 'me+hacker@x.org' }],
    ])
    expect(
      resolveInterEcclesiaContacts(
        [
          office('rb', { email: 'recbro@x.org', holderPersonId: 'p1' }),
          office('rep#1', { holderPersonId: 'p1' }),
          office('rep#2', { holderPersonId: 'p2' }),
          office('rep#3', { email: 'x+hacker@x.org' }),
          office('treasurer', { email: 'treasurer@x.org' }),
        ],
        cards
      ).map((c) => [c.officeId, c.email, c.via])
    ).toEqual([
      ['rb', 'recbro@x.org', 'office'],
      ['rep#1', 'holder@x.org', 'holder'],
      ['rep#2', null, 'none'],
      ['rep#3', null, 'none'],
    ])
  })

  it('recipient diff is case-insensitive and ignores test accounts', () => {
    expect(diffRecipientAddresses(['A@x.org', 'b@x.org', 't+hacker@x.org'], ['a@x.org', 'c@x.org'])).toEqual({
      same: 1, onlyLegacy: ['b@x.org'], onlyOffices: ['c@x.org'],
    })
  })

  it('a holder change closes the open term and moves the holder index, never the contact channels', () => {
    const base = withOfficeIndexes({
      pkey: `ECCLESIA_ID#${EID}`, skey: 'OFFICE#treasurer', type: 'OFFICE', ecclesiaId: EID, role: 'treasurer', kind: 'treasurer',
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
    expect((await officeRepository.listOfficesHeldBy('p1')).map((o) => o.role).sort()).toEqual(['rb', 'treasurer'])

    await officeRepository.assignHolder(EID, 'treasurer', 'p2', 't2')
    expect((await officeRepository.listOfficesHeldBy('p1')).map((o) => o.role)).toEqual(['rb'])
    expect((await officeRepository.listOfficesHeldBy('p2')).map((o) => o.role)).toEqual(['treasurer'])
    expect((await officeRepository.findOfficesByEmail('Treasurer@x.org')).map((o) => o.holderPersonId)).toEqual(['p2'])
    expect((await officeRepository.listOffices(EID)).map((o) => o.role)).toEqual(['rb', 'treasurer'])
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
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'rb', email: 'recbro@x.org' })
    await writeIndexMarker({})
    expect((await findRecordingBrotherEcclesia('RecBro@x.org'))?.name).toBe('Toronto East Ecclesia')
    expect(await findRecordingBrotherEcclesia('nobody@x.org')).toBeNull()
  })

  it('every ecclesia gets one RB office; Reps take the next free slot', async () => {
    const rb = await officeRepository.ensureRecordingBrotherOffice(EID)
    expect(rb).toMatchObject({ skey: 'OFFICE#rb', kind: 'rb', title: 'Recording Brother' })
    expect(rb.holderPersonId).toBeUndefined()
    expect(await officeRepository.ensureRecordingBrotherOffice(EID)).toMatchObject({ version: rb.version })
    const r1 = await officeRepository.addRepOffice(EID, { email: 'rep1@x.org' })
    const r2 = await officeRepository.addRepOffice(EID)
    expect([r1.role, r1.slot, r1.title, r2.role, r2.slot, r2.title]).toEqual(['rep#1', 1, 'Rep', 'rep#2', 2, 'Rep 2'])
    expect((await officeRepository.listOffices(EID)).map((o) => o.role)).toEqual(['rb', 'rep#1', 'rep#2'])
  })

  it('listInterEcclesiaContacts reads the office inbox or the holder PROFILE, by Query + BatchGet', async () => {
    const p = await persons.create({ email: 'Holder@x.org', firstName: 'Hal', lastName: 'Der', ecclesia: 'Toronto East Ecclesia' })
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'rb', email: 'recbro@x.org' })
    await officeRepository.assignHolder(EID, 'rb', p.personId)
    const rep = await officeRepository.addRepOffice(EID)
    await officeRepository.assignHolder(EID, rep.role, p.personId)
    await officeRepository.addRepOffice(EID)
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'treasurer', email: 'treasurer@x.org' })
    fake.calls.length = 0
    expect((await officeRepository.listAllInterEcclesiaContacts([EID, EID])).map((c) => [c.officeId, c.email, c.via])).toEqual([
      ['rb', 'recbro@x.org', 'office'],
      ['rep#1', 'holder@x.org', 'holder'],
      ['rep#2', null, 'none'],
    ])
    expect(fake.calls.some((c) => c.op === 'Scan')).toBe(false)
  })

  it('sign-in flags come from offices only when the flag is on AND assignments are applied', async () => {
    const person = { personId: 'p1', isRecordingBrother: true, isInterEcclesiaRep: false }
    // Offices say: p1 holds a Rep office, not the RB office.
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'rep#1' })
    await officeRepository.assignHolder(EID, 'rep#1', 'p1')

    // No marker yet → stored person flags, even with the flag on.
    expect(await signInOfficeFlags(person, 'p1@x.org')).toEqual({ isRecordingBrother: true, isInterEcclesiaRep: false })

    await officeRepository.writeOfficesAssignedMarker({ offices: 1 })
    expect(await signInOfficeFlags(person, 'p1@x.org')).toEqual({ isRecordingBrother: false, isInterEcclesiaRep: true })

    // Signing in with the RB office's own inbox carries that office's designation.
    await officeRepository.saveOffice({ ecclesiaId: EID, role: 'rb', email: 'recbro@x.org' })
    expect(await signInOfficeFlags({ personId: 'mailbox' }, 'RecBro@x.org')).toEqual({ isRecordingBrother: true, isInterEcclesiaRep: true })

    // Test accounts never get an office designation.
    expect(await signInOfficeFlags(person, 'p1+hacker@x.org')).toEqual({ isRecordingBrother: false, isInterEcclesiaRep: false })

    // Flag off (the default) → stored flags.
    flag.on = false
    expect(await signInOfficeFlags(person, 'p1@x.org')).toEqual({ isRecordingBrother: true, isInterEcclesiaRep: false })
  })
})
