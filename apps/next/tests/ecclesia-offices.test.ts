/**
 * R3: every Recording Brother reader goes through the office, the inter-ecclesia
 * send path can resolve from offices (flagged), rb-service writes the office,
 * and the offices page API shows every ecclesia's offices.
 * Exercised against the in-memory DynamoDB; SES is a stub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const m = await import('./fixtures/fake-dynamo')
  return m.fakeLibDynamodb(m.sharedFake)
})
const h = vi.hoisted(() => ({ flags: new Set<string>(), auth: vi.fn() }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async (flag: string) => h.flags.has(flag)),
}))
vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@aws-sdk/client-sesv2', () => {
  class Command {
    constructor(public input: any) {}
  }
  return {
    SESv2Client: vi.fn(() => ({ send: vi.fn() })),
    GetSuppressedDestinationCommand: class GetSuppressedDestinationCommand extends Command {},
    GetContactCommand: class GetContactCommand extends Command {},
  }
})
let n = 0
vi.mock('uuid', () => ({ v4: () => `uuid-${++n}` }))

import { sharedFake as fake } from './fixtures/fake-dynamo'
import { officeRepository, resetOfficesAssignedCache } from '@my/app/provider/dynamodb/repositories/office-repository'
import { PersonRepository } from '@my/app/provider/dynamodb/repositories/person-repository'
import { clearEcclesiaIdCache, resetPeopleIndexReadyCache } from '@my/app/provider/dynamodb/people-index'
import { FEATURE_FLAGS } from '@my/app/features/feature-flags/feature-flags'
import { createEcclesia, getEcclesiaByName } from '../utils/dynamodb/locations'
import { officesOf, recordingBrotherOf, recordingBrothersOf } from '../utils/ecclesia-offices'
import { interEcclesiaRecipientsFromOffices } from '../utils/email/inter-ecclesia-recipients'
import { clearRecordingBrother, setRecordingBrother } from '../utils/rb-service'
import { GET as getOffices } from '../app/api/admin/offices/route'

const persons = new PersonRepository()
const TEE = 'toronto-east-ecclesia'
const KEY = { pkey: 'ECCLESIA#CA|ON', skey: 'Toronto#Toronto East Ecclesia' }

async function seed() {
  await createEcclesia({ name: 'Toronto East Ecclesia', country: 'CA', province: 'ON', city: 'Toronto' })
  await createEcclesia({ name: 'Barrie Ecclesia', country: 'CA', province: 'ON', city: 'Barrie' })
  return { tee: (await getEcclesiaByName('Toronto East Ecclesia'))!, barrie: (await getEcclesiaByName('Barrie Ecclesia'))! }
}

/** The copied RB fields as prod still holds them (nothing writes them any more). */
function seedLegacyCopy(email: string, name: string) {
  const item = fake.items().find((i) => i.pkey === KEY.pkey && i.skey === KEY.skey)!
  fake.seed([{ ...item, recordingBrotherEmail: email, recordingBrotherName: name }])
}

beforeEach(() => {
  fake.reset()
  n = 0
  h.flags.clear()
  h.auth.mockReset()
  clearEcclesiaIdCache()
  resetPeopleIndexReadyCache()
  resetOfficesAssignedCache()
})

