import { describe, it, expect, vi } from 'vitest'

import {
  filterRecipients,
  resolveListRecipients,
  type RecipientCandidate,
  type ResolveDeps,
} from '../utils/email/resolve-list-recipients'

describe('filterRecipients (pure)', () => {
  const verifiedAll = (candidates: RecipientCandidate[]) =>
    new Map(candidates.map((c) => [`${c.personId}#${c.emailId}`, true]))

  it('keeps opt-in candidates that are verified and not suppressed', () => {
    const candidates: RecipientCandidate[] = [
      { email: 'a@x.com', personId: 'p1', emailId: 'e1' },
      { email: 'b@x.com', personId: 'p2', emailId: 'e2' },
    ]
    const { recipients, stats } = filterRecipients(
      candidates,
      new Set(),
      verifiedAll(candidates)
    )
    expect(recipients.map((r) => r.email)).toEqual(['a@x.com', 'b@x.com'])
    expect(stats).toMatchObject({
      candidates: 2,
      suppressedRemoved: 0,
      unverifiedRemoved: 0,
      duplicatesRemoved: 0,
      recipients: 2,
    })
  })

  it('removes suppressed addresses (case-insensitive)', () => {
    const candidates: RecipientCandidate[] = [
      { email: 'Keep@x.com', personId: 'p1', emailId: 'e1' },
      { email: 'Drop@x.com', personId: 'p2', emailId: 'e2' },
    ]
    const { recipients, stats } = filterRecipients(
      candidates,
      new Set(['drop@x.com']),
      verifiedAll(candidates)
    )
    expect(recipients.map((r) => r.email)).toEqual(['keep@x.com'])
    expect(stats.suppressedRemoved).toBe(1)
    expect(stats.recipients).toBe(1)
  })

  it('removes unverified addresses, and treats a MISSING verification entry as unverified (fail-closed)', () => {
    const candidates: RecipientCandidate[] = [
      { email: 'ok@x.com', personId: 'p1', emailId: 'e1' },
      { email: 'unverified@x.com', personId: 'p2', emailId: 'e2' },
      { email: 'unknown@x.com', personId: 'p3', emailId: 'e3' },
    ]
    const verifiedByEmailId = new Map<string, boolean>([
      ['p1#e1', true],
      ['p2#e2', false],
      // p3#e3 intentionally absent
    ])
    const { recipients, stats } = filterRecipients(candidates, new Set(), verifiedByEmailId)
    expect(recipients.map((r) => r.email)).toEqual(['ok@x.com'])
    expect(stats.unverifiedRemoved).toBe(2)
  })

  it('de-dupes repeated addresses, keeping the first occurrence', () => {
    const candidates: RecipientCandidate[] = [
      { email: 'dup@x.com', personId: 'p1', emailId: 'e1' },
      { email: 'DUP@x.com', personId: 'p1', emailId: 'e2' },
      { email: 'other@x.com', personId: 'p2', emailId: 'e3' },
    ]
    const verifiedByEmailId = new Map<string, boolean>([
      ['p1#e1', true],
      ['p1#e2', true],
      ['p2#e3', true],
    ])
    const { recipients, stats } = filterRecipients(candidates, new Set(), verifiedByEmailId)
    expect(recipients.map((r) => r.email)).toEqual(['dup@x.com', 'other@x.com'])
    expect(recipients[0]).toMatchObject({ personId: 'p1', emailId: 'e1' })
    expect(stats.duplicatesRemoved).toBe(1)
    expect(stats.recipients).toBe(2)
  })

  it('applies all three filters together', () => {
    const candidates: RecipientCandidate[] = [
      { email: 'good@x.com', personId: 'p1', emailId: 'e1' }, // kept
      { email: 'bounce@x.com', personId: 'p2', emailId: 'e2' }, // suppressed
      { email: 'nv@x.com', personId: 'p3', emailId: 'e3' }, // unverified
      { email: 'good@x.com', personId: 'p4', emailId: 'e4' }, // duplicate
    ]
    const verifiedByEmailId = new Map<string, boolean>([
      ['p1#e1', true],
      ['p2#e2', true],
      ['p3#e3', false],
      ['p4#e4', true],
    ])
    const { recipients, stats } = filterRecipients(
      candidates,
      new Set(['bounce@x.com']),
      verifiedByEmailId
    )
    expect(recipients.map((r) => r.email)).toEqual(['good@x.com'])
    expect(stats).toMatchObject({
      candidates: 4,
      suppressedRemoved: 1,
      unverifiedRemoved: 1,
      duplicatesRemoved: 1,
      recipients: 1,
    })
  })
})

describe('resolveListRecipients (IO orchestration, mocked deps)', () => {
  it('wires the registry + verification + suppression sources and filters', async () => {
    const candidates: RecipientCandidate[] = [
      { email: 'keep@x.com', personId: 'p1', emailId: 'e1' },
      { email: 'bounce@x.com', personId: 'p2', emailId: 'e2' },
      { email: 'unverified@x.com', personId: 'p3', emailId: 'e3' },
    ]

    const emailsByPerson: Record<string, Array<{ emailId: string; verified: boolean }>> = {
      p1: [{ emailId: 'e1', verified: true }],
      p2: [{ emailId: 'e2', verified: true }],
      p3: [{ emailId: 'e3', verified: false }],
    }

    const getEmailsForPerson = vi.fn(async (personId: string) => emailsByPerson[personId] ?? [])
    const getSuppressed = vi.fn(async (_emails: string[]) => new Set(['bounce@x.com']))

    const deps: ResolveDeps = {
      listSubscribers: async () => candidates,
      getEmailsForPerson,
      getSuppressed,
    }

    const { recipients, stats } = await resolveListRecipients('list-1', deps)

    expect(recipients.map((r) => r.email)).toEqual(['keep@x.com'])
    expect(stats).toMatchObject({
      candidates: 3,
      suppressedRemoved: 1,
      unverifiedRemoved: 1,
      recipients: 1,
    })
    // suppression queried ONCE for the whole batch (cached per resolve)
    expect(getSuppressed).toHaveBeenCalledTimes(1)
    // verification queried once per UNIQUE person
    expect(getEmailsForPerson).toHaveBeenCalledTimes(3)
  })

  it('reads verification once per unique person even when a person appears twice', async () => {
    const candidates: RecipientCandidate[] = [
      { email: 'a@x.com', personId: 'p1', emailId: 'e1' },
      { email: 'b@x.com', personId: 'p1', emailId: 'e2' },
    ]
    const getEmailsForPerson = vi.fn(async () => [
      { emailId: 'e1', verified: true },
      { emailId: 'e2', verified: true },
    ])
    const deps: ResolveDeps = {
      listSubscribers: async () => candidates,
      getEmailsForPerson,
      getSuppressed: async () => new Set(),
    }
    const { recipients } = await resolveListRecipients('list-1', deps)
    expect(recipients.map((r) => r.email)).toEqual(['a@x.com', 'b@x.com'])
    expect(getEmailsForPerson).toHaveBeenCalledTimes(1)
  })
})
