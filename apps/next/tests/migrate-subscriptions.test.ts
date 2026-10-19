import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * moveListSubscriptions() (R5) — an admin email change moves the member's LIST
 * subscriptions in the registry. No SES topic and no `sesTopicPreferences` is
 * written any more.
 */

vi.mock('../utils/email/sesClient', () => ({ getSesClient: () => ({ send: vi.fn() }) }))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({ personRepository: {} }))

import { moveListSubscriptions, type MoveSubscriptionDeps } from '../utils/email/contact'

const OLD = 'old@example.org'
const NEW = 'new@example.org'
const PID = 'person-1'

const row = (listId: string, status: 'opt_in' | 'opt_out') =>
  ({ pkey: `PERSON#${PID}`, skey: `SUB#${listId}#e-old`, listId, status, email: OLD }) as any

let deps: MoveSubscriptionDeps
beforeEach(() => {
  deps = {
    listAllLists: vi.fn(async () => [
      { listId: 'L-NEWS', name: 'Newsletter' },
      { listId: 'L-MEM', name: 'Memorial Service Recap' },
      { listId: 'L-BC', name: 'Bible Class' },
    ]),
    getListSubscriptionsForEmail: vi.fn(async (listId: string) =>
      listId === 'L-NEWS' ? [row('L-NEWS', 'opt_in')] : listId === 'L-MEM' ? [row('L-MEM', 'opt_in')] : [row('L-BC', 'opt_out')]
    ),
    setSubscriptionStatus: vi.fn(),
    setListSubscription: vi.fn(),
    getAllPersonsByEmail: vi.fn(async () => [{ personId: PID }]),
  }
})

describe('moveListSubscriptions', () => {
  it('opts the NEW address into every list the OLD one was on, and the OLD one out', async () => {
    const { movedLists } = await moveListSubscriptions('Old@Example.org', NEW, { personId: PID }, deps)
    expect(movedLists).toEqual(['Newsletter', 'Memorial Service Recap'])
    expect((deps.setListSubscription as any).mock.calls.map((c: any) => c[0])).toEqual([
      { listId: 'L-NEWS', email: NEW, subscribed: true },
      { listId: 'L-MEM', email: NEW, subscribed: true },
    ])
    expect((deps.setSubscriptionStatus as any).mock.calls.map((c: any) => [c[0].listId, c[1]])).toEqual([
      ['L-NEWS', 'opt_out'],
      ['L-MEM', 'opt_out'],
    ])
    expect(deps.getListSubscriptionsForEmail).toHaveBeenCalledWith('L-NEWS', OLD)
  })

  it('shared household address (#267): the OLD address stays subscribed for the others', async () => {
    deps.getAllPersonsByEmail = vi.fn(async () => [{ personId: PID }, { personId: 'spouse' }])
    const { movedLists } = await moveListSubscriptions(OLD, NEW, { personId: PID }, deps)
    expect(movedLists).toHaveLength(2)
    expect(deps.setSubscriptionStatus).not.toHaveBeenCalled()
  })

  it('a list the old address had opted out of is not moved', async () => {
    const { movedLists } = await moveListSubscriptions(OLD, NEW, { personId: PID }, deps)
    expect(movedLists).not.toContain('Bible Class')
  })
})
