import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * #332: the Saturday job tells the Recording Brother when it can't prepare the
 * review copy. Its HTTP response goes to the scheduler, which discards it.
 */

const h = vi.hoisted(() => ({
  prepareHeadsUpForReview: vi.fn(),
  sendHeadsUpProblemNotice: vi.fn(),
}))

vi.mock('@/utils/email/exhorter-heads-up-review', () => ({
  prepareHeadsUpForReview: h.prepareHeadsUpForReview,
  sendHeadsUpProblemNotice: h.sendHeadsUpProblemNotice,
}))
vi.mock('@/utils/email/exhorter-heads-up', () => ({
  computeNextTargetSunday: () => '2026-11-29',
}))

const SECRET = 'test-secret'

// next/server is mocked in tests/setup.ts; a plain Request carries the
// headers, and the route also reads `nextUrl`.
function request(): any {
  const url = 'https://site.example/api/cron/exhorter-heads-up'
  const req = new Request(url, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } })
  return Object.assign(req, { nextUrl: new URL(url) })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EMAIL_SENDER_SECRET = SECRET
  h.sendHeadsUpProblemNotice.mockResolvedValue(true)
})

describe('cron exhorter-heads-up problem notice', () => {
  it('an unmatched name emails the reviewer what went wrong', async () => {
    h.prepareHeadsUpForReview.mockResolvedValue({
      parked: false,
      reviewerEmail: 'rb@example.com',
      report: { date: '2026-11-29', test: false, status: 'unresolved', matchStatus: 'not-found', exhortName: 'Ben Sample' },
    })
    const { POST } = await import('../app/api/cron/exhorter-heads-up/route')
    const res = await POST(request())
    const body = await res.json()
    expect(body.problemNotified).toBe(true)
    expect(h.sendHeadsUpProblemNotice).toHaveBeenCalledTimes(1)
    const arg = h.sendHeadsUpProblemNotice.mock.calls[0][0]
    expect(arg.date).toBe('2026-11-29')
    expect(arg.reviewerEmail).toBe('rb@example.com')
    expect(arg.problem.headline).toContain('"Ben Sample"')
  })

  it('a prepared review copy sends no warning', async () => {
    h.prepareHeadsUpForReview.mockResolvedValue({
      parked: true,
      reviewerEmail: 'rb@example.com',
      report: { date: '2026-11-29', test: false, status: 'dry-run' },
    })
    const { POST } = await import('../app/api/cron/exhorter-heads-up/route')
    const body = await (await POST(request())).json()
    expect(body.problemNotified).toBe(false)
    expect(h.sendHeadsUpProblemNotice).not.toHaveBeenCalled()
  })

  it('already sent is not a problem', async () => {
    h.prepareHeadsUpForReview.mockResolvedValue({
      parked: false,
      reviewerEmail: 'rb@example.com',
      report: { date: '2026-11-29', test: false, status: 'skipped:already-sent' },
    })
    const { POST } = await import('../app/api/cron/exhorter-heads-up/route')
    await POST(request())
    expect(h.sendHeadsUpProblemNotice).not.toHaveBeenCalled()
  })

  it('a job error still emails the reviewer', async () => {
    h.prepareHeadsUpForReview.mockRejectedValue(new Error('boom'))
    const { POST } = await import('../app/api/cron/exhorter-heads-up/route')
    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(h.sendHeadsUpProblemNotice).toHaveBeenCalledTimes(1)
    expect(h.sendHeadsUpProblemNotice.mock.calls[0][0].problem.headline).toMatch(/error/)
  })

  it('a failing warning email does not fail the job', async () => {
    h.prepareHeadsUpForReview.mockResolvedValue({
      parked: false,
      reviewerEmail: 'rb@example.com',
      report: { date: '2026-11-29', test: false, status: 'no-schedule-row' },
    })
    h.sendHeadsUpProblemNotice.mockRejectedValue(new Error('ses down'))
    const { POST } = await import('../app/api/cron/exhorter-heads-up/route')
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect((await res.json()).problemNotified).toBe(false)
  })
})
