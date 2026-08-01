import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * Guard matrix for the admin Posts API (Consolidated CMS Phase 2a). The
 * safety-critical bits: three-way gate in order — authenticated → owner/admin →
 * CONSOLIDATED_CMS flag ON (else 404) — on BOTH create (POST) and list (GET).
 * Only when all three pass does it touch the repository.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  checkFlag: vi.fn(),
  listPosts: vi.fn(),
  createPost: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { listPosts: h.listPosts, createPost: h.createPost },
}))

import { GET, POST } from '../app/api/admin/posts/route'

const OWNER = { user: { email: 'owner@tee-admin.com', role: ROLES.OWNER } }
const MEMBER = { user: { email: 'm@x.com', role: ROLES.MEMBER } }

function getReq() {
  return { url: 'http://localhost/api/admin/posts' } as any
}
function postReq(body: any) {
  return { url: 'http://localhost/api/admin/posts', json: async () => body } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(OWNER)
  h.checkFlag.mockResolvedValue(true)
  h.listPosts.mockResolvedValue({ posts: [{ id: 'p1' }] })
  h.createPost.mockResolvedValue({ id: 'new-id', title: 'Hi' })
})

describe('GET /api/admin/posts — gate', () => {
  it('401 when unauthenticated', async () => {
    h.auth.mockResolvedValue(null)
    const res = await GET(getReq())
    expect(res.status).toBe(401)
    expect(h.listPosts).not.toHaveBeenCalled()
  })

  it('403 when not owner/admin', async () => {
    h.auth.mockResolvedValue(MEMBER)
    const res = await GET(getReq())
    expect(res.status).toBe(403)
    expect(h.listPosts).not.toHaveBeenCalled()
  })

  it('404 when the CONSOLIDATED_CMS flag is OFF (feature hidden)', async () => {
    h.checkFlag.mockResolvedValue(false)
    const res = await GET(getReq())
    expect(res.status).toBe(404)
    expect(h.listPosts).not.toHaveBeenCalled()
  })

  it('200 returns the tenant posts when authorized + flag ON', async () => {
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'p1' }])
    expect(h.listPosts).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/admin/posts — gate + create', () => {
  it('401 when unauthenticated', async () => {
    h.auth.mockResolvedValue(null)
    const res = await POST(postReq({ title: 'Hi' }))
    expect(res.status).toBe(401)
    expect(h.createPost).not.toHaveBeenCalled()
  })

  it('403 when not owner/admin', async () => {
    h.auth.mockResolvedValue(MEMBER)
    const res = await POST(postReq({ title: 'Hi' }))
    expect(res.status).toBe(403)
    expect(h.createPost).not.toHaveBeenCalled()
  })

  it('404 when the flag is OFF', async () => {
    h.checkFlag.mockResolvedValue(false)
    const res = await POST(postReq({ title: 'Hi' }))
    expect(res.status).toBe(404)
    expect(h.createPost).not.toHaveBeenCalled()
  })

  it('201 creates with the author derived from the session', async () => {
    const res = await POST(postReq({ title: 'Hi', blocks: [] }))
    expect(res.status).toBe(201)
    expect(h.createPost).toHaveBeenCalledTimes(1)
    const arg = h.createPost.mock.calls[0][0]
    expect(arg.authorId).toBe('owner@tee-admin.com') // never trusts a client-supplied author
    expect(arg.title).toBe('Hi')
  })
})
