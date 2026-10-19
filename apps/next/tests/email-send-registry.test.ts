import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * emailSend + the R5 per-list cutover. The registry answers only for a list
 * that is cut over; otherwise (null) the SES-topic path runs unchanged. Either
 * way each send still names the SES topic (the safety-net gate).
 */

const { mockSesSend, mockGetContacts, mockResolveRegistryAudience } = vi.hoisted(() => ({
  mockSesSend: vi.fn(),
  mockGetContacts: vi.fn(),
  mockResolveRegistryAudience: vi.fn(),
}))

// The global setup mocks SendEmailCommand as a bare fn; keep each command's input.
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn(),
  SendEmailCommand: vi.fn().mockImplementation((input) => ({ input })),
}))
vi.mock('../utils/email/sesClient', () => ({
  getSesClient: () => ({ send: mockSesSend }),
  emailsEnabled: () => true,
}))
vi.mock('../utils/email/contact', () => ({ getContacts: mockGetContacts }))
vi.mock('../utils/mailing-lists/registry-send', () => ({
  resolveRegistryAudience: mockResolveRegistryAudience,
}))
vi.mock('../utils/email/ecclesia-token', () => ({
  generateEcclesiaUpdateUrl: vi.fn(),
  generateEmailPreferencesUrl: vi.fn(),
  generateSigninTokens: vi.fn(async () => new Map()),
  buildSigninUrl: vi.fn(),
}))
vi.mock('@my/app/provider/dynamodb/repositories/send-record-repository', () => ({
  sendRecordRepository: { createSendRecord: vi.fn(), finalizeSendCounts: vi.fn() },
}))
vi.mock('@my/app/provider/dynamodb/repositories/send-recipient-repository', () => ({
  sendRecipientRepository: { snapshotRoster: vi.fn() },
}))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async () => false),
}))

import { emailSend } from '../utils/email/email-send'

const sentTo = () =>
  mockSesSend.mock.calls.map((c) => ({
    to: c[0].input.Destination.ToAddresses[0],
    topic: c[0].input.ListManagementOptions.TopicName,
  }))

describe('emailSend recipient source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSesSend.mockResolvedValue({})
    mockGetContacts.mockResolvedValue({
      Contacts: [
        { EmailAddress: 'ses-a@example.org', UnsubscribeAll: false },
        { EmailAddress: 'ses-stopped@example.org', UnsubscribeAll: true },
      ],
    })
  })

  it('list not cut over (registry → null): the unchanged SES-topic path', async () => {
    mockResolveRegistryAudience.mockResolvedValue(null)
    const result = await emailSend({ reason: 'bible-class', emailHtml: '<p>x</p>', emailText: 'x' })

    expect(mockResolveRegistryAudience).toHaveBeenCalledWith('bibleClass')
    expect(mockGetContacts).toHaveBeenCalledWith({ listTopic: 'bibleClass', nextPageToken: undefined })
    expect(sentTo()).toEqual([{ to: 'ses-a@example.org', topic: 'bibleClass' }])
    expect(result).toMatchObject({ sends: ['ses-a@example.org'], skips: [] })
  })

  it('list cut over: recipients come from the registry, and the SES topic is still named', async () => {
    mockResolveRegistryAudience.mockResolvedValue({
      source: 'registry',
      listId: 'L-BC',
      sesTopic: 'bibleClass',
      emails: ['reg-a@example.org', 'reg-b@example.org'],
      stats: {},
    })
    await emailSend({ reason: 'bible-class', emailHtml: '<p>x</p>', emailText: 'x' })

    expect(mockGetContacts).not.toHaveBeenCalled()
    expect(sentTo()).toEqual([
      { to: 'reg-a@example.org', topic: 'bibleClass' },
      { to: 'reg-b@example.org', topic: 'bibleClass' },
    ])
  })

  it('a test send resolves the test list (so the test list can be cut over first)', async () => {
    mockResolveRegistryAudience.mockResolvedValue(null)
    await emailSend({ reason: 'newsletter', emailHtml: '<p>x</p>', emailText: 'x', test: true })
    expect(mockResolveRegistryAudience).toHaveBeenCalledWith('testList')
    expect(mockGetContacts).toHaveBeenCalledWith({ listTopic: 'testList', nextPageToken: undefined })
  })
})
