import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * The review route is where a human's approval turns into a real email to a
 * brother, so its guards are the safety-critical part of #124.
 *
 * The rule the shape exists to enforce: **GET causes nothing.** The QA copy
 * carries a footer link; mail clients prefetch and scan links, so if fetching
 * it had done the sending it could have fired before anybody read a word.
 * Sending is a POST from a deliberate press on the page it opens.
 *
 * The email itself is not served here — it was read in an inbox, which is the
 * point of redirecting it. This route only confirms and sends.
 */

const h = vi.hoisted(() => ({
  findPendingByToken: vi.fn(),
  markReleased: vi.fn(),
  resolveAndSend: vi.fn(),
  renderPreview: vi.fn(),
}))

vi.mock('@my/app/provider/dynamodb/repositories/exhorter-headsup-repository', () => ({
  exhorterHeadsUpRepository: {
    findPendingByToken: h.findPendingByToken,
    markReleased: h.markReleased,
  },
}))
vi.mock('@/utils/email/exhorter-heads-up', () => ({
  resolveAndSendExhorterHeadsUp: h.resolveAndSend,
  renderHeadsUpPreview: h.renderPreview,
}))

const TOKEN = 'tok-abc'
const PENDING = {
  date: '2026-09-20',
  personId: 'p-brad',
  token: TOKEN,
  recipientEmail: 'brad@example.com',
  recipientName: 'Brad Stephens',
  previewedBy: 'rb@tee-admin.com',
  contentDigest: 'abc123def456abc123def456abc12345',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
}

const req = (method: 'GET' | 'POST') =>
  new Request(`http://x/api/admin/exhorter-heads-up/review?token=${TOKEN}`, {
    method,
    ...(method === 'POST' ? { body: JSON.stringify({ token: TOKEN }) } : {}),
  }) as never

beforeEach(() => {
  vi.clearAllMocks()
  h.findPendingByToken.mockResolvedValue({ ...PENDING })
  h.markReleased.mockResolvedValue(true)
  h.renderPreview.mockResolvedValue({
    personId: 'p-brad',
    subject: 'Your exhortation at Toronto East on Sunday, September 20, 2026',
    html: '<html>the email</html>',
    text: 'the email',
    status: 'dry-run',
  })
  h.resolveAndSend.mockResolvedValue({
    date: PENDING.date,
    test: false,
    status: 'sent',
    sentTo: 'brad@example.com',
  })
})

describe('GET — opening the page sends nothing', () => {
  it('confirms who it goes to, and writes nothing at all', async () => {
    const { GET } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipientEmail).toBe('brad@example.com')
    // The email is NOT served here: it was read in an inbox, which is the
    // whole point. Re-rendering it would invite checking it in a simulation.
    expect(body.html).toBeUndefined()

    // The whole point. A prefetching mail client must not send anything.
    expect(h.resolveAndSend).not.toHaveBeenCalled()
    expect(h.markReleased).not.toHaveBeenCalled()
  })

  it('flags a schedule that now names somebody else', async () => {
    h.renderPreview.mockResolvedValue({
      personId: 'someone-else',
      subject: 's',
      html: '<html/>',
      text: '',
      status: 'dry-run',
    })
    const { GET } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const body = await (await GET(req('GET'))).json()
    expect(body.changed).toBe(true)
  })

  it('refuses an unknown, expired or already-sent link, still without sending', async () => {
    const { GET } = await import('../app/api/admin/exhorter-heads-up/review/route')

    h.findPendingByToken.mockResolvedValue(null)
    expect((await GET(req('GET'))).status).toBe(404)

    h.findPendingByToken.mockResolvedValue({ ...PENDING, releasedAt: '2026-09-06T10:00:00Z' })
    expect((await GET(req('GET'))).status).toBe(409)

    h.findPendingByToken.mockResolvedValue({ ...PENDING, expiresAt: '2020-01-01T00:00:00Z' })
    expect((await GET(req('GET'))).status).toBe(410)

    expect(h.resolveAndSend).not.toHaveBeenCalled()
  })
})

describe('POST — pressing the button sends it, once', () => {
  it('sends to the exhorter and reports where it went', async () => {
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(req('POST'))
    expect(res.status).toBe(200)
    expect((await res.json()).sentTo).toBe('brad@example.com')

    // Live, and pinned to BOTH the brother and the email that was QA'd.
    const args = h.resolveAndSend.mock.calls[0][0]
    expect(args.test).toBe(false)
    expect(args.expectPersonId).toBe('p-brad')
    // Taken from the parked record, NOT from the request body — the browser
    // never saw the email, so a client-supplied digest would be the caller
    // vouching for itself.
    expect(args.expectContentDigest).toBe('abc123def456abc123def456abc12345')
  })

  it('claims the approval BEFORE sending, so a double press cannot send twice', async () => {
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    await POST(req('POST'))

    const releaseOrder = h.markReleased.mock.invocationCallOrder[0]
    const sendOrder = h.resolveAndSend.mock.invocationCallOrder[0]
    expect(releaseOrder).toBeLessThan(sendOrder)
  })

  it('sends nothing when the approval was already claimed', async () => {
    h.markReleased.mockResolvedValue(false)
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(req('POST'))
    expect(res.status).toBe(409)
    expect((await res.json()).alreadySent).toBe(true)
    expect(h.resolveAndSend).not.toHaveBeenCalled()
  })

  it('reports rather than pretends when the service refuses to send', async () => {
    h.resolveAndSend.mockResolvedValue({
      date: PENDING.date,
      test: false,
      status: 'skipped:exhorter-changed',
      note: 'The schedule now shows a different exhorter for 2026-09-20.',
    })
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(req('POST'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.status).toBe('skipped:exhorter-changed')
    expect(body.error).toMatch(/different exhorter/i)
  })
})
