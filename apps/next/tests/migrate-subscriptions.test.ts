import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * migrateSubscriptions() — writes BOTH sides of the source of truth.
 *
 * SES holds per-contact TopicPreferences, but the PersonRecord EMAIL# row is
 * CANONICAL (the sync-ses-contacts cron pushes PersonRecord → SES one-way). So
 * this helper MUST write both, or an SES-only change to a primary address is
 * reverted on the next sync. These tests prove the two SES calls AND the two
 * PersonRecord row writes happen with the right shape.
 */

const h = vi.hoisted(() => ({
  sesSend: vi.fn(),
  p_getEmails: vi.fn(),
  p_update: vi.fn(),
}))

// Provide the SES command classes + SubscriptionStatus (the global setup mock
// only exposes SESv2Client/SendEmailCommand, which contact.ts doesn't use here).
vi.mock('@aws-sdk/client-sesv2', () => {
  class GetContactCommand {
    input: any
    constructor(i: any) {
      this.input = i
    }
  }
  class CreateContactCommand {
    input: any
    constructor(i: any) {
      this.input = i
    }
  }
  class UpdateContactCommand {
    input: any
    constructor(i: any) {
      this.input = i
    }
  }
  class ListContactsCommand {
    input: any
    constructor(i: any) {
      this.input = i
    }
  }
  return {
    GetContactCommand,
    CreateContactCommand,
    UpdateContactCommand,
    ListContactsCommand,
    SubscriptionStatus: { OPT_IN: 'OPT_IN', OPT_OUT: 'OPT_OUT' },
  }
})

vi.mock('../utils/email/sesClient', () => ({
  getSesClient: () => ({ send: h.sesSend }),
  sendEmail: vi.fn(),
}))

vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: {
    getEmails: h.p_getEmails,
    update: h.p_update,
  },
}))

import { migrateSubscriptions } from '../utils/email/contact'

const OLD = 'old@example.com'
const NEW = 'new@example.com'
const PID = 'person-1'

/** Pull the single command of a given class name from the send() calls. */
function sentCommand(name: string) {
  const call = h.sesSend.mock.calls.find((c) => c[0]?.constructor?.name === name)
  return call?.[0]
}

/** Turn a TopicPreferences array into a { topic: OPT_IN|OPT_OUT } map. */
function prefMap(arr: Array<{ TopicName: string; SubscriptionStatus: string }>) {
  return Object.fromEntries(arr.map((p) => [p.TopicName, p.SubscriptionStatus]))
}

beforeEach(() => {
  vi.clearAllMocks()

  // OLD address is opted into newsletter + memorial, opted out of bibleClass.
  h.sesSend.mockImplementation(async (command: any) => {
    if (command?.constructor?.name === 'GetContactCommand') {
      return {
        TopicPreferences: [
          { TopicName: 'newsletter', SubscriptionStatus: 'OPT_IN' },
          { TopicName: 'memorial', SubscriptionStatus: 'OPT_IN' },
          { TopicName: 'bibleClass', SubscriptionStatus: 'OPT_OUT' },
        ],
      }
    }
    return {}
  })

  // Both addresses have EMAIL# rows on the target person.
  h.p_getEmails.mockResolvedValue([
    { pkey: `PERSON#${PID}`, skey: 'EMAIL#new-id', emailId: 'new-id', email: NEW },
    { pkey: `PERSON#${PID}`, skey: 'EMAIL#old-id', emailId: 'old-id', email: OLD },
  ])
  h.p_update.mockResolvedValue({})
})

describe('migrateSubscriptions', () => {
  it('makes BOTH SES calls: copies opt-ins onto the new address, clears the old', async () => {
    await migrateSubscriptions(OLD, NEW, { personId: PID })

    const create = sentCommand('CreateContactCommand')
    expect(create).toBeTruthy()
    expect(create.input.EmailAddress).toBe(NEW)
    const created = prefMap(create.input.TopicPreferences)
    expect(created.newsletter).toBe('OPT_IN')
    expect(created.memorial).toBe('OPT_IN')
    expect(created.bibleClass).toBe('OPT_OUT')

    const update = sentCommand('UpdateContactCommand')
    expect(update).toBeTruthy()
    expect(update.input.EmailAddress).toBe(OLD)
    // Old address cleared: every topic OPT_OUT.
    for (const pref of update.input.TopicPreferences) {
      expect(pref.SubscriptionStatus).toBe('OPT_OUT')
    }
  })

  it('writes BOTH PersonRecord rows: new row subscribed, old row unsubscribed', async () => {
    await migrateSubscriptions(OLD, NEW, { personId: PID })

    expect(h.p_update).toHaveBeenCalledTimes(2)

    const newCall = h.p_update.mock.calls.find((c) => c[1] === 'EMAIL#new-id')
    expect(newCall).toBeTruthy()
    expect(newCall![2].sesSubscribed).toBe(true)
    expect(newCall![2].sesTopicPreferences.newsletter).toBe(true)
    expect(newCall![2].sesTopicPreferences.memorial).toBe(true)
    expect(newCall![2].sesTopicPreferences.bibleClass).toBe(false)

    const oldCall = h.p_update.mock.calls.find((c) => c[1] === 'EMAIL#old-id')
    expect(oldCall).toBeTruthy()
    expect(oldCall![2].sesSubscribed).toBe(false)
    for (const v of Object.values(oldCall![2].sesTopicPreferences)) {
      expect(v).toBe(false)
    }
  })

  it('returns only the opted-in topics as movedTopics', async () => {
    const { movedTopics } = await migrateSubscriptions(OLD, NEW, { personId: PID })
    expect(movedTopics.sort()).toEqual(['memorial', 'newsletter'])
    expect(movedTopics).not.toContain('bibleClass')
  })

  it('still completes the SES writes when a PersonRecord row is missing (best-effort)', async () => {
    h.p_getEmails.mockResolvedValue([]) // no rows to update
    const { movedTopics } = await migrateSubscriptions(OLD, NEW, { personId: PID })

    // SES side still happened...
    expect(sentCommand('CreateContactCommand')).toBeTruthy()
    expect(sentCommand('UpdateContactCommand')).toBeTruthy()
    // ...PersonRecord writes were skipped, and it didn't throw.
    expect(h.p_update).not.toHaveBeenCalled()
    expect(movedTopics.sort()).toEqual(['memorial', 'newsletter'])
  })
})
