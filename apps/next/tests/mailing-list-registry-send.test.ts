import { describe, it, expect, vi } from 'vitest'
import { applyUnsubscribeAll, resolveRegistryAudience, type RegistrySendDeps } from '../utils/mailing-lists/registry-send'
import { runListParity } from '../utils/mailing-lists/parity'
import { cutoverAllowed, inSendWindow } from '../utils/mailing-lists/mailing-list-ops'
import type { MailingListRecord } from '@my/app/provider/dynamodb/types'

const list = (o: Partial<MailingListRecord> = {}): MailingListRecord =>
  ({
    pkey: 'LIST#L1',
    skey: 'DETAILS',
    listId: 'L1',
    ownerType: 'ecclesia',
    ownerId: 'toronto-east-ecclesia',
    scope: 'ecclesia',
    scopeValue: 'toronto-east-ecclesia',
    category: 'reminders',
    key: 'bibleClass',
    name: 'Bible Class',
    description: '',
    defaultOptIn: false,
    status: 'active',
    sesTopic: 'bibleClass',
    ...o,
  }) as MailingListRecord

const resolved = (emails: string[]) => ({
  recipients: emails.map((email, i) => ({ email, personId: `p${i}`, emailId: `e${i}` })),
  stats: { candidates: emails.length, suppressedRemoved: 0, unverifiedRemoved: 0, duplicatesRemoved: 0, recipients: emails.length },
})

const deps = (o: Partial<RegistrySendDeps> = {}): RegistrySendDeps => ({
  findBySesTopic: vi.fn(async () => list({ sendFromRegistry: true })),
  resolveListRecipients: vi.fn(async () => resolved(['a@example.org', 'b@example.org'])),
  getUnsubscribedAll: vi.fn(async () => new Set<string>()),
  ...o,
})

describe('resolveRegistryAudience — per-list cutover, default off, fail-safe', () => {
  it('cutover OFF (flag absent): null → the SES path, and the registry is not read', async () => {
    const d = deps({ findBySesTopic: vi.fn(async () => list()) })
    expect(await resolveRegistryAudience('bibleClass', d)).toBeNull()
    expect(d.resolveListRecipients).not.toHaveBeenCalled()
  })

  it('no list for the topic, or an archived list: null', async () => {
    expect(await resolveRegistryAudience('memorial', deps({ findBySesTopic: vi.fn(async () => null) }))).toBeNull()
    expect(
      await resolveRegistryAudience('bibleClass', deps({ findBySesTopic: vi.fn(async () => list({ sendFromRegistry: true, status: 'archived' })) }))
    ).toBeNull()
  })

  it('cutover ON: registry recipients minus SES UnsubscribeAll, keeping the topic as the safety net', async () => {
    const d = deps({ getUnsubscribedAll: vi.fn(async () => new Set(['b@example.org'])) })
    const audience = await resolveRegistryAudience('bibleClass', d)
    expect(audience).toMatchObject({
      source: 'registry',
      listId: 'L1',
      sesTopic: 'bibleClass',
      emails: ['a@example.org'],
    })
    expect(audience?.stats.unsubscribedAllRemoved).toBe(1)
  })

  it('cutover ON but 0 recipients (e.g. backfill missing): falls back to SES', async () => {
    const d = deps({ resolveListRecipients: vi.fn(async () => resolved([])) })
    expect(await resolveRegistryAudience('bibleClass', d)).toBeNull()
  })

  it('any registry error: falls back to SES instead of failing the send', async () => {
    const d = deps({ resolveListRecipients: vi.fn(async () => { throw new Error('dynamo down') }) })
    expect(await resolveRegistryAudience('bibleClass', d)).toBeNull()
  })

  it('applyUnsubscribeAll lower-cases before comparing', () => {
    expect(applyUnsubscribeAll(resolved(['A@Example.org']), new Set(['a@example.org']))).toEqual({ emails: [], removed: 1 })
  })
})

describe('runListParity — per list, both sides filtered as their sends are', () => {
  it('reports matched and both one-sided sets', async () => {
    const p = await runListParity(
      { listId: 'L1', sesTopic: 'bibleClass' },
      {
        sesRecipients: async () => ['a@example.org', 'ses-only@example.org'],
        registryRecipients: async () => ({ emails: ['a@example.org', 'reg-only@example.org'], stats: {} }),
      }
    )
    expect(p.diff).toMatchObject({
      matched: 1,
      inSesNotInHouse: ['ses-only@example.org'],
      inHouseNotInSes: ['reg-only@example.org'],
    })
    expect(cutoverAllowed(p.diff)).toBe(false)
  })

  it('cutover is allowed only when both sides are equal', async () => {
    const p = await runListParity(
      { listId: 'L1', sesTopic: 'bibleClass' },
      {
        sesRecipients: async () => ['A@example.org'],
        registryRecipients: async () => ({ emails: ['a@example.org'], stats: {} }),
      }
    )
    expect(cutoverAllowed(p.diff)).toBe(true)
  })

  it('refuses a list with no SES topic', async () => {
    await expect(runListParity({ listId: 'L1' })).rejects.toThrow(/no SES topic/)
  })
})

describe('inSendWindow — Wed–Sat in Toronto', () => {
  it.each([
    ['2026-10-18T16:00:00Z', false], // Sunday
    ['2026-10-20T16:00:00Z', false], // Tuesday
    ['2026-10-21T16:00:00Z', true], // Wednesday
    ['2026-10-24T16:00:00Z', true], // Saturday
    ['2026-10-25T03:00:00Z', true], // Saturday 11pm Toronto, already Sunday in UTC
  ])('%s → %s', (iso, expected) => {
    expect(inSendWindow(new Date(iso))).toBe(expected)
  })
})