describe('recordingBrotherOf: the office decides', () => {
  it('holder name + office inbox (or the holder address) from the RB office', async () => {
    const { tee } = await seed()
    const p = await persons.create({ email: 'Hal@x.org', firstName: 'Hal', lastName: 'Der', ecclesia: tee.name })
    await officeRepository.saveOffice({ ecclesiaId: TEE, role: 'rb' })
    await officeRepository.assignHolder(TEE, 'rb', p.personId)
    expect(await recordingBrotherOf(tee)).toEqual({ personId: p.personId, name: 'Hal Der', email: 'hal@x.org', source: 'office' })

    await officeRepository.saveOffice({ ecclesiaId: TEE, role: 'rb', email: 'RecBro@x.org' })
    expect(await recordingBrotherOf(tee)).toMatchObject({ name: 'Hal Der', email: 'recbro@x.org', source: 'office' })
  })

  it('a vacant RB office with no inbox means no Recording Brother, even with a legacy copy', async () => {
    const { tee } = await seed()
    seedLegacyCopy('old-rb@x.org', 'Old RB')
    await officeRepository.ensureRecordingBrotherOffice(TEE)
    expect(await recordingBrotherOf(tee)).toBeNull()
  })

  it('no RB office yet: the legacy copy, only until the assignments are applied', async () => {
    const { tee, barrie } = await seed()
    seedLegacyCopy('Old-RB@x.org', 'Old RB')
    const before = await recordingBrothersOf([tee, barrie])
    expect(before.get(TEE)).toEqual({ email: 'old-rb@x.org', name: 'Old RB', source: 'legacy' })
    expect(before.get('barrie-ecclesia')).toBeNull()

    await officeRepository.writeOfficesAssignedMarker({})
    expect(await recordingBrotherOf(tee)).toBeNull()
    expect(fake.calls.some((c) => c.op === 'Scan')).toBe(false)
  })

  it('the ecclesia record carries no RB name/email any more', async () => {
    const { tee } = await seed()
    seedLegacyCopy('old-rb@x.org', 'Old RB')
    const read = await getEcclesiaByName('Toronto East Ecclesia')
    expect(JSON.stringify(read)).not.toContain('old-rb@x.org')
    expect(Object.keys(tee).some((k) => k.startsWith('recordingBrother'))).toBe(false)
  })

  it('officesOf lists the RB office first, then Reps by slot, with holder names', async () => {
    const { tee } = await seed()
    const p = await persons.create({ email: 'rep@x.org', firstName: 'Rhea', lastName: 'Rep', ecclesia: tee.name })
    const r2 = await officeRepository.addRepOffice(TEE, { email: 'rep-two@x.org' })
    const r1 = await officeRepository.saveOffice({ ecclesiaId: TEE, role: 'rep#3' })
    await officeRepository.assignHolder(TEE, r1.role, p.personId)
    await officeRepository.ensureRecordingBrotherOffice(TEE)
    const list = (await officesOf([tee])).get(TEE)!
    expect(list.map((o) => [o.officeId, o.holderName || null, o.email || null, o.emailVia])).toEqual([
      ['rb', null, null, 'none'],
      [r2.role, null, 'rep-two@x.org', 'office'],
      ['rep#3', 'Rhea Rep', 'rep@x.org', 'holder'],
    ])
  })
})

describe('rb-service writes the Recording Brother office', () => {
  it('set → holder + term; the ecclesia address on the office, never on the person; clear → vacant, the address stays', async () => {
    const { tee } = await seed()
    const p = await persons.create({ email: 'hal@x.org', firstName: 'Hal', lastName: 'Der', ecclesia: tee.name })
    await setRecordingBrother({
      ecclesiaName: tee.name,
      newPersonId: p.personId,
      emailPreference: 'ecclesia',
      rbEcclesiaEmail: 'RecBro@x.org',
      callerEmail: 'admin@x.org',
    })
    const office = (await officeRepository.getOffice(TEE, 'rb'))!
    expect(office).toMatchObject({ holderPersonId: p.personId, email: 'recbro@x.org' })
    expect(office.terms).toHaveLength(1)
    const ecclesiaItem = fake.items().find((i) => i.pkey === KEY.pkey && i.skey === KEY.skey)!
    expect(Object.keys(ecclesiaItem).some((k) => k.startsWith('recordingBrother'))).toBe(false)
    // R3: an office address is not a personal email; the flag is derived from the office.
    expect((await persons.getEmails(p.personId)).map((e) => e.email)).toEqual(['hal@x.org'])
    const held = (await persons.getById(p.personId))!
    expect(held.isRecordingBrother).toBe(true)
    expect(held.rbEcclesiaEmail).toBeUndefined()

    await clearRecordingBrother(tee.name)
    const vacant = (await officeRepository.getOffice(TEE, 'rb'))!
    expect(vacant.holderPersonId).toBeUndefined()
    expect(vacant.email).toBe('recbro@x.org') // belongs to the ecclesia, not to Hal
    expect(vacant.terms[0].to).toBeDefined()
    expect((await persons.getById(p.personId))!.isRecordingBrother).toBe(false)
    expect(await recordingBrotherOf(tee)).toMatchObject({ email: 'recbro@x.org', personId: undefined })
  })

  it('refuses a nameless record as the holder: it is an address, not a person', async () => {
    const { tee } = await seed()
    const mailbox = await persons.create({ email: 'box@x.org', firstName: '', lastName: '', ecclesia: tee.name })
    await expect(
      setRecordingBrother({ ecclesiaName: tee.name, newPersonId: mailbox.personId, emailPreference: 'personal', callerEmail: 'a@x.org' })
    ).rejects.toThrow(/no name/)
    expect(await officeRepository.getOffice(TEE, 'rb')).toBeNull()
  })
})

