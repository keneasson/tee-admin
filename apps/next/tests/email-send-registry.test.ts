import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * emailSend (R5): every send resolves ONE registry list (by listId), takes its
 * audience from registry-send.ts, names the audience's SES topic (or none) in
 * ListManagementOptions, and records the listId on the send record.
 */

const h = vi.hoisted(() => ({
  sesSend: vi.fn(),
  resolveSendList: vi.fn(),
  resolveSendAudience: vi.fn(),
  safetyNetState: vi.fn(),
  createSendRecord: vi.fn(),
}))

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn(),
  SendEmailCommand: vi.fn().mockImplementation((input) => ({ input })),
}))
vi.mock('../utils/email/sesClient', () => ({
  getSesClient: () => ({ send: h.sesSend }),
  emailsEnabled: () => true,
}))
vi.mock('../utils/email/contact-lists', () => ({ inputTemplate: { ContactListName: 'TEEAdmin' } }))
vi.mock('../utils/mailing-lists/send-target', () => ({ resolveSendList: h.resolveSendList }))
vi.mock('../utils/mailing-lists/registry-send', () => ({
  resolveSendAudience: h.resolveSendAudience,
  safetyNetState: h.safetyNetState,
}))
vi.mock('../utils/email/ecclesia-token', () => ({
  generateEcclesiaUpdateUrl: vi.fn(),
  generateEmailPreferencesUrl: vi.fn(),
  generateSigninTokens: vi.fn(async () => new Map()),
  buildSigninUrl: vi.fn(),
}))
vi.mock('@my/app/provider/dynamodb/repositories/send-record-repository', () => ({
  sendRecordRepository: { createSendRecord: h.createSendRecord, finalizeSendCounts: vi.fn() },
}))
vi.mock('@my/app/provider/dynamodb/repositories/send-recipient-repository', () => ({
  sendRecipientRepository: { snapshotRoster: vi.fn() },
}))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: vi.fn(async () => false),
}))

import { emailSend } from '../utils/email/email-send'

const NEWSLETTER = { listId: '11111111-1111-4111-8111-111111111111', key: 'newsletter', sesTopic: 'newsletter' }
const CAMBRIDGE = { listId: '22222222-2222-4222-8222-222222222222', key: 'memorial-recap' }

const sent = () =>
  h.sesSend.mock.calls.map((c) => ({
    to: c[0].input.Destination.ToAddresses[0],
    list: c[0].input.ListManagementOptions,
  }))

describe('emailSend — every send names a listId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.sesSend.mockResolvedValue({})
    h.safetyNetState.mockResolvedValue({ enabled: false })
  })

  it('no list given: resolves the reason default for the tenant and records its listId', async () => {
    h.resolveSendList.mockResolvedValue(NEWSLETTER)
    h.resolveSendAudience.mockResolvedValue({
      source: 'registry',
      listId: NEWSLETTER.listId,
      topicName: 'newsletter',
      emails: ['a@example.org'],
      stats: {},
    })
    const result = await emailSend({ reason: 'newsletter', emailHtml: '<p>x</p>', emailText: 'x' })

    expect(h.resolveSendList).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'newsletter', test: false, list: undefined })
    )
    expect(h.resolveSendAudience).toHaveBeenCalledWith(NEWSLETTER, { enabled: false })
    expect(sent()).toEqual([
      { to: 'a@example.org', list: { ContactListName: 'TEEAdmin', TopicName: 'newsletter' } },
    ])
    expect(h.createSendRecord).toHaveBeenCalledWith(expect.objectContaining({ listId: NEWSLETTER.listId }))
    expect(result).toMatchObject({ sends: ['a@example.org'], listId: NEWSLETTER.listId })
  })

  it('a list with no SES topic (before the safety net): sends naming the contact list only', async () => {
    h.resolveSendList.mockResolvedValue(CAMBRIDGE)
    h.resolveSendAudience.mockResolvedValue({
      source: 'registry',
      listId: CAMBRIDGE.listId,
      topicName: undefined,
      emails: ['b@example.org'],
      stats: {},
    })
    await emailSend({ reason: 'custom', emailHtml: '<p>x</p>', emailText: 'x', listId: CAMBRIDGE.listId })

    expect(h.resolveSendList).toHaveBeenCalledWith(expect.objectContaining({ list: CAMBRIDGE.listId }))
    expect(sent()).toEqual([{ to: 'b@example.org', list: { ContactListName: 'TEEAdmin' } }])
  })

  it('safety net on: the audience is asked with safetyNet=true and its topic is named', async () => {
    h.safetyNetState.mockResolvedValue({ enabled: true })
    h.resolveSendList.mockResolvedValue(NEWSLETTER)
    h.resolveSendAudience.mockResolvedValue({
      source: 'registry',
      listId: NEWSLETTER.listId,
      topicName: 'safetyNetDefault',
      emails: ['a@example.org'],
      stats: {},
    })
    await emailSend({ reason: 'newsletter', emailHtml: '<p>x</p>', emailText: 'x' })
    expect(h.resolveSendAudience).toHaveBeenCalledWith(NEWSLETTER, { enabled: true })
    expect(sent()[0].list).toEqual({ ContactListName: 'TEEAdmin', TopicName: 'safetyNetDefault' })
  })

  it('a test send asks for the test list (test=true), whatever list was named', async () => {
    h.resolveSendList.mockResolvedValue({ listId: '33333333-3333-4333-8333-333333333333', key: 'testList' })
    h.resolveSendAudience.mockResolvedValue({ source: 'registry', listId: 'x', emails: [], stats: {} })
    await emailSend({ reason: 'newsletter', emailHtml: '<p>x</p>', emailText: 'x', test: true, listId: CAMBRIDGE.listId })
    expect(h.resolveSendList).toHaveBeenCalledWith(expect.objectContaining({ test: true, list: CAMBRIDGE.listId }))
  })

  it('an unknown list throws before anything is read or sent', async () => {
    h.resolveSendList.mockRejectedValue(new Error('That list does not exist or is archived.'))
    await expect(
      emailSend({ reason: 'custom', emailHtml: '<p>x</p>', emailText: 'x', listId: 'nope' })
    ).rejects.toThrow('does not exist')
    expect(h.resolveSendAudience).not.toHaveBeenCalled()
    expect(h.sesSend).not.toHaveBeenCalled()
  })

  it('an unreadable safety-net setting stops the send (fails closed)', async () => {
    h.resolveSendList.mockResolvedValue(NEWSLETTER)
    h.safetyNetState.mockRejectedValue(new Error('DynamoDB unavailable'))
    await expect(
      emailSend({ reason: 'newsletter', emailHtml: '<p>x</p>', emailText: 'x' })
    ).rejects.toThrow('DynamoDB unavailable')
    expect(h.resolveSendAudience).not.toHaveBeenCalled()
    expect(h.sesSend).not.toHaveBeenCalled()
  })
})
