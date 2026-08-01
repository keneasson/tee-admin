import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import type { Post } from '@my/app/types/post'

/**
 * Public Post read route guard + redaction (Consolidated CMS Phase 3).
 *
 * The safety-critical bits: the feature is HIDDEN while the CONSOLIDATED_CMS
 * flag is OFF (404, repo never touched), drafts never leak, and — crucially —
 * the response is passed through the REAL `redactPost` at the `public-web` tier
 * so an anonymous caller never receives un-redacted PII (surnames, members-only
 * blocks). Only `redactPost` is left un-mocked; everything else is stubbed in
 * the style of `posts-route.test.ts`.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  checkFlag: vi.fn(),
  getPost: vi.fn(),
  resolveViewer: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('../utils/resolve-viewer', () => ({ resolveViewer: h.resolveViewer }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { getPost: h.getPost },
}))

import { GET } from '../app/api/posts/[id]/route'

function req() {
  return {} as any
}
function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

/** A ready, public post carrying PII the redactor must scrub for anon. */
function samplePost(): Post {
  const now = new Date().toISOString()
  return {
    id: 'p1',
    tenant: 'demo',
    authorId: 'a',
    title: 'Baptism',
    occasion: ['baptism'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: { publishDate: '2026-08-01' },
    status: 'ready',
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: 'b-person',
        kind: 'person',
        role: 'candidate',
        people: [{ id: 'pp', firstName: 'Sarah', lastName: 'Thompson' }],
      },
      // Members-only text block — must be dropped for an anonymous viewer.
      { id: 'b-secret', kind: 'text', body: 'private note', containsPii: true, visibility: 'members' },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(null)
  h.checkFlag.mockResolvedValue(true)
  h.resolveViewer.mockResolvedValue(ANONYMOUS_VIEWER)
  h.getPost.mockResolvedValue(samplePost())
})

describe('GET /api/posts/[id] — gate', () => {
  it('404 when the CONSOLIDATED_CMS flag is OFF (feature hidden), repo untouched', async () => {
    h.checkFlag.mockResolvedValue(false)
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(404)
    expect(h.getPost).not.toHaveBeenCalled()
  })

  it('404 when the post does not exist', async () => {
    h.getPost.mockResolvedValue(null)
    const res = await GET(req(), ctx('missing'))
    expect(res.status).toBe(404)
  })

  it('404 for a draft post (never leak an unpublished draft)', async () => {
    h.getPost.mockResolvedValue({ ...samplePost(), status: 'draft' })
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(404)
  })

  it('404 when the viewer cannot reach the post visibility', async () => {
    h.getPost.mockResolvedValue({ ...samplePost(), visibility: 'members' })
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(404) // redactPost → null for anonymous
  })
})

describe('GET /api/posts/[id] — redaction applied', () => {
  it('200 returns the post with PII scrubbed for an anonymous viewer', async () => {
    const res = await GET(req(), ctx('p1'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Post

    // Reach check happened at the public-web tier.
    expect(h.resolveViewer).toHaveBeenCalledTimes(1)

    // Surname was stripped (first-name floor kept).
    const person = body.blocks.find((b) => b.kind === 'person') as any
    expect(person.people[0].firstName).toBe('Sarah')
    expect(person.people[0].lastName).toBeUndefined()

    // Members-only block dropped entirely for anon.
    expect(body.blocks.find((b) => b.id === 'b-secret')).toBeUndefined()
  })

  it('reveals full names for a verified member viewer', async () => {
    const member: Viewer = {
      assurance: 'authenticated',
      role: 'member',
      tenant: 'demo',
      email: 'm@demo.test',
    }
    h.resolveViewer.mockResolvedValue(member)
    const res = await GET(req(), ctx('p1'))
    const body = (await res.json()) as Post
    const person = body.blocks.find((b) => b.kind === 'person') as any
    expect(person.people[0].lastName).toBe('Thompson')
    // Members-only block is now visible.
    expect(body.blocks.find((b) => b.id === 'b-secret')).toBeDefined()
  })
})
