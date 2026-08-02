import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * Guard matrix for GET /api/admin/posts/[id]/series (Consolidated CMS epic
 * #131, Connect/series). Same three-way gate as the other admin Posts routes
 * — authenticated → owner/admin → CONSOLIDATED_CMS flag ON (else 404).
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  checkFlag: vi.fn(),
  getPost: vi.fn(),
  getSeriesForPost: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { getPost: h.getPost },
}))
vi.mock('@my/app/services/post-service', () => ({
  getSeriesForPost: h.getSeriesForPost,
}))

import { GET } from '../app/api/admin/posts/[id]/series/route'

const OWNER = { user: { email: 'owner@tee-admin.com', role: ROLES.OWNER } }
const MEMBER = { user: { email: 'm@x.com', role: ROLES.MEMBER } }

function req() {
  return {} as any
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(OWNER)
  h.checkFlag.mockResolvedValue(true)
  h.getPost.mockResolvedValue({ id: 'p1', seriesId: 'tfg' })
  h.getSeriesForPost.mockResolvedValue([{ id: 'p2', title: 'Sibling' }])
})

describe('GET /api/admin/posts/[id]/series — gate', () => {
  it('401 when unauthenticated', async () => {
    h.auth.mockResolvedValue(null)
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(401)
    expect(h.getSeriesForPost).not.toHaveBeenCalled()
  })

  it('403 when not owner/admin', async () => {
    h.auth.mockResolvedValue(MEMBER)
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(403)
    expect(h.getSeriesForPost).not.toHaveBeenCalled()
  })

  it('404 when the CONSOLIDATED_CMS flag is OFF', async () => {
    h.checkFlag.mockResolvedValue(false)
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(404)
    expect(h.getSeriesForPost).not.toHaveBeenCalled()
  })

  it('404 when the post does not exist', async () => {
    h.getPost.mockResolvedValue(null)
    const res = await GET(req(), ctx('missing'))
    expect(res.status).toBe(404)
    expect(h.getSeriesForPost).not.toHaveBeenCalled()
  })

  it('200 returns the series siblings when authorized + flag ON', async () => {
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ id: 'p2', title: 'Sibling' }])
    expect(h.getSeriesForPost).toHaveBeenCalledWith({ id: 'p1', seriesId: 'tfg' })
  })
})
