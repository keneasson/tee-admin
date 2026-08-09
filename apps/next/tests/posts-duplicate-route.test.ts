import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * Guard matrix for POST /api/admin/posts/[id]/duplicate (Consolidated CMS
 * epic #131, Duplicate/replicate). Same three-way gate as the other admin
 * Posts routes — authenticated → owner/admin → CONSOLIDATED_CMS flag ON (else
 * 404) — and the author is always derived from the session, never the client.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  checkFlag: vi.fn(),
  duplicatePost: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { duplicatePost: h.duplicatePost },
}))

import { POST } from '../app/api/admin/posts/[id]/duplicate/route'

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
  h.duplicatePost.mockResolvedValue({ id: 'new-draft-id', status: 'draft', title: 'Copy' })
})

describe('POST /api/admin/posts/[id]/duplicate — gate', () => {
  it('401 when unauthenticated', async () => {
    h.auth.mockResolvedValue(null)
    const res = await POST(req(), ctx('src-1'))
    expect(res.status).toBe(401)
    expect(h.duplicatePost).not.toHaveBeenCalled()
  })

  it('403 when not owner/admin', async () => {
    h.auth.mockResolvedValue(MEMBER)
    const res = await POST(req(), ctx('src-1'))
    expect(res.status).toBe(403)
    expect(h.duplicatePost).not.toHaveBeenCalled()
  })

  it('404 when the CONSOLIDATED_CMS flag is OFF (feature hidden)', async () => {
    h.checkFlag.mockResolvedValue(false)
    const res = await POST(req(), ctx('src-1'))
    expect(res.status).toBe(404)
    expect(h.duplicatePost).not.toHaveBeenCalled()
  })

  it('404 when the source post does not exist', async () => {
    h.duplicatePost.mockRejectedValue(new Error('Post src-1 not found'))
    const res = await POST(req(), ctx('src-1'))
    expect(res.status).toBe(404)
  })

  it('201 duplicates with the author derived from the session, never the client', async () => {
    const res = await POST(req(), ctx('src-1'))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'new-draft-id', status: 'draft', title: 'Copy' })
    expect(h.duplicatePost).toHaveBeenCalledTimes(1)
    expect(h.duplicatePost).toHaveBeenCalledWith('src-1', 'owner@tee-admin.com')
  })
})
