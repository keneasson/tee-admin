import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Post } from '@my/app/types/post'

/**
 * Newsletter native-Post fetch (Consolidated CMS #131, Phase 4b-2 — gradual
 * cutover of the NEWSLETTER email).
 *
 * The safety-critical bits, mirroring get-public-posts.test.ts:
 *  - the section is HIDDEN while CONSOLIDATED_CMS is OFF (returns `[]`, repo
 *    untouched → newsletter byte-identical to today);
 *  - the flag is read with a NULL session (broadcast context);
 *  - only NATIVE posts are surfaced (legacy events/news are NOT pulled in →
 *    nothing double-renders);
 *  - MEMBER TIER: full names survive redaction (the newsletter-email channel);
 *  - drafts never leak;
 *  - event-shaped posts are ordered before news-shaped.
 * The data sources are stubbed, but `getPostsForViewer`, the lifecycle engine and
 * `redactPost` are left REAL so the pipeline is genuinely exercised.
 */

const h = vi.hoisted(() => ({
  checkFlag: vi.fn(),
  listPosts: vi.fn(),
  listAllPosts: vi.fn(),
  getPublishedEvents: vi.fn(),
  listNewsItems: vi.fn(),
}))

vi.mock('@my/app/features/feature-flags/use-feature-flag-wrapper', () => ({
  checkFeatureFlagFromDB: h.checkFlag,
}))
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: { listPosts: h.listPosts, listAllPosts: h.listAllPosts },
}))
vi.mock('@my/app/services/event-service', () => ({ getPublishedEvents: h.getPublishedEvents }))
vi.mock('@my/app/services/news-service', () => ({ listNewsItems: h.listNewsItems }))

import { getNewsletterNativePosts } from '../utils/email/get-newsletter-posts'

const TENANT = 'Toronto East'
// 2026-07-05: everything published 2026-07-01 is still inside its window.
const NOW = new Date('2026-07-05T00:00:00.000Z')

function basePost(overrides: Partial<Post>): Post {
  return {
    id: 'p',
    tenant: TENANT,
    authorId: 'a',
    title: 'Post',
    occasion: ['general'],
    visibility: 'members',
    sharingScope: 'own',
    lifecycle: { publishDate: '2026-07-01T00:00:00.000Z' },
    blocks: [],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    status: 'ready',
    ...overrides,
  }
}

// Event-shaped: a TimeBlock ~6 weeks out (upcoming at NOW) → ordered first.
const eventShaped = basePost({
  id: 'event-1',
  title: 'Wedding Shower',
  occasion: ['shower'],
  blocks: [
    { id: 't', kind: 'time', label: 'Shower', startsAt: '2026-08-15T18:00:00.000Z' },
    {
      id: 'per',
      kind: 'person',
      role: 'bride',
      people: [{ id: 'ppl-1', firstName: 'Sarah', lastName: 'Johnson' }],
    },
  ],
})

// News-shaped: no dated happening → ordered after event-shaped.
const newsShaped = basePost({
  id: 'news-1',
  title: 'Sunday School resumes',
  occasion: ['news'],
})

beforeEach(() => {
  vi.clearAllMocks()
  h.checkFlag.mockResolvedValue(true)
  h.listPosts.mockResolvedValue({ posts: [eventShaped, newsShaped] })
  h.listAllPosts.mockResolvedValue([])
  h.getPublishedEvents.mockResolvedValue([])
  h.listNewsItems.mockResolvedValue([])
})

describe('getNewsletterNativePosts — flag gate', () => {
  it('returns [] when CONSOLIDATED_CMS is OFF (repo untouched → byte-identical newsletter)', async () => {
    h.checkFlag.mockResolvedValue(false)
    const result = await getNewsletterNativePosts(TENANT, NOW)
    expect(result).toEqual([])
    expect(h.listPosts).not.toHaveBeenCalled()
    expect(h.listAllPosts).not.toHaveBeenCalled()
  })

  it('reads the flag with a NULL session (broadcast context — on only at "everyone")', async () => {
    await getNewsletterNativePosts(TENANT, NOW)
    expect(h.checkFlag).toHaveBeenCalledWith(expect.any(String), null)
  })
})

describe('getNewsletterNativePosts — native only', () => {
  it('never pulls in legacy events/news (no double-render of the legacy newsletter sections)', async () => {
    await getNewsletterNativePosts(TENANT, NOW)
    expect(h.getPublishedEvents).not.toHaveBeenCalled()
    expect(h.listNewsItems).not.toHaveBeenCalled()
  })

  it('scopes the native read to the tenant', async () => {
    await getNewsletterNativePosts(TENANT, NOW)
    expect(h.listPosts).toHaveBeenCalledWith(expect.objectContaining({ tenant: TENANT }))
  })
})

describe('getNewsletterNativePosts — member tier + ordering', () => {
  it('orders event-shaped posts before news-shaped', async () => {
    const posts = await getNewsletterNativePosts(TENANT, NOW)
    expect(posts.map((p) => p.id)).toEqual(['event-1', 'news-1'])
  })

  it('reveals FULL names (member-tier newsletter-email channel)', async () => {
    const posts = await getNewsletterNativePosts(TENANT, NOW)
    const event = posts.find((p) => p.id === 'event-1')!
    const personBlock = event.blocks.find((b) => b.kind === 'person') as any
    expect(personBlock.people[0].lastName).toBe('Johnson')
  })

  it('drops drafts — a broadcast never sends unpublished native posts', async () => {
    h.listPosts.mockResolvedValue({
      posts: [eventShaped, basePost({ id: 'draft-1', title: 'Draft', status: 'draft' })],
    })
    const posts = await getNewsletterNativePosts(TENANT, NOW)
    expect(posts.map((p) => p.id)).not.toContain('draft-1')
  })

  it('drops posts not active at `now` (lifecycle gate)', async () => {
    // At 2026-09-01 both the shower (08-15) and the news window (07-01 + 2wk) have
    // passed, and the shower's retrospective window (~08-29) has also ended.
    const posts = await getNewsletterNativePosts(TENANT, new Date('2026-09-01T00:00:00.000Z'))
    expect(posts).toEqual([])
  })
})
