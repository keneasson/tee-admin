import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Changing an address AND a phone number sent the member TWO emails minutes
 * apart. Each field is its own dialog and its own edit request, and the route
 * emailed once per request.
 *
 * For a 92-year-old that is not a minor annoyance — two separate "someone
 * suggested an edit to your…" messages read as two alarming events.
 *
 * A second notification from the SAME requester about the SAME person within
 * the window adds nothing: the first email already told them to review their
 * pending changes, and its link goes to the full list, which includes the new
 * one. So the request is still created; only the duplicate email is suppressed.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  createRequest: vi.fn(),
  getPendingRequests: vi.fn(),
  hasPendingRequestForField: vi.fn(),
  getByEmail: vi.fn(),
  sendEmail: vi.fn(),
  render: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('../utils/email/sesClient', () => ({ sendEmail: h.sendEmail }))
vi.mock('@react-email/render', () => ({ render: h.render }))
vi.mock('@my/app/provider/dynamodb/repositories/edit-request-repository', () => ({
  editRequestRepository: {
    createRequest: h.createRequest,
    getPendingRequests: h.getPendingRequests,
    hasPendingRequestForField: h.hasPendingRequestForField,
  },
}))
vi.mock('@my/app/provider/dynamodb/repositories/person-repository', () => ({
  personRepository: { getByEmail: h.getByEmail },
}))

const NOW = Date.now()
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

const post = (field: string) =>
  new Request('http://x/api/edit-requests', {
    method: 'POST',
    body: JSON.stringify({
      targetEmail: 'bgrosewood@gmail.com',
      field,
      suggestedValue: 'new value',
      currentValue: 'old value',
    }),
  }) as never

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'admin@x.z', name: 'Ken' } })
  h.render.mockResolvedValue('<html></html>')
  h.sendEmail.mockResolvedValue(undefined)
  h.getByEmail.mockResolvedValue({ personId: 'p1', firstName: 'Georgina' })
  h.createRequest.mockResolvedValue({ requestId: 'req-new', approvalToken: 'tok' })
  // The route already guards against a duplicate request for the SAME field;
  // coalescing is about different fields, so this stays false.
  h.hasPendingRequestForField.mockResolvedValue(false)
})

describe('edit-request notifications are coalesced', () => {
  it('sends the FIRST notification', async () => {
    const { POST } = await import('../app/api/edit-requests/route')
    h.getPendingRequests.mockResolvedValue([])

    await POST(post('address'))
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('suppresses a SECOND from the same requester inside the window', async () => {
    const { POST } = await import('../app/api/edit-requests/route')
    h.getPendingRequests.mockResolvedValue([
      { requestId: 'req-earlier', requesterEmail: 'admin@x.z', createdAt: minutesAgo(2) },
    ])

    await POST(post('phone'))
    expect(h.sendEmail).not.toHaveBeenCalled()
    // The request itself is STILL created — only the duplicate email is dropped.
    expect(h.createRequest).toHaveBeenCalled()
  })

  it('still notifies once the window has passed', async () => {
    const { POST } = await import('../app/api/edit-requests/route')
    h.getPendingRequests.mockResolvedValue([
      { requestId: 'req-old', requesterEmail: 'admin@x.z', createdAt: minutesAgo(60) },
    ])

    await POST(post('phone'))
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('still notifies for a DIFFERENT requester — that is genuinely new news', async () => {
    const { POST } = await import('../app/api/edit-requests/route')
    h.getPendingRequests.mockResolvedValue([
      { requestId: 'req-other', requesterEmail: 'someone-else@x.z', createdAt: minutesAgo(2) },
    ])

    await POST(post('phone'))
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('sends when the lookup fails — a duplicate beats a silent change', async () => {
    const { POST } = await import('../app/api/edit-requests/route')
    h.getPendingRequests.mockRejectedValue(new Error('dynamo down'))

    await POST(post('address'))
    expect(h.sendEmail).toHaveBeenCalledTimes(1)
  })
})
