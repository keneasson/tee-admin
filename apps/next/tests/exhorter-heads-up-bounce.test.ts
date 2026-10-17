import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Re-sending a heads-up after the first one BOUNCED (#267).
 *
 * The SEND claim stops a speaker being told twice. A hard bounce means he was
 * never told, so the claim may be lifted — but only to send a corrected copy to
 * his CURRENT address, and only through the same QA redirect as the original.
 * Nothing in this path emails the speaker.
 */

const h = vi.hoisted(() => ({
  findPendingByToken: vi.fn(),
  getClaim: vi.fn(),
  reopenAfterBounce: vi.fn(),
  getById: vi.fn(),
  getCampaignRecipients: vi.fn(),
  prepareForReview: vi.fn(),
  checkSuppressed: vi.fn(),
}))

vi.mock('@my/app/provider/dynamodb/repositories/exhorter-headsup-repository', () => ({
  exhorterHeadsUpRepository: {
    findPendingByToken: h.findPendingByToken,
    getClaim: h.getClaim,
    reopenAfterBounce: h.reopenAfterBounce,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getById: h.getById },
}))
vi.mock('@my/app/provider/dynamodb/repositories/send-recipient-repository', () => ({
  sendRecipientRepository: { getCampaignRecipients: h.getCampaignRecipients },
}))
vi.mock('@/utils/email/exhorter-heads-up-review', () => ({
  prepareHeadsUpForReview: h.prepareForReview,
}))
vi.mock('@/utils/email/exhorter-heads-up', () => ({
  exhorterHeadsUpCampaignId: (d: string) => `exhorter-headsup-${d}`,
}))
vi.mock('@/utils/email/suppression-check', () => ({
  checkSuppressed: h.checkSuppressed,
}))

// Far enough ahead that the past-date guard never trips.
const DATE = '2099-11-01'
const RELEASED = {
  date: DATE,
  personId: 'p-1',
  token: 'tok',
  recipientEmail: 'dead@work.example',
  recipientName: 'A Brother',
  expiresAt: '2099-11-10T00:00:00Z',
  releasedAt: '2099-10-17T14:06:31Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  h.findPendingByToken.mockResolvedValue({ ...RELEASED })
  h.getClaim.mockResolvedValue({ sentTo: 'dead@work.example' })
  h.reopenAfterBounce.mockResolvedValue(true)
  h.getById.mockResolvedValue({ personId: 'p-1', primaryEmail: 'home@household.example' })
  h.getCampaignRecipients.mockResolvedValue([
    {
      email: 'dead@work.example',
      status: 'sent',
      bouncedAt: '2099-10-17T14:06:33Z',
      bounceType: 'Permanent',
    },
  ])
  h.checkSuppressed.mockResolvedValue({ suppressed: false })
  h.prepareForReview.mockResolvedValue({
    parked: true,
    reviewerEmail: 'rb@example.com',
    report: { date: DATE, status: 'dry-run' },
  })
})

describe('getBounceResendStatus', () => {
  it('is eligible when it bounced and his address on file has since changed', async () => {
    const { getBounceResendStatus } = await import('../utils/email/exhorter-heads-up-bounce')
    const s = await getBounceResendStatus({ ...RELEASED })
    expect(s).toMatchObject({ bounced: true, eligible: true, currentEmail: 'home@household.example' })
  })

  it('says nothing about a send that did not bounce', async () => {
    h.getCampaignRecipients.mockResolvedValue([{ email: 'dead@work.example', deliveredAt: 'x' }])
    const { getBounceResendStatus } = await import('../utils/email/exhorter-heads-up-bounce')
    expect(await getBounceResendStatus({ ...RELEASED })).toMatchObject({ bounced: false, eligible: false })
  })

  it('refuses while his address on file is still the one that bounced', async () => {
    h.getById.mockResolvedValue({ personId: 'p-1', primaryEmail: 'DEAD@work.example' })
    const { getBounceResendStatus } = await import('../utils/email/exhorter-heads-up-bounce')
    const s = await getBounceResendStatus({ ...RELEASED })
    expect(s.eligible).toBe(false)
    expect(s.reason).toMatch(/still the one that bounced/)
  })

  it('refuses a new address that SES would silently drop', async () => {
    h.checkSuppressed.mockResolvedValue({ suppressed: true, reason: 'BOUNCE' })
    const { getBounceResendStatus } = await import('../utils/email/exhorter-heads-up-bounce')
    const s = await getBounceResendStatus({ ...RELEASED })
    expect(s.eligible).toBe(false)
    expect(s.reason).toMatch(/suppression list/)
  })

  it('reports it resolved once a corrected copy has gone out', async () => {
    h.getClaim.mockResolvedValue({ sentTo: 'home@household.example' })
    const { getBounceResendStatus } = await import('../utils/email/exhorter-heads-up-bounce')
    const s = await getBounceResendStatus({ ...RELEASED })
    expect(s).toMatchObject({ resolved: true, eligible: false })
  })

  it('refuses a Sunday that has passed', async () => {
    const { getBounceResendStatus } = await import('../utils/email/exhorter-heads-up-bounce')
    const s = await getBounceResendStatus({ ...RELEASED, date: '2020-01-05' })
    expect(s.eligible).toBe(false)
  })
})

