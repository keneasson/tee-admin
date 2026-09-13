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
  supersedePending: vi.fn(),
  findCurrentPending: vi.fn(),
  resolveAndSend: vi.fn(),
  renderPreview: vi.fn(),
  prepareForReview: vi.fn(),
  auth: vi.fn(),
}))

// The route imports `auth` for the no-token path; NextAuth initialises at
// import time and throws in a test process, so it is stubbed here.
vi.mock('@/utils/auth', () => ({ auth: h.auth }))

vi.mock('@my/app/provider/dynamodb/repositories/exhorter-headsup-repository', () => ({
  exhorterHeadsUpRepository: {
    findPendingByToken: h.findPendingByToken,
    markReleased: h.markReleased,
    supersedePending: h.supersedePending,
    findCurrentPending: h.findCurrentPending,
  },
}))
vi.mock('@/utils/email/exhorter-heads-up-review', () => ({
  prepareHeadsUpForReview: h.prepareForReview,
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
  h.supersedePending.mockResolvedValue(1)
  h.auth.mockResolvedValue({ user: { email: 'rb@tee-admin.com', role: 'owner' } })
  h.findCurrentPending.mockResolvedValue(null)
  h.prepareForReview.mockResolvedValue({
    parked: true,
    reviewerEmail: 'rb@tee-admin.com',
    report: { date: '2026-09-20', test: false, status: 'dry-run' },
  })
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

const post = (body: Record<string, unknown>) =>
  new Request('http://x/api/admin/exhorter-heads-up/review', {
    method: 'POST',
    body: JSON.stringify({ token: TOKEN, ...body }),
  }) as never

/**
 * "Stop! there's a problem."
 *
 * Pressed the moment a mistake is spotted in the QA copy — BEFORE going away to
 * correct the Program. The wrong email has to stop being sendable straight
 * away, not once the fix is done.
 */
describe('stopping a copy that is wrong', () => {
  it('invalidates it immediately and emails nobody', async () => {
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(post({ action: 'invalidate' }))
    expect(res.status).toBe(200)
    expect((await res.json()).invalidated).toBe(true)

    expect(h.supersedePending).toHaveBeenCalledWith('2026-09-20', 'p-brad')
    expect(h.resolveAndSend).not.toHaveBeenCalled()
    expect(h.prepareForReview).not.toHaveBeenCalled()
  })

  it('refuses to stop something that already went to the brother', async () => {
    h.findPendingByToken.mockResolvedValue({ ...PENDING, releasedAt: '2026-09-06T10:00:00Z' })
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(post({ action: 'invalidate' }))
    expect(res.status).toBe(409)
    expect(h.supersedePending).not.toHaveBeenCalled()
  })

  it('a stopped copy can no longer be sent', async () => {
    h.findPendingByToken.mockResolvedValue({ ...PENDING, supersededAt: '2026-09-06T10:00:00Z' })
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(post({}))
    expect(res.status).toBe(409)
    expect((await res.json()).superseded).toBe(true)
    expect(h.resolveAndSend).not.toHaveBeenCalled()
    expect(h.markReleased).not.toHaveBeenCalled()
  })

  it('opening a stopped copy explains what to do rather than dead-ending', async () => {
    h.findPendingByToken.mockResolvedValue({ ...PENDING, supersededAt: '2026-09-06T10:00:00Z' })
    const { GET } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const body = await (await GET(req('GET'))).json()
    expect(body.superseded).toBe(true)
    expect(body.date).toBe('2026-09-20')
    expect(body.error).toMatch(/re-send the verification email/i)
  })
})

describe('re-sending the verification email after the fix', () => {
  it('renders from the CURRENT schedule and redirects a fresh copy', async () => {
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(post({ action: 'resend' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resent).toBe(true)
    expect(body.redirectedTo).toBe('rb@tee-admin.com')
    expect(h.prepareForReview).toHaveBeenCalledWith({ date: '2026-09-20' })
    // Still nothing to the exhorter.
    expect(h.resolveAndSend).not.toHaveBeenCalled()
  })

  it('works from a STOPPED link — that is how you get back after fixing', async () => {
    h.findPendingByToken.mockResolvedValue({ ...PENDING, supersededAt: '2026-09-06T10:00:00Z' })
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(post({ action: 'resend' }))
    expect(res.status).toBe(200)
    expect(h.prepareForReview).toHaveBeenCalled()
  })

  it('reports when the schedule still cannot produce an email', async () => {
    h.prepareForReview.mockResolvedValue({
      parked: false,
      report: { date: '2026-09-20', test: false, status: 'unresolved' },
    })
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(post({ action: 'resend' }))
    expect(res.status).toBe(409)
    expect((await res.json()).status).toBe('unresolved')
  })

  it('will not re-send once it has gone to the brother', async () => {
    h.findPendingByToken.mockResolvedValue({ ...PENDING, releasedAt: '2026-09-06T10:00:00Z' })
    const { POST } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await POST(post({ action: 'resend' }))
    expect(res.status).toBe(409)
    expect(h.prepareForReview).not.toHaveBeenCalled()
  })
})

/**
 * The page has to be FINDABLE, not only reachable from a link in an email.
 * Opened directly it answers "what is waiting?" on its own — and most of the
 * time the honest answer is "nothing".
 */
describe('opening the page directly, with no token', () => {
  const bare = () =>
    new Request('http://x/api/admin/exhorter-heads-up/review', { method: 'GET' }) as never

  it('shows the copy currently awaiting verification', async () => {
    h.findCurrentPending.mockResolvedValue({ ...PENDING })
    const { GET } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await GET(bare())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.recipientEmail).toBe('brad@example.com')
    // The page was not given a token, so the server supplies the one to act on.
    expect(body.token).toBe(TOKEN)
    expect(h.resolveAndSend).not.toHaveBeenCalled()
  })

  it('says plainly when nothing is waiting — not an error', async () => {
    h.findCurrentPending.mockResolvedValue(null)
    const { GET } = await import('../app/api/admin/exhorter-heads-up/review/route')
    const res = await GET(bare())
    expect(res.status).toBe(200)
    expect((await res.json()).nothingWaiting).toBe(true)
  })

  it('requires an admin, since no token vouches for the caller', async () => {
    h.auth.mockResolvedValue({ user: { email: 'member@x.z', role: 'member' } })
    const { GET } = await import('../app/api/admin/exhorter-heads-up/review/route')
    expect((await GET(bare())).status).toBe(403)

    h.auth.mockResolvedValue(null)
    expect((await GET(bare())).status).toBe(403)
  })
})
