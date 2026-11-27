/**
 * The send guard (#349): nothing is ever sent to an undeliverable (.invalid)
 * address or a test persona, on either SES path. Placeholder data only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  sesSend: vi.fn(),
  resolveSendList: vi.fn(),
  resolveSendAudience: vi.fn(),
  safetyNetState: vi.fn(),
  createSendRecord: vi.fn(),
  fromOffices: vi.fn(),
}))

vi.mock('../utils/email/inter-ecclesia-recipients', () => ({ interEcclesiaRecipientsFromOffices: h.fromOffices }))
vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn(),
  SendEmailCommand: vi.fn().mockImplementation((input) => ({ input })),
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
import { shouldSkipRecipient, dropUnsendable } from '../utils/email/send-guard'
import { emailSend } from '../utils/email/email-send'
import { GlobalRef, sendEmail } from '../utils/email/sesClient'
import { TEST_PERSONAS } from '@my/app/utils/test-personas'

// The real sesClient module; only the SES client it hands out is faked.
new GlobalRef<any>('sesConnection').value = { send: h.sesSend }

describe('shouldSkipRecipient', () => {
  it('skips every test persona and any .invalid address', () => {
    for (const p of TEST_PERSONAS) expect(shouldSkipRecipient(p.email)).toBe(true)
    expect(shouldSkipRecipient('Anyone@Example.INVALID')).toBe(true)
    expect(shouldSkipRecipient('  someone@nowhere.invalid  ')).toBe(true)
  })
  it('does not skip a normal address (including one that merely contains "invalid")', () => {
    expect(shouldSkipRecipient('someone@example.org')).toBe(false)
    expect(shouldSkipRecipient('invalid@example.org')).toBe(false)
    expect(shouldSkipRecipient('someone@invalid.example.org')).toBe(false)
    expect(shouldSkipRecipient('')).toBe(false)
  })
  it('dropUnsendable keeps only deliverable addresses', () => {
    expect(dropUnsendable(['a@example.org', TEST_PERSONAS[0].email])).toEqual(['a@example.org'])
  })
})

describe('the broadcast path (emailSend)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.sesSend.mockResolvedValue({})
    h.safetyNetState.mockResolvedValue({ enabled: false })
    h.fromOffices.mockResolvedValue(null)
    h.resolveSendList.mockResolvedValue({ listId: '11111111-1111-4111-8111-111111111111', key: 'newsletter', sesTopic: 'newsletter' })
  })

  it('never calls SES for a test persona in the audience; real recipients still get it', async () => {
    h.resolveSendAudience.mockResolvedValue({
      source: 'registry',
      listId: '11111111-1111-4111-8111-111111111111',
      topicName: undefined,
      emails: ['list@example.org', TEST_PERSONAS[0].email, 'other@nowhere.invalid'],
      stats: {},
    })
    await emailSend({ reason: 'newsletter', emailHtml: '<p>x</p>', emailText: 'x' })
    const to = h.sesSend.mock.calls.map((c) => c[0].input.Destination.ToAddresses[0])
    expect(to).toEqual(['list@example.org'])
  })
})

describe('the 1:1 / transactional path (sendEmail)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.sesSend.mockResolvedValue({})
  })
  it('skips a test persona', async () => {
    await sendEmail({ to: TEST_PERSONAS[1].email, subject: 's', body: '<p>b</p>' })
    expect(h.sesSend).not.toHaveBeenCalled()
  })
  it('still sends to a normal address', async () => {
    await sendEmail({ to: 'someone@example.org', subject: 's', body: '<p>b</p>' })
    expect(h.sesSend).toHaveBeenCalledTimes(1)
  })
})
