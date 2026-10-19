import { describe, it, expect, vi } from 'vitest'
import {
  applyUnsubscribeAll,
  resolveSendAudience,
  SendListNotCutOverError,
  type SendAudienceDeps,
} from '../utils/mailing-lists/registry-send'
import { SendListError } from '../utils/mailing-lists/send-target'
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

const OFF = { enabled: false }
const ON = { enabled: true }

const resolved = (emails: string[]) => ({
  recipients: emails.map((email, i) => ({ email, personId: `p${i}`, emailId: `e${i}` })),
  stats: { candidates: emails.length, suppressedRemoved: 0, unverifiedRemoved: 0, duplicatesRemoved: 0, recipients: emails.length },
})

const deps = (o: Partial<SendAudienceDeps> = {}): SendAudienceDeps => ({
  resolveListRecipients: vi.fn(async () => resolved(['a@example.org', 'b@example.org'])),
  getUnsubscribedAll: vi.fn(async () => new Set<string>()),
  ...o,
})

describe('resolveSendAudience — safety net OFF (today)', () => {
  it('bridged list not cut over: REFUSES (its SES topic no longer gets opt-outs), registry not read', async () => {
    const d = deps()
    const p = resolveSendAudience(list(), OFF, d)
    await expect(p).rejects.toBeInstanceOf(SendListNotCutOverError)
    await expect(resolveSendAudience(list(), OFF, d)).rejects.toBeInstanceOf(SendListError) // routes answer 400
    await expect(resolveSendAudience(list(), OFF, d)).rejects.toThrow(/not cut over/)
    expect(d.resolveListRecipients).not.toHaveBeenCalled()
  })

  it('bridged list cut over: registry minus UnsubscribeAll, naming its legacy topic', async () => {
    const d = deps({ getUnsubscribedAll: vi.fn(async () => new Set(['b@example.org'])) })
    const a = await resolveSendAudience(list({ sendFromRegistry: true }), OFF, d)
    expect(a).toMatchObject({ source: 'registry', listId: 'L1', topicName: 'bibleClass', emails: ['a@example.org'] })
    expect(a.stats.unsubscribedAllRemoved).toBe(1)
  })

  it('cut over but 0 recipients (backfill missing): REFUSES, never falls back to the SES topic', async () => {
    const d = deps({ resolveListRecipients: vi.fn(async () => resolved([])) })
    await expect(resolveSendAudience(list({ sendFromRegistry: true }), OFF, d)).rejects.toThrow(/0 recipients/)
  })

  it('cut over and the registry read fails: the send fails, never falls back to the SES topic', async () => {
    const d = deps({ resolveListRecipients: vi.fn(async () => { throw new Error('dynamo down') }) })
    await expect(resolveSendAudience(list({ sendFromRegistry: true }), OFF, d)).rejects.toThrow('dynamo down')
  })

  it('a list with NO SES topic (e.g. a new "Cambridge Memorial Recap"): the registry, naming no topic', async () => {
    const d = deps()
    const a = await resolveSendAudience(list({ sesTopic: undefined, key: 'memorial-recap' }), OFF, d)
    expect(a).toMatchObject({ source: 'registry', topicName: undefined, emails: ['a@example.org', 'b@example.org'] })
  })

  it('a list with no SES topic that resolves to nobody sends to nobody (no fallback exists)', async () => {
    const d = deps({ resolveListRecipients: vi.fn(async () => resolved([])) })
    const a = await resolveSendAudience(list({ sesTopic: undefined }), OFF, d)
    expect(a).toMatchObject({ source: 'registry', emails: [] })
  })
})

describe('resolveSendAudience — safety net ON', () => {
  it('every list sends from the registry naming the safety-net topic, even one never cut over', async () => {
    const d = deps()
    const a = await resolveSendAudience(list(), ON, d)
    expect(a).toMatchObject({ source: 'registry', topicName: 'safetyNetDefault' })
  })

  it('never falls back to a legacy topic (it no longer exists): 0 recipients stays 0, errors throw', async () => {
    const empty = deps({ resolveListRecipients: vi.fn(async () => resolved([])) })
    expect(await resolveSendAudience(list({ sendFromRegistry: true }), ON, empty)).toMatchObject({
      source: 'registry',
      emails: [],
    })
    const broken = deps({ resolveListRecipients: vi.fn(async () => { throw new Error('dynamo down') }) })
    await expect(resolveSendAudience(list({ sendFromRegistry: true }), ON, broken)).rejects.toThrow('dynamo down')
  })

  it('while the switch script runs (switching), EVERY send refuses — even a list with no SES topic', async () => {
    const d = deps()
    for (const l of [list({ sendFromRegistry: true }), list({ sesTopic: undefined })]) {
      await expect(resolveSendAudience(l, { enabled: false, switching: true }, d)).rejects.toThrow(/being switched/)
    }
    expect(d.resolveListRecipients).not.toHaveBeenCalled()
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
