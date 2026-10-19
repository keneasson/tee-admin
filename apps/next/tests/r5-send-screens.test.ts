import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

/**
 * R5 send screens: the audience picker lists every registry list by listId
 * with its derived name (including lists with no SES topic), and the
 * scheduled queue carries a schedule's listId through to emailSend.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  listAllLists: vi.fn(),
  resolveSendList: vi.fn(),
  getAllSchedules: vi.fn(),
  getQueueEntry: vi.fn(),
  addToQueue: vi.fn(),
  getReadyEmails: vi.fn(),
  getQueueByDateRange: vi.fn(),
  claimQueueEntry: vi.fn(),
  updateQueueStatus: vi.fn(),
  getEmailContent: vi.fn(),
  emailSend: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/config/tenants', () => ({
  getTenantFromHeaders: () => null,
  resolveTenantFromEnv: () => ({ id: 'tee', homeEcclesiaName: 'Toronto East Ecclesia' }),
}))
vi.mock('@my/app/provider/dynamodb/repositories/mailing-list-repository', () => ({
  mailingListRepository: { listAllLists: h.listAllLists },
}))
vi.mock('@/utils/mailing-lists/owners', async (orig) => ({
  ...(await orig<typeof import('../utils/mailing-lists/owners')>()),
  ownerNamesFor: vi.fn(
    async () =>
      new Map([
        ['ecclesia#toronto-east-ecclesia', 'Toronto East Ecclesia'],
        ['ecclesia#cambridge-ecclesia', 'Cambridge Ecclesia'],
      ])
  ),
}))
vi.mock('@/utils/mailing-lists/send-target', async (orig) => ({
  ...(await orig<typeof import('../utils/mailing-lists/send-target')>()),
  resolveSendList: h.resolveSendList,
}))
vi.mock('@my/app/provider/dynamodb/repositories/send-queue-repository', () => ({
  sendQueueRepo: {
    getAllSchedules: h.getAllSchedules,
    getQueueEntry: h.getQueueEntry,
    addToQueue: h.addToQueue,
    getReadyEmails: h.getReadyEmails,
    getQueueByDateRange: h.getQueueByDateRange,
    claimQueueEntry: h.claimQueueEntry,
    updateQueueStatus: h.updateQueueStatus,
  },
}))
vi.mock('@/utils/email/get-email-content', () => ({ getEmailContent: h.getEmailContent }))
vi.mock('@/utils/email/email-send', () => ({ emailSend: h.emailSend }))

import { GET as sendable } from '../app/api/admin/mailing-lists/sendable/route'
import { GET as cron } from '../app/api/cron/email-queue/route'

const req = (headers: Record<string, string> = {}) => ({ headers: new Headers(headers) }) as any

describe('GET /api/admin/mailing-lists/sendable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.listAllLists.mockResolvedValue([
      { listId: 'L-NEWS', key: 'newsletter', ownerType: 'ecclesia', ownerId: 'toronto-east-ecclesia', name: 'Newsletter', status: 'active', sesTopic: 'newsletter' },
      { listId: 'L-TEST', key: 'testList', ownerType: 'ecclesia', ownerId: 'toronto-east-ecclesia', name: 'Test List', status: 'active', sesTopic: 'testList' },
      { listId: 'L-CAM', key: 'memorial-recap', ownerType: 'ecclesia', ownerId: 'cambridge-ecclesia', name: 'Memorial Recap', status: 'active', defaultOptIn: true },
      { listId: 'L-OLD', key: 'old', ownerType: 'ecclesia', ownerId: 'cambridge-ecclesia', name: 'Old', status: 'archived' },
    ])
    h.resolveSendList.mockResolvedValue({ listId: 'L-NEWS' })
  })

  it('owner/admin only', async () => {
    h.auth.mockResolvedValueOnce(null)
    expect((await sendable(req())).status).toBe(401)
    h.auth.mockResolvedValueOnce({ user: { email: 'm@example.org', role: 'member' } })
    expect((await sendable(req())).status).toBe(403)
    expect(h.listAllLists).not.toHaveBeenCalled()
  })

  it('every active list by listId, named owner + list, a no-topic list included; default = newsletter', async () => {
    h.auth.mockResolvedValue({ user: { email: 'o@example.org', role: 'owner' } })
    const body = await (await sendable(req())).json()
    expect(body.lists).toEqual([
      { key: 'L-CAM', displayName: 'Cambridge Memorial Recap', defaultOptIn: true, listKey: 'memorial-recap', isTest: false },
      { key: 'L-NEWS', displayName: 'Toronto East Newsletter', defaultOptIn: false, listKey: 'newsletter', isTest: false },
      { key: 'L-TEST', displayName: 'Toronto East Test List', defaultOptIn: false, listKey: 'testList', isTest: true },
    ])
    expect(body.defaultListId).toBe('L-NEWS')
  })
})

describe('cron/email-queue carries a schedule listId to emailSend', () => {
  const SECRET = 'cron-secret'
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Thursday 12:05 Toronto time (EDT, UTC-4): midday, so the date is the same in any machine timezone.
    vi.setSystemTime(new Date('2026-10-22T16:05:00Z'))
    process.env.EMAIL_SENDER_SECRET = SECRET
    h.getAllSchedules.mockResolvedValue([
      { emailType: 'newsletter', dayOfWeek: 'thursday', time: '12:00', enabled: true, listId: 'L-CAM' },
    ])
    h.getQueueEntry.mockResolvedValue(null)
    h.addToQueue.mockResolvedValue({})
    h.getReadyEmails.mockResolvedValue([
      { emailType: 'newsletter', scheduledDate: '2026-10-22', scheduledTime: '12:00', status: 'ready', listId: 'L-CAM' },
    ])
    h.getQueueByDateRange.mockResolvedValue([])
    h.claimQueueEntry.mockResolvedValue({ claimedAt: 'now' })
    h.getEmailContent.mockResolvedValue(['<p>x</p>', 'x'])
    h.emailSend.mockResolvedValue({ sends: ['a@example.org'], skips: [], campaignId: 'c1' })
  })
  afterEach(() => vi.useRealTimers())

  it('queues with the schedule listId and sends to it', async () => {
    const res = await cron(req({ authorization: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
    expect(h.addToQueue).toHaveBeenCalledWith(expect.objectContaining({ emailType: 'newsletter', listId: 'L-CAM' }))
    expect(h.emailSend).toHaveBeenCalledWith(expect.objectContaining({ reason: 'newsletter', listId: 'L-CAM' }))
  })
})
