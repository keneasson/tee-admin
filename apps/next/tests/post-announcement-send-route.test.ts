import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ROLES } from '@my/app/provider/auth/auth-roles'

/**
 * Guard + audience/safety matrix for POST /api/admin/posts/[id]/send — the
 * Consolidated CMS send bridge (epic #131 §4). The safety-critical bits:
 *   - three-way gate (auth → owner/admin → CONSOLIDATED_CMS flag → 404),
 *   - status MUST be 'ready' (422 otherwise — never send a draft),
 *   - tenant isolation (403 when the post belongs to another ecclesia),
 *   - TEST BY DEFAULT (only an explicit `test: false` opts into a live send),
 *   - occasion-agnostic: emailSend is always reason 'post-announcement', the
 *     subject is the rendered post title, the audience is caller-chosen.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  checkFlag: vi.fn(),
  getPost: vi.fn(),
  getTenantFromHeaders: vi.fn(),
  resolveTenantFromEnv: vi.fn(),
  getPostAnnouncementContent: vi.fn(),
  emailSend: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { getPost: h.getPost },
}))
vi.mock('@my/app/config/tenants', () => ({
  getTenantFromHeaders: h.getTenantFromHeaders,
  resolveTenantFromEnv: h.resolveTenantFromEnv,
}))
vi.mock('../utils/email/get-post-announcement-content', () => ({
  getPostAnnouncementContent: h.getPostAnnouncementContent,
}))
vi.mock('../utils/email/email-send', () => ({ emailSend: h.emailSend }))

import { POST } from '../app/api/admin/posts/[id]/send/route'

const TENANT = {
  id: 'tee',
  senderDomain: 'tee-admin.com',
  publicName: 'Toronto East Christadelphians',
  homeEcclesiaName: 'Toronto East Ecclesia',
}

function req(body?: any) {
  return {
    json: async () => {
      if (body === undefined) throw new Error('no body')
      return body
    },
    headers: {},
    url: 'https://tee-admin.com/api/admin/posts/p1/send',
  } as any
}

const ctx = (id = 'p1') => ({ params: Promise.resolve({ id }) })

const OWNER = { user: { email: 'owner@tee-admin.com', role: ROLES.OWNER } }

function readyPost(over: Record<string, any> = {}) {
  return {
    id: 'p1',
    tenant: 'Toronto East Ecclesia',
    title: 'Baptism of A. Believer',
    status: 'ready',
    occasion: ['baptism'],
    blocks: [],
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(OWNER)
  h.checkFlag.mockResolvedValue(true)
  h.getPost.mockResolvedValue(readyPost())
  h.getTenantFromHeaders.mockReturnValue(TENANT)
  h.resolveTenantFromEnv.mockReturnValue(TENANT)
  h.getPostAnnouncementContent.mockResolvedValue([
    '<html>post</html>',
    'post text',
    'Baptism of A. Believer',
  ])
  h.emailSend.mockResolvedValue({ campaignId: 'c1', sends: ['a@b.com'], skips: [] })
})

describe('POST /api/admin/posts/[id]/send — gate', () => {
  it('401 when unauthenticated', async () => {
    h.auth.mockResolvedValue(null)
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(401)
    expect(h.emailSend).not.toHaveBeenCalled()
  })

  it('403 when not owner/admin', async () => {
    h.auth.mockResolvedValue({ user: { email: 'm@x.com', role: ROLES.MEMBER } })
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(403)
    expect(h.emailSend).not.toHaveBeenCalled()
  })

  it('404 when the CONSOLIDATED_CMS flag is off (dark until enabled)', async () => {
    h.checkFlag.mockResolvedValue(false)
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(404)
    expect(h.emailSend).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/posts/[id]/send — safety', () => {
  it('404 when the post does not exist', async () => {
    h.getPost.mockResolvedValue(null)
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(404)
    expect(h.emailSend).not.toHaveBeenCalled()
  })

  it('422 when the post is not ready (never send a draft)', async () => {
    h.getPost.mockResolvedValue(readyPost({ status: 'draft' }))
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(422)
    expect(h.emailSend).not.toHaveBeenCalled()
  })

  it('403 when the post belongs to another tenant', async () => {
    h.getPost.mockResolvedValue(readyPost({ tenant: 'Some Other Ecclesia' }))
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(403)
    expect(h.emailSend).not.toHaveBeenCalled()
  })

  it('400 when the requested audience is not a known list', async () => {
    const res = await POST(req({ list: 'not-a-real-list' }), ctx())
    expect(res.status).toBe(400)
    expect(h.emailSend).not.toHaveBeenCalled()
  })
})

describe('POST /api/admin/posts/[id]/send — send', () => {
  it('defaults to TEST mode with an empty body', async () => {
    const res = await POST(req({}), ctx())
    expect(res.status).toBe(200)
    expect(h.emailSend).toHaveBeenCalledTimes(1)
    const args = h.emailSend.mock.calls[0][0]
    expect(args.reason).toBe('post-announcement')
    expect(args.test).toBe(true)
    // Subject is always the rendered post title (occasion-agnostic).
    expect(args.customSubject).toBe('Baptism of A. Believer')
    // Default audience is the newsletter list.
    expect(args.customList).toBe('newsletter')
    const json = await res.json()
    expect(json.audience).toBe('testList')
  })

  it('sends live only on an explicit test:false, to the chosen audience', async () => {
    const res = await POST(req({ test: false, list: 'interEcclesia' }), ctx())
    expect(res.status).toBe(200)
    const args = h.emailSend.mock.calls[0][0]
    expect(args.test).toBe(false)
    expect(args.customList).toBe('interEcclesia')
    const json = await res.json()
    expect(json.audience).toBe('interEcclesia')
  })

  it('forwards the rendered html/text from getPostAnnouncementContent', async () => {
    await POST(req({ note: 'please share' }), ctx())
    expect(h.getPostAnnouncementContent).toHaveBeenCalledWith('p1', TENANT, 'please share')
    const args = h.emailSend.mock.calls[0][0]
    expect(args.emailHtml).toBe('<html>post</html>')
    expect(args.emailText).toBe('post text')
  })
})