describe('reopenBouncedHeadsUp', () => {
  it('lifts the claim, then redirects a corrected QA copy — and sends nothing to him', async () => {
    const { reopenBouncedHeadsUp } = await import('../utils/email/exhorter-heads-up-bounce')
    const r = await reopenBouncedHeadsUp('tok', 'owner@example.com')
    expect(r).toMatchObject({ ok: true, redirectedTo: 'rb@example.com', currentEmail: 'home@household.example' })

    expect(h.reopenAfterBounce).toHaveBeenCalledWith(
      expect.objectContaining({
        date: DATE,
        personId: 'p-1',
        bouncedAddress: 'dead@work.example',
        bounceType: 'Permanent',
        reopenedBy: 'owner@example.com',
      })
    )
    // The claim must be lifted BEFORE preparing, or the QA path reports
    // "already sent" and parks nothing.
    expect(h.reopenAfterBounce.mock.invocationCallOrder[0]).toBeLessThan(
      h.prepareForReview.mock.invocationCallOrder[0]
    )
    // Only the QA redirect — never a direct send.
    expect(h.prepareForReview).toHaveBeenCalledWith({ date: DATE })
  })

  it('changes nothing when the send has not bounced', async () => {
    h.getCampaignRecipients.mockResolvedValue([])
    const { reopenBouncedHeadsUp } = await import('../utils/email/exhorter-heads-up-bounce')
    const r = await reopenBouncedHeadsUp('tok', 'owner@example.com')
    expect(r.ok).toBe(false)
    expect(h.reopenAfterBounce).not.toHaveBeenCalled()
    expect(h.prepareForReview).not.toHaveBeenCalled()
  })

  it('changes nothing for a copy that was never sent', async () => {
    h.findPendingByToken.mockResolvedValue({ ...RELEASED, releasedAt: undefined })
    const { reopenBouncedHeadsUp } = await import('../utils/email/exhorter-heads-up-bounce')
    const r = await reopenBouncedHeadsUp('tok', 'owner@example.com')
    expect(r.ok).toBe(false)
    expect(h.reopenAfterBounce).not.toHaveBeenCalled()
  })

  it('changes nothing while the address on file is still the dead one', async () => {
    h.getById.mockResolvedValue({ personId: 'p-1', primaryEmail: 'dead@work.example' })
    const { reopenBouncedHeadsUp } = await import('../utils/email/exhorter-heads-up-bounce')
    const r = await reopenBouncedHeadsUp('tok', 'owner@example.com')
    expect(r.ok).toBe(false)
    expect(h.reopenAfterBounce).not.toHaveBeenCalled()
  })

  it('does not prepare when the claim could not be lifted', async () => {
    h.reopenAfterBounce.mockResolvedValue(false)
    const { reopenBouncedHeadsUp } = await import('../utils/email/exhorter-heads-up-bounce')
    const r = await reopenBouncedHeadsUp('tok', 'owner@example.com')
    expect(r.ok).toBe(false)
    expect(h.prepareForReview).not.toHaveBeenCalled()
  })
})