describe('inter-ecclesia sends from offices (flagged)', () => {
  const ses = (opts: { suppressed?: string[]; unsubscribedAll?: string[] } = {}) => ({
    send: vi.fn(async (cmd: any) => {
      const email = cmd.input.EmailAddress
      const name = cmd.constructor.name
      if (name === 'GetSuppressedDestinationCommand') {
        if (opts.suppressed?.includes(email)) return {}
        throw Object.assign(new Error('nf'), { name: 'NotFoundException' })
      }
      if (name === 'GetContactCommand') {
        if (opts.unsubscribedAll?.includes(email)) return { UnsubscribeAll: true }
        throw Object.assign(new Error('nf'), { name: 'NotFoundException' })
      }
      throw new Error(`unexpected ${name}`)
    }),
  })

  async function seedOffices() {
    const { tee } = await seed()
    const p = await persons.create({ email: 'hal@x.org', firstName: 'Hal', lastName: 'Der', ecclesia: tee.name })
    await officeRepository.saveOffice({ ecclesiaId: TEE, role: 'rb', email: 'recbro@x.org' })
    const rep = await officeRepository.addRepOffice('barrie-ecclesia')
    await officeRepository.assignHolder('barrie-ecclesia', rep.role, p.personId)
    await officeRepository.addRepOffice('barrie-ecclesia', { email: 'gone@x.org' })
    await officeRepository.addRepOffice('barrie-ecclesia', { email: 'quit@x.org' })
    await officeRepository.saveOffice({ ecclesiaId: TEE, role: 'treasurer', email: 'treasurer@x.org' })
  }

  it('null (→ the SES topic, as today) while the flag is off or the assignments are not applied', async () => {
    await seedOffices()
    expect(await interEcclesiaRecipientsFromOffices(ses() as any)).toBeNull()
    h.flags.add(FEATURE_FLAGS.INTER_ECCLESIA_FROM_OFFICES)
    expect(await interEcclesiaRecipientsFromOffices(ses() as any)).toBeNull()
  })

  it('flag on + assignments applied: RB/Rep addresses, minus suppressed and unsubscribed-from-all', async () => {
    await seedOffices()
    h.flags.add(FEATURE_FLAGS.INTER_ECCLESIA_FROM_OFFICES)
    await officeRepository.writeOfficesAssignedMarker({})
    const client = ses({ suppressed: ['gone@x.org'], unsubscribedAll: ['quit@x.org'] })
    expect(await interEcclesiaRecipientsFromOffices(client as any)).toEqual(['hal@x.org', 'recbro@x.org'])
  })

  it('an SES error falls back to the topic rather than dropping the send', async () => {
    await seedOffices()
    h.flags.add(FEATURE_FLAGS.INTER_ECCLESIA_FROM_OFFICES)
    await officeRepository.writeOfficesAssignedMarker({})
    const client = { send: vi.fn(async () => { throw Object.assign(new Error('throttled'), { name: 'Throttling' }) }) }
    expect(await interEcclesiaRecipientsFromOffices(client as any)).toBeNull()
  })
})

describe('GET /api/admin/offices', () => {
  it('admin/owner only', async () => {
    h.auth.mockResolvedValue({ user: { email: 'm@x.org', role: 'member' } })
    expect((await getOffices()).status).toBe(403)
    h.auth.mockResolvedValue(null)
    expect((await getOffices()).status).toBe(401)
  })

  it('every ecclesia with its offices and whether it has an RB office', async () => {
    await seed()
    await officeRepository.ensureRecordingBrotherOffice(TEE)
    h.auth.mockResolvedValue({ user: { email: 'o@x.org', role: 'owner' } })
    const res = await getOffices()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.totals).toEqual({ ecclesias: 2, withRecordingBrotherOffice: 1, offices: 1 })
    expect(body.ecclesias.map((e: any) => [e.ecclesiaId, e.hasRecordingBrotherOffice, e.offices.length])).toEqual([
      ['barrie-ecclesia', false, 0],
      [TEE, true, 1],
    ])
  })
})
