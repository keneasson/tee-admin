import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Discarding a draft is a HARD delete, on purpose: a draft never existed for
 * readers, was never emailed and is in nobody's newsletter, so destroying one
 * destroys nothing anybody saw.
 *
 * A PUBLISHED post is the opposite — it has been seen, possibly linked to and
 * possibly emailed — so it is refused rather than quietly archived. The caller
 * asked to destroy something and is told plainly that it will not happen, and
 * what to do instead.
 */
const h = vi.hoisted(() => ({
  auth: vi.fn(),
  checkFlag: vi.fn(),
  getPost: vi.fn(),
  deleteDraft: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { getPost: h.getPost, deleteDraft: h.deleteDraft },
}))

const { DELETE } = await import('../app/api/admin/posts/[id]/route')

const ctx = () => ({ params: Promise.resolve({ id: 'p1' }) })
const req = () => new Request('http://x/api/admin/posts/p1', { method: 'DELETE' }) as never

const post = (status: string) => ({ id: 'p1', status, tenant: 'Toronto East Ecclesia', title: 'T' })

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue({ user: { email: 'o@x.z', role: 'owner' } })
  h.checkFlag.mockResolvedValue(true)
  h.deleteDraft.mockResolvedValue(undefined)
})

describe('DELETE /api/admin/posts/[id]', () => {
  it('deletes a draft', async () => {
    h.getPost.mockResolvedValue(post('draft'))
    const res = await DELETE(req(), ctx())
    expect(res.status).toBe(200)
    expect(h.deleteDraft).toHaveBeenCalledWith('p1')
  })

  it('REFUSES a published post with 409, and does not delete', async () => {
    h.getPost.mockResolvedValue(post('published'))
    const res = await DELETE(req(), ctx())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ status: 'published' })
    expect(h.deleteDraft).not.toHaveBeenCalled()
  })

  it('refuses an archived post too — retirement is not deletion', async () => {
    h.getPost.mockResolvedValue(post('archived'))
    const res = await DELETE(req(), ctx())
    expect(res.status).toBe(409)
    expect(h.deleteDraft).not.toHaveBeenCalled()
  })

  it('404 when the post does not exist', async () => {
    h.getPost.mockResolvedValue(null)
    expect((await DELETE(req(), ctx())).status).toBe(404)
    expect(h.deleteDraft).not.toHaveBeenCalled()
  })

  it('401 when signed out', async () => {
    h.auth.mockResolvedValue(null)
    expect((await DELETE(req(), ctx())).status).toBe(401)
    expect(h.deleteDraft).not.toHaveBeenCalled()
  })

  it('403 for a non-admin', async () => {
    h.auth.mockResolvedValue({ user: { email: 'm@x.z', role: 'member' } })
    expect((await DELETE(req(), ctx())).status).toBe(403)
  })

  it('404 when CONSOLIDATED_CMS is off — the route stays invisible', async () => {
    h.checkFlag.mockResolvedValue(false)
    expect((await DELETE(req(), ctx())).status).toBe(404)
    expect(h.deleteDraft).not.toHaveBeenCalled()
  })
})
