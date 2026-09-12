import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Brian clicked the link to approve his own address change and got this, as raw
 * JSON on a black page:
 *
 *   { "error": "Invalid or expired token. The link may have expired." }
 *
 * Three separate defects sat behind that one screen:
 *   1. the token lookup used a SINGLE-PAGE scan, so a valid token five days
 *      from expiry was reported invalid,
 *   2. approving never APPLIED the change — the route carried only a TODO, so
 *      the request was marked 'approved' and the address stayed as it was,
 *   3. every outcome, success or failure, returned JSON to a person.
 */
const h = vi.hoisted(() => ({
  getRequestByToken: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
  applyApprovedEdit: vi.fn(),
}))

vi.mock('@my/app/provider/dynamodb/repositories/edit-request-repository', () => ({
  editRequestRepository: {
    getRequestByToken: h.getRequestByToken,
    approveRequest: h.approveRequest,
    rejectRequest: h.rejectRequest,
  },
}))
vi.mock('../utils/apply-approved-edit', () => ({ applyApprovedEdit: h.applyApprovedEdit }))

const REQUEST = {
  requestId: 'req-1',
  targetEmail: 'bgrosewood@gmail.com',
  field: 'address',
  suggestedValue: '12 New Rd, Peterborough, ON K9H 1A1',
  status: 'pending',
}

const get = (qs: string) =>
  new Request(`http://x/api/edit-requests/approve${qs}`) as never

beforeEach(() => {
  vi.clearAllMocks()
  h.getRequestByToken.mockResolvedValue({ ...REQUEST })
  h.approveRequest.mockResolvedValue({ ...REQUEST, status: 'approved' })
  h.rejectRequest.mockResolvedValue({ ...REQUEST, status: 'rejected' })
  h.applyApprovedEdit.mockResolvedValue({ applied: true })
})

describe('the approval link renders a page, never JSON', () => {
  it('returns HTML on success', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    const res = await GET(get('?token=t&action=approve'))
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('<!doctype html>')
    expect(body).not.toContain('"error"')
  })

  it('returns HTML on an expired token — what Brian actually hit', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    h.getRequestByToken.mockResolvedValue(null)
    const res = await GET(get('?token=stale&action=approve'))
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('expired')
    expect(body).toContain('Nothing has been changed')
    // Tells them who can help, rather than leaving them stuck.
    expect(body).toContain('Recording Brother')
  })

  it('returns HTML when something breaks, and says nothing changed', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    h.getRequestByToken.mockRejectedValue(new Error('dynamo down'))
    const res = await GET(get('?token=t&action=approve'))
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('have not been changed')
  })
})

describe('approving actually applies the change', () => {
  it('writes the value instead of only marking it approved', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    await GET(get('?token=t&action=approve'))
    expect(h.approveRequest).toHaveBeenCalled()
    expect(h.applyApprovedEdit).toHaveBeenCalledWith(expect.objectContaining({ field: 'address' }))
  })

  it('says so plainly when it could not be applied, rather than claiming success', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    h.applyApprovedEdit.mockResolvedValue({
      applied: false,
      reason: 'We could not read a city and province from that address.',
    })
    const body = await (await GET(get('?token=t&action=approve'))).text()
    expect(body).toContain('passed this on')
    expect(body).toContain('could not read a city')
    expect(body).not.toContain('your details are updated')
  })

  it('declining changes nothing and does not apply', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    const body = await (await GET(get('?token=t&action=reject'))).text()
    expect(h.rejectRequest).toHaveBeenCalled()
    expect(h.applyApprovedEdit).not.toHaveBeenCalled()
    expect(body).toContain('left exactly as it was')
  })

  it('an already-handled request is not applied twice', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    h.getRequestByToken.mockResolvedValue({ ...REQUEST, status: 'approved' })
    const body = await (await GET(get('?token=t&action=approve'))).text()
    expect(h.applyApprovedEdit).not.toHaveBeenCalled()
    expect(body).toContain('Already approved')
  })

  it('escapes the value so a stray quote cannot break the page', async () => {
    const { GET } = await import('../app/api/edit-requests/approve/route')
    h.getRequestByToken.mockResolvedValue({ ...REQUEST, suggestedValue: '<script>x</script>' })
    const body = await (await GET(get('?token=t&action=approve'))).text()
    expect(body).not.toContain('<script>x</script>')
    expect(body).toContain('&lt;script&gt;')
  })
})
