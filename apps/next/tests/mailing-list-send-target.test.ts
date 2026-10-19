import { describe, it, expect, vi } from 'vitest'
import {
  DEFAULT_LIST_KEY_BY_REASON,
  isListId,
  resolveSendList,
  SendListError,
  type SendTargetDeps,
} from '../utils/mailing-lists/send-target'
import type { MailingListRecord } from '@my/app/provider/dynamodb/types'

/** R5: every send names one registry list, by listId. */

const TE = 'toronto-east-ecclesia'
const ids = {
  newsletter: '11111111-1111-4111-8111-111111111111',
  testList: '22222222-2222-4222-8222-222222222222',
  memorial: '33333333-3333-4333-8333-333333333333',
  cambridge: '44444444-4444-4444-8444-444444444444',
}

const list = (key: string, listId: string, o: Partial<MailingListRecord> = {}) =>
  ({ listId, key, status: 'active', ownerType: 'ecclesia', ownerId: TE, name: key, ...o }) as MailingListRecord

const byKey: Record<string, MailingListRecord> = {
  newsletter: list('newsletter', ids.newsletter),
  testList: list('testList', ids.testList),
  memorial: list('memorial', ids.memorial),
}

const deps = (o: Partial<SendTargetDeps> = {}): SendTargetDeps => ({
  getList: vi.fn(async (id: string) =>
    id === ids.cambridge
      ? list('memorial-recap', ids.cambridge, { ownerId: 'cambridge-ecclesia' })
      : (Object.values(byKey).find((l) => l.listId === id) ?? null)
  ),
  findByOwnerKey: vi.fn(async (_t, ownerId: string, key: string) => (ownerId === TE ? (byKey[key] ?? null) : null)),
  ecclesiaIdForName: vi.fn(async () => TE),
  ...o,
})

const tenant = { homeEcclesiaName: 'Toronto East Ecclesia' }

describe('resolveSendList', () => {
  it('no list: the reason default of the tenant owner (recap → memorial)', async () => {
    const d = deps()
    expect((await resolveSendList({ reason: 'recap', tenant }, d)).listId).toBe(ids.memorial)
    expect(d.findByOwnerKey).toHaveBeenCalledWith('ecclesia', TE, 'memorial')
  })

  it('a listId: that list, including another owner list with no SES topic', async () => {
    const got = await resolveSendList({ reason: 'custom', list: ids.cambridge, tenant }, deps())
    expect(got).toMatchObject({ listId: ids.cambridge, key: 'memorial-recap' })
  })

  it('a test send always resolves the owner test list, whatever was asked for', async () => {
    const got = await resolveSendList({ reason: 'newsletter', test: true, list: ids.cambridge, tenant }, deps())
    expect(got.listId).toBe(ids.testList)
  })

  it('back-compat: an old list key from a saved draft/meeting resolves to that owner list', async () => {
    expect((await resolveSendList({ reason: 'custom', list: 'newsletter', tenant }, deps())).listId).toBe(ids.newsletter)
  })

  it('an unknown or archived listId, or an unknown key, is a SendListError (never a guess)', async () => {
    await expect(
      resolveSendList({ reason: 'custom', list: '55555555-5555-4555-8555-555555555555', tenant }, deps())
    ).rejects.toBeInstanceOf(SendListError)
    const archived = deps({ getList: vi.fn(async () => list('newsletter', ids.newsletter, { status: 'archived' })) })
    await expect(resolveSendList({ reason: 'custom', list: ids.newsletter, tenant }, archived)).rejects.toThrow(
      /archived/
    )
    await expect(resolveSendList({ reason: 'custom', list: 'nope', tenant }, deps())).rejects.toThrow(/Unknown list/)
  })

  it('a tenant with no home ecclesia (echadhub.org) sends from Toronto East lists, as before', async () => {
    const d = deps()
    await resolveSendList({ reason: 'newsletter', tenant: { homeEcclesiaName: null } }, d)
    expect(d.ecclesiaIdForName).toHaveBeenCalledWith('Toronto East Ecclesia')
  })

  it('every reason has a default list key', () => {
    for (const key of Object.values(DEFAULT_LIST_KEY_BY_REASON)) expect(key).toBeTruthy()
  })

  it('isListId recognises uuids only', () => {
    expect(isListId(ids.newsletter)).toBe(true)
    expect(isListId('newsletter')).toBe(false)
  })
})
