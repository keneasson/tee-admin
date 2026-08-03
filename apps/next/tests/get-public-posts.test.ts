import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Post } from '@my/app/types/post'

/**
 * Public-page unified-Post read (Consolidated CMS #131, Phase 4b-1).
 *
 * The safety-critical bits: the block is HIDDEN while the CONSOLIDATED_CMS flag
 * is OFF (returns nothing extra → live pages byte-identical); only NATIVE posts
 * are surfaced (legacy events/news are NOT pulled in here, so nothing double-
 * renders); drafts never leak; and active native posts are split by lifecycle
 * facet (event-shaped → events page, news-shaped → news page) at an injected
 * `now`. The data sources are stubbed, but `getPostsForViewer`, the lifecycle
 * engine and `redactPost` are left REAL so the pipeline is genuinely exercised.
 */

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  checkFlag: vi.fn(),
  resolveViewer: vi.fn(),
  listAllPosts: vi.fn(),
  getPublishedEvents: vi.fn(),
  listNewsItems: vi.fn(),
}))

vi.mock('../utils/auth', () => ({ auth: h.auth }))
vi.mock('../utils/resolve-viewer', () => ({ resolveViewer: h.resolveViewer }))
vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { listAllPosts: h.listAllPosts, listPosts: vi.fn() },
}))
vi.mock('@my/app/services/event-service', () => ({ getPublishedEvents: h.getPublishedEvents }))
vi.mock('@my/app/services/news-service', () => ({ listNewsItems: h.listNewsItems }))

import { getPublicPosts } from '../utils/get-public-posts'
import type { Viewer } from '@my/app/utils/viewer-pii'

const member: Viewer = {
  assurance: 'authenticated',
  role: 'member',
  tenant: 'Toronto East',
  email: 'm@x.z',
}

// 2026-07-05: everything published 2026-07-01 is still inside its window.
const NOW = new Date('2026-07-05T00:00:00.000Z')

function basePost(overrides: Partial<Post>): Post {
  return {
    id: 'p',
    tenant: 'Toronto East',
    authorId: 'a',
    title: 'Post',
    occasion: ['general'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: { publishDate: '2026-07-01T00:00:00.000Z' },
    blocks: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    status: 'ready',
    ...overrides,
  }
}

// Event-shaped: a TimeBlock ~6 weeks out (upcoming at NOW) → belongs on events.
const eventShaped = basePost({
  id: 'event-1',
  title: 'Wedding Shower',
  occasion: ['shower'],
  blocks: [{ id: 't', kind: 'time', label: 'Shower', startsAt: '2026-08-15T18:00:00.000Z' }],
})

// News-shaped: no dated happening → belongs on news (active in its window at NOW).
const newsShaped = basePost({
  id: 'news-1',
  title: 'Sunday School resumes',
  occasion: ['news'],
})

beforeEach(() => {
  vi.clearAllMocks()
  h.auth.mockResolvedValue(null)
  h.checkFlag.mockResolvedValue(true)
  h.resolveViewer.mockResolvedValue(member)
  h.listAllPosts.mockResolvedValue([eventShaped, newsShaped])
  h.getPublishedEvents.mockResolvedValue([])
  h.listNewsItems.mockResolvedValue([])
})

describe('getPublicPosts — flag gate', () => {
  it('returns nothing extra when CONSOLIDATED_CMS is OFF (repo untouched)', async () => {
    h.checkFlag.mockResolvedValue(false)
    const result = await getPublicPosts(NOW)
    expect(result).toEqual({ events: [], news: [] })
    expect(h.listAllPosts).not.toHaveBeenCalled()
    expect(h.resolveViewer).not.toHaveBeenCalled()
  })
})

describe('getPublicPosts — native only', () => {
  it('never pulls in legacy events/news (no double-render of the legacy path)', async () => {
    await getPublicPosts(NOW)
    expect(h.getPublishedEvents).not.toHaveBeenCalled()
    expect(h.listNewsItems).not.toHaveBeenCalled()
  })
})

describe('getPublicPosts — facet split', () => {
  it('splits active native posts into event-shaped vs news-shaped at `now`', async () => {
    const { events, news } = await getPublicPosts(NOW)
    expect(events.map((p) => p.id)).toEqual(['event-1'])
    expect(news.map((p) => p.id)).toEqual(['news-1'])
  })

  it('drops drafts — a public surface never shows unpublished native posts', async () => {
    h.listAllPosts.mockResolvedValue([
      eventShaped,
      basePost({ id: 'draft-1', title: 'Draft', status: 'draft' }),
    ])
    const { events, news } = await getPublicPosts(NOW)
    const allIds = [...events, ...news].map((p) => p.id)
    expect(allIds).not.toContain('draft-1')
  })

  it('drops posts that are not active at `now` (lifecycle gate)', async () => {
    // At 2026-09-01 the news-shaped fixture (published 07-01, 2-week window) has
    // expired; the shower (event 08-15) has also passed → both gone.
    const { events, news } = await getPublicPosts(new Date('2026-09-01T00:00:00.000Z'))
    expect(events).toEqual([])
    // The shower is now news-shaped (event passed) but its retrospective window
    // (2 weeks after 08-15 ≈ 08-29) has also ended → dropped.
    expect(news).toEqual([])
  })
})
