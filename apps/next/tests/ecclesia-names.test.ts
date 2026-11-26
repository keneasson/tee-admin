/**
 * Ecclesia names: one matching rule, exact-or-normalized lookups (never a
 * partial match), duplicate prevention by meaning, a rename that keeps every
 * attribute and the stable id in ONE TransactWrite, and closed status.
 *
 * Exercised through the REAL write paths (`locations.ts`) against the
 * in-memory DynamoDB. Placeholder data only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@aws-sdk/lib-dynamodb', async () => {
  const m = await import('./fixtures/fake-dynamo')
  return m.fakeLibDynamodb(m.sharedFake)
})
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async () => false),
}))

import { sharedFake as fake } from './fixtures/fake-dynamo'
import { clearEcclesiaIdCache, listEcclesiaDirectory, resetPeopleIndexReadyCache } from '@my/app/provider/dynamodb/people-index'
import {
  createEcclesia,
  EcclesiaNameConflictError,
  getAllEcclesia,
  getAssignableEcclesia,
  getEcclesiaByName,
  invalidateEcclesiaCache,
  searchEcclesia,
  updateEcclesia,
  updateEcclesiaFields,
} from '../utils/dynamodb/locations'
import {
  ClosedEcclesiaError,
  closedLabel,
  isActiveEcclesia,
  isClosedEcclesia,
  isSameEcclesia,
  normalizeEcclesiaName,
} from '@my/app/utils/ecclesia-name'

beforeEach(() => {
  fake.reset()
  clearEcclesiaIdCache()
  resetPeopleIndexReadyCache()
  invalidateEcclesiaCache()
  delete process.env.PEOPLE_INDEX_WRITES
})

const seed = (name: string, city: string, province = 'ON') => createEcclesia({ name, country: 'CA', province, city })

describe('normalizeEcclesiaName — matching only, never display', () => {
  it.each([
    ['Brantford', 'brantford'],
    ['Brantford Ecclesia', 'brantford'],
    ['  brantford   ECCLESIA ', 'brantford'],
    ['Hamilton Book Rd Christadelphian Ecclesia', 'hamilton book rd'],
    ['Example Christadelphians', 'example'],
    ['Example Christadelphian', 'example'],
    ['Example Christadelphians Ecclesia', 'example'],
    ['Mississauga West Ecclesia', 'mississauga west'],
    ['Schooley’s Mountain Ecclesia', "schooley's mountain"],
    ['Ecclesia', 'ecclesia'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeEcclesiaName(input)).toBe(expected)
  })

  it('keeps "chapel": it is part of a real name', () => {
    expect(normalizeEcclesiaName('Richmond Chapel Christadelphians')).toBe('richmond chapel')
    expect(normalizeEcclesiaName('Richmond Chapel')).toBe('richmond chapel')
    expect(normalizeEcclesiaName('Richmond Chapel')).not.toBe(normalizeEcclesiaName('Richmond'))
  })

  it('only drops TRAILING generic words', () => {
    expect(normalizeEcclesiaName('Ecclesia of Example')).toBe('ecclesia of example')
  })
})

describe('isSameEcclesia', () => {
  it('names match after normalizing', () => {
    expect(isSameEcclesia('Brantford', 'Brantford Ecclesia')).toBe(true)
    expect(isSameEcclesia('Example Christadelphians', 'example ecclesia')).toBe(true)
  })
  it('different ecclesias never match, and blank matches nothing', () => {
    expect(isSameEcclesia('Brant County', 'Brantford')).toBe(false)
    expect(isSameEcclesia('Brant', 'Brantford')).toBe(false)
    expect(isSameEcclesia('', '')).toBe(false)
    expect(isSameEcclesia(undefined, 'Brantford')).toBe(false)
  })
  it('compares stable ids when both sides carry one', () => {
    expect(isSameEcclesia({ ecclesiaId: 'a-1', name: 'Same Name' }, { ecclesiaId: 'b-2', name: 'Same Name' })).toBe(false)
    expect(isSameEcclesia({ ecclesiaId: 'a-1', name: 'Old Name' }, { ecclesiaId: 'a-1', name: 'New Name' })).toBe(true)
    // Only one side has an id → names decide
    expect(isSameEcclesia({ ecclesiaId: 'a-1', name: 'Brantford' }, 'Brantford Ecclesia')).toBe(true)
  })
})

describe('getEcclesiaByName — exact, else the ONE normalized match, never a partial match', () => {
  beforeEach(async () => {
    await seed('Brantford', 'Brantford')
    await seed('Brant County', 'Brantford')
    await seed('Barrie Ecclesia', 'Barrie')
  })

  it('exact stored name wins', async () => {
    expect((await getEcclesiaByName('Brantford'))?.name).toBe('Brantford')
  })

  it('finds a record by its normalized name', async () => {
    expect((await getEcclesiaByName('Barrie'))?.name).toBe('Barrie Ecclesia')
    expect((await getEcclesiaByName('barrie christadelphians'))?.name).toBe('Barrie Ecclesia')
    expect((await getEcclesiaByName('Brant County Ecclesia'))?.name).toBe('Brant County')
  })

  it('a partial name returns nothing (used to return the first name containing it)', async () => {
    expect(await getEcclesiaByName('Brant')).toBeNull()
    expect(await getEcclesiaByName('Bar')).toBeNull()
  })

  it('two records with the same meaning are ambiguous → null, never a guess', async () => {
    // A legacy duplicate filed under another city (created before duplicate prevention).
    fake.seed([
      {
        pkey: 'ECCLESIA#CA|ON', skey: 'Paris#Example Ecclesia', type: 'ECCLESIA', name: 'Example Ecclesia',
        country: 'CA', province: 'ON', city: 'Paris', gsi1pk: 'ECCLESIA#Example Ecclesia', gsi1sk: 'CA|ON|Paris',
      },
      {
        pkey: 'ECCLESIA_ID#example-ecclesia', skey: 'ECCLESIA', type: 'ECCLESIA_DIRECTORY', ecclesiaId: 'example-ecclesia',
        name: 'Example Ecclesia', ecclesiaPkey: 'ECCLESIA#CA|ON', ecclesiaSkey: 'Paris#Example Ecclesia',
        gsi2pk: 'ECCLESIAS', gsi2sk: 'CA|ON|Paris#Example Ecclesia',
      },
      {
        pkey: 'ECCLESIA#CA|ON', skey: 'Galt#Example', type: 'ECCLESIA', name: 'Example',
        country: 'CA', province: 'ON', city: 'Galt', gsi1pk: 'ECCLESIA#Example', gsi1sk: 'CA|ON|Galt',
      },
      {
        pkey: 'ECCLESIA_ID#example', skey: 'ECCLESIA', type: 'ECCLESIA_DIRECTORY', ecclesiaId: 'example',
        name: 'Example', ecclesiaPkey: 'ECCLESIA#CA|ON', ecclesiaSkey: 'Galt#Example',
        gsi2pk: 'ECCLESIAS', gsi2sk: 'CA|ON|Galt#Example',
      },
    ])
    invalidateEcclesiaCache()
    expect(await getEcclesiaByName('Example Christadelphians')).toBeNull()
    // Each exact name still resolves to its own record.
    expect((await getEcclesiaByName('Example'))?.city).toBe('Galt')
  })
})

describe('duplicate prevention — by meaning, across every record', () => {
  it('"Brantford Ecclesia" is refused when "Brantford" exists, even in another city', async () => {
    await seed('Brantford', 'Brantford')
    await expect(seed('Brantford Ecclesia', 'Paris')).rejects.toBeInstanceOf(EcclesiaNameConflictError)
    await expect(seed('brantford christadelphians', 'Brantford')).rejects.toThrow(/already exists/)
    expect((await getAllEcclesia()).map((e) => e.name)).toEqual(['Brantford'])
  })

  it('a different ecclesia with a similar name is allowed', async () => {
    await seed('Brantford', 'Brantford')
    await seed('Brant County', 'Brantford')
    await seed('Richmond Chapel Christadelphians', 'Richmond', 'BC')
    await seed('Richmond', 'Richmond', 'BC')
    expect((await getAllEcclesia()).length).toBe(4)
  })

  it('renaming onto another record\'s name is refused; renaming within its own meaning is fine', async () => {
    await seed('Brantford', 'Brantford')
    await seed('Grand River Ecclesia', 'Paris')
    await expect(
      updateEcclesia('Grand River Ecclesia', { name: 'Brantford Ecclesia', country: 'CA', province: 'ON', city: 'Paris' })
    ).rejects.toBeInstanceOf(EcclesiaNameConflictError)
    await updateEcclesia('Grand River Ecclesia', { name: 'Grand River', country: 'CA', province: 'ON', city: 'Paris' })
    expect((await getEcclesiaByName('Grand River'))?.name).toBe('Grand River')
  })
})

describe('safe rename — one TransactWrite, every attribute and the stable id kept', () => {
  const OLD_KEY = { pkey: 'ECCLESIA#CA|ON', skey: 'Barrie#Barrie Ecclesia' }
  const extras = {
    phone: '555-0100',
    contactEmail: 'office@example.org',
    website: 'https://example.org',
    scheduleConfig: { memorial: { enabled: true, label: 'Memorial', fields: [] } },
    timezone: 'America/Toronto',
    latitude: 44.39,
    longitude: -79.69,
    sharingPreference: 'open',
    newsletterEnabled: true,
    logoUrl: 'https://example.org/logo.png',
    status: 'closed',
    closedYear: 2020,
    closedNote: 'Placeholder note',
    someFutureAttribute: 'kept',
  }

  beforeEach(async () => {
    await createEcclesia({ name: 'Barrie Ecclesia', country: 'CA', province: 'ON', city: 'Barrie', address: '1 Placeholder St' })
    const item = fake.items().find((i) => i.pkey === OLD_KEY.pkey && i.skey === OLD_KEY.skey)!
    fake.seed([{ ...item, ...extras }])
    invalidateEcclesiaCache()
  })

  it('rename moves the record in ONE TransactWrite (Put new + Delete old, both conditioned)', async () => {
    fake.calls.length = 0
    await updateEcclesia('Barrie Ecclesia', { name: 'Barrie', country: 'CA', province: 'ON', city: 'Barrie' })

    const ecclesiaWrites = fake.calls.filter(
      (c) => ['Put', 'Delete', 'Update'].includes(c.op) && String(c.input.Key?.pkey ?? c.input.Item?.pkey).startsWith('ECCLESIA#')
    )
    expect(ecclesiaWrites).toEqual([]) // never a bare delete/put of the source item
    const tx = fake.calls.filter((c) => c.op === 'TransactWrite')
    expect(tx).toHaveLength(1)
    const [put, del] = tx[0].input.TransactItems
    expect(put.Put.ConditionExpression).toBe('attribute_not_exists(pkey)')
    expect(put.Put.Item).toMatchObject({ pkey: 'ECCLESIA#CA|ON', skey: 'Barrie#Barrie', gsi1pk: 'ECCLESIA#Barrie', name: 'Barrie' })
    expect(del.Delete).toMatchObject({ Key: OLD_KEY, ConditionExpression: 'attribute_exists(pkey)' })
  })

  it('every attribute survives, and the stable id is persisted', async () => {
    await updateEcclesia('Barrie Ecclesia', { name: 'Barrie', country: 'CA', province: 'ON', city: 'Barrie' })
    expect(fake.items().find((i) => i.pkey === OLD_KEY.pkey && i.skey === OLD_KEY.skey)).toBeUndefined()
    const moved = fake.items().find((i) => i.pkey === 'ECCLESIA#CA|ON' && i.skey === 'Barrie#Barrie')!
    expect(moved).toMatchObject({ ...extras, address: '1 Placeholder St', ecclesiaId: 'barrie-ecclesia', name: 'Barrie' })
    // Offices, lists and cards keyed on the id keep resolving: the alias follows the id.
    expect(await listEcclesiaDirectory()).toEqual([
      expect.objectContaining({ ecclesiaId: 'barrie-ecclesia', name: 'Barrie', ecclesiaSkey: 'Barrie#Barrie' }),
    ])
    expect((await getEcclesiaByName('Barrie'))?.ecclesiaId).toBe('barrie-ecclesia')
  })

  it('a non-rename edit updates in place: no delete, no transaction', async () => {
    fake.calls.length = 0
    await updateEcclesia('Barrie Ecclesia', {
      name: 'Barrie Ecclesia', country: 'CA', province: 'ON', city: 'Barrie', address: '2 Placeholder St',
    })
    expect(fake.calls.some((c) => c.op === 'TransactWrite' || c.op === 'Delete')).toBe(false)
    const item = fake.items().find((i) => i.pkey === OLD_KEY.pkey && i.skey === OLD_KEY.skey)!
    expect(item).toMatchObject({ ...extras, address: '2 Placeholder St' })
  })

  it('a failed transaction leaves the original untouched', async () => {
    // Something already sits at the new key → the Put condition fails → nothing changes.
    fake.seed([{ pkey: 'ECCLESIA#CA|ON', skey: 'Barrie#Barrie', type: 'OTHER' }])
    await expect(
      updateEcclesia('Barrie Ecclesia', { name: 'Barrie', country: 'CA', province: 'ON', city: 'Barrie' })
    ).rejects.toThrow()
    expect(fake.items().find((i) => i.pkey === OLD_KEY.pkey && i.skey === OLD_KEY.skey)).toMatchObject(extras)
  })
})

describe('closed status', () => {
  beforeEach(async () => {
    await seed('Open Example Ecclesia', 'Toronto')
    await seed('Folded Example Ecclesia', 'Greenville')
    await updateEcclesiaFields('Folded Example Ecclesia', { status: 'closed', closedYear: 2021, closedNote: 'Placeholder note' })
  })

  it('is stored (with a name placeholder for the reserved word) and read back', async () => {
    const update = fake.calls.find((c) => c.op === 'Update' && /#status/.test(c.input.UpdateExpression))
    expect(update?.input.ExpressionAttributeNames).toEqual({ '#status': 'status' })
    const folded = await getEcclesiaByName('Folded Example Ecclesia')
    expect(folded).toMatchObject({ status: 'closed', closedYear: 2021, closedNote: 'Placeholder note' })
    expect(isClosedEcclesia(folded)).toBe(true)
    expect(closedLabel(folded)).toBe('Closed 2021')
    expect(closedLabel({ status: 'closed' })).toBe('Closed')
    expect(isActiveEcclesia({})).toBe(true)
  })

  it('directory list + lookups still find it (badge data included)', async () => {
    const all = await getAllEcclesia()
    expect(all.find((e) => e.name === 'Folded Example Ecclesia')).toMatchObject({ status: 'closed', closedYear: 2021 })
    expect((await getEcclesiaByName('Folded Example'))?.name).toBe('Folded Example Ecclesia')
  })

  it('pickers (search default) exclude it; the directory search (includeClosed) keeps it', async () => {
    expect((await searchEcclesia('Example')).map((e) => e.name)).toEqual(['Open Example Ecclesia'])
    expect((await searchEcclesia('Example', 5, { includeClosed: true })).map((e) => e.name).sort()).toEqual([
      'Folded Example Ecclesia',
      'Open Example Ecclesia',
    ])
  })

  it('assignment refuses it', async () => {
    await expect(getAssignableEcclesia('Folded Example')).rejects.toBeInstanceOf(ClosedEcclesiaError)
    expect((await getAssignableEcclesia('Open Example'))?.name).toBe('Open Example Ecclesia')
  })

  it('reopening clears the year and note', async () => {
    await updateEcclesiaFields('Folded Example Ecclesia', { status: 'active', closedYear: null, closedNote: null })
    const e = await getEcclesiaByName('Folded Example Ecclesia')
    expect(isClosedEcclesia(e)).toBe(false)
    expect(e?.closedYear ?? null).toBeNull()
    expect((await searchEcclesia('Folded')).map((x) => x.name)).toEqual(['Folded Example Ecclesia'])
  })
})
