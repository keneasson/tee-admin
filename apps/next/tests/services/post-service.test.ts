import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the data sources; keep legacyToPost + redactPost REAL so the test
// exercises the actual merge + redaction pipeline.
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: {
    listPosts: vi.fn(),
    listAllPosts: vi.fn(),
    listPostsBySeries: vi.fn(),
  },
}))
vi.mock('@my/app/services/event-service', () => ({
  getPublishedEvents: vi.fn(),
}))
vi.mock('@my/app/services/news-service', () => ({
  listNewsItems: vi.fn(),
}))

import {
  getPostsForViewer,
  getPostsForViewerWithState,
  getSeriesForPost,
} from '@my/app/services/post-service'
import { postRepository } from '@my/app/provider/dynamodb/repositories/post-repository'
import { getPublishedEvents } from '@my/app/services/event-service'
import { listNewsItems } from '@my/app/services/news-service'
import { ANONYMOUS_VIEWER, type Viewer } from '@my/app/utils/viewer-pii'
import type { Post, PersonBlock } from '@my/app/types/post'

const member: Viewer = {
  assurance: 'authenticated',
  role: 'member',
  tenant: 'Toronto East',
  email: 'm@x.z',
}

// Deterministic reference time for the Phase 4a lifecycle filter. All fixtures
// below are published 2026-07-01 (native + baptism have no future date → news-
// shaped, active for their retrospective window; the medical news expires
// 2026-12-01), so at this instant every fixture is active and the merge/redaction
// assertions are unaffected by the lifecycle gate.
const NOW = new Date('2026-07-05T00:00:00.000Z')

// ── Fixtures ────────────────────────────────────────────────────────────────

const nativePost: Post = {
  id: 'native-1',
  tenant: 'Toronto East',
  authorId: 'author-1',
  title: 'Native Wedding',
  occasion: ['wedding'],
  visibility: 'public',
  sharingScope: 'own',
  lifecycle: {},
  blocks: [
    {
      id: 'pb',
      kind: 'person',
      role: 'bride',
      people: [{ id: 'ppl-mary', firstName: 'Mary', lastName: 'Jones' }],
    },
  ],
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  status: 'ready',
}

// Legacy baptism Event → PersonBlock(candidate) with name + bio (aboutCandidate).
const legacyEvent = {
  id: 'ev-1',
  type: 'baptism',
  title: 'Baptism',
  ownerEcclesia: 'Toronto East',
  createdBy: 'x',
  candidate: { firstName: 'Josh', lastName: 'Archibald' },
  aboutCandidate: 'A heartfelt testimony',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
}

// Legacy 'medical' NewsItem → members-only TextBlock (PII-bearing occasion).
const legacyNews = {
  id: 'nw-1',
  ecclesiaId: 'Toronto East',
  authorId: 'x',
  title: 'Health update',
  category: 'medical',
  body: 'Private medical details',
  publishedAt: new Date('2026-07-01T00:00:00.000Z'),
  expiresAt: new Date('2026-12-01T00:00:00.000Z'),
  sharingScope: 'own',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-01T00:00:00.000Z'),
}

function byId(posts: Post[], id: string): Post {
  const p = posts.find((x) => x.id === id)
  if (!p) throw new Error(`post ${id} not in result`)
  return p
}
function person(post: Post): PersonBlock['people'][number] {
  const block = post.blocks.find((b): b is PersonBlock => b.kind === 'person')
  if (!block) throw new Error(`no person block on ${post.id}`)
  return block.people[0]
}

describe('getPostsForViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(postRepository.listAllPosts as any).mockResolvedValue([nativePost])
    ;(postRepository.listPosts as any).mockResolvedValue({ posts: [nativePost] })
    ;(getPublishedEvents as any).mockResolvedValue([legacyEvent])
    ;(listNewsItems as any).mockResolvedValue([legacyNews])
  })

  it('merges native + legacy (events & news) into one set', async () => {
    const posts = await getPostsForViewer(member, { now: NOW })
    expect(posts.map((p) => p.id).sort()).toEqual(['ev-1', 'native-1', 'nw-1'])
    // Legacy came through the adapter (news defaults to includeExpired:false).
    expect(getPublishedEvents).toHaveBeenCalledTimes(1)
    expect(listNewsItems).toHaveBeenCalledWith({ includeExpired: false })
    expect(postRepository.listAllPosts).toHaveBeenCalledTimes(1)
  })

  it('redacts PII for an anonymous viewer (first-name floor, bio + members-only text dropped)', async () => {
    const posts = await getPostsForViewer(ANONYMOUS_VIEWER, { now: NOW })

    // native person: first name only, no surname. id (pii:'none') is carried through.
    expect(person(byId(posts, 'native-1'))).toEqual({ id: 'ppl-mary', firstName: 'Mary' })

    // legacy baptism candidate: first name only, obituary/testimony bio dropped.
    const candidate = person(byId(posts, 'ev-1'))
    expect(candidate.firstName).toBe('Josh')
    expect(candidate).not.toHaveProperty('lastName')
    expect(candidate).not.toHaveProperty('bio')

    // legacy medical news: the members-only body TextBlock is not reachable by anon.
    const news = byId(posts, 'nw-1')
    expect(news.blocks.some((b) => b.kind === 'text')).toBe(false)
  })

  it('reveals full PII for an authenticated member', async () => {
    const posts = await getPostsForViewer(member, { now: NOW })

    expect(person(byId(posts, 'native-1')).lastName).toBe('Jones')

    const candidate = person(byId(posts, 'ev-1'))
    expect(candidate.lastName).toBe('Archibald')
    expect(candidate.bio).toBe('A heartfelt testimony')

    const news = byId(posts, 'nw-1')
    const text = news.blocks.find((b) => b.kind === 'text')
    expect(text && text.kind === 'text' ? text.body : null).toBe('Private medical details')
  })

  it('filters out posts that are not active at the injected `now` (lifecycle gate)', async () => {
    // A native post with a FUTURE happening (TimeBlock ~6 weeks out) stays active
    // even far past its createdAt — the whole point of the unified rule.
    const futureShower: Post = {
      ...nativePost,
      id: 'shower-1',
      title: 'Wedding Shower',
      occasion: ['shower'],
      lifecycle: { publishDate: '2026-07-01T00:00:00.000Z' },
      blocks: [
        { id: 't', kind: 'time', label: 'Shower', startsAt: '2026-08-15T18:00:00.000Z' },
      ],
    }
    ;(postRepository.listAllPosts as any).mockResolvedValue([nativePost, futureShower])

    // At 2026-08-01 the news-shaped fixtures (native + baptism, published 07-01,
    // 2-week window) have EXPIRED, but the shower (event 08-15) is still active.
    const posts = await getPostsForViewer(member, { now: new Date('2026-08-01T00:00:00.000Z') })
    const ids = posts.map((p) => p.id).sort()
    expect(ids).toContain('shower-1') // future event → stays up
    expect(ids).toContain('nw-1') // medical news expires 2026-12-01 → still active
    expect(ids).not.toContain('native-1') // news-shaped, window ended → dropped
    expect(ids).not.toContain('ev-1') // baptism, no future date → dropped
  })

  it('surfaces the eve-of reminder flag via getPostsForViewerWithState', async () => {
    const funeralArc: Post = {
      ...nativePost,
      id: 'arc-1',
      title: 'Funeral',
      occasion: ['funeral'],
      lifecycle: { publishDate: '2026-07-01T00:00:00.000Z' },
      blocks: [{ id: 't', kind: 'time', label: 'Service', startsAt: '2026-08-14T12:00:00.000Z' }],
    }
    ;(postRepository.listAllPosts as any).mockResolvedValue([funeralArc])
    ;(getPublishedEvents as any).mockResolvedValue([])
    ;(listNewsItems as any).mockResolvedValue([])

    // 2026-08-14 is a Friday → Thursday-before is 2026-08-13. (Noon-UTC times keep
    // the calendar day stable under the engine's local-time weekday check.)
    const onThursday = await getPostsForViewerWithState(member, {
      now: new Date('2026-08-13T12:00:00.000Z'),
    })
    expect(onThursday.find((w) => w.post.id === 'arc-1')?.isReminder).toBe(true)

    const weekEarlier = await getPostsForViewerWithState(member, {
      now: new Date('2026-08-06T12:00:00.000Z'),
    })
    // Still active (event upcoming) but NOT the reminder day.
    const w = weekEarlier.find((x) => x.post.id === 'arc-1')
    expect(w?.post).toBeDefined()
    expect(w?.isReminder).toBe(false)
  })

  it('scopes to a tenant via listPosts and filters legacy by tenant', async () => {
    ;(getPublishedEvents as any).mockResolvedValue([
      legacyEvent,
      { ...legacyEvent, id: 'ev-other', ownerEcclesia: 'Hamilton' },
    ])

    const posts = await getPostsForViewer(member, { tenant: 'Toronto East', now: NOW })

    expect(postRepository.listPosts).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: 'Toronto East' })
    )
    expect(postRepository.listAllPosts).not.toHaveBeenCalled()
    // The Hamilton event is filtered out; Toronto East legacy + native remain.
    expect(posts.map((p) => p.id).sort()).toEqual(['ev-1', 'native-1', 'nw-1'])
  })
})

describe('getSeriesForPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns [] without querying when the post has no seriesId', async () => {
    const result = await getSeriesForPost(nativePost)
    expect(result).toEqual([])
    expect(postRepository.listPostsBySeries).not.toHaveBeenCalled()
  })

  it('returns the OTHER series members, excluding the post itself', async () => {
    const self: Post = { ...nativePost, id: 'gathering-2026', seriesId: 'tfg' }
    const sibling2025: Post = { ...nativePost, id: 'gathering-2025', seriesId: 'tfg' }
    ;(postRepository.listPostsBySeries as any).mockResolvedValue([self, sibling2025])

    const result = await getSeriesForPost(self)

    expect(postRepository.listPostsBySeries).toHaveBeenCalledWith('tfg')
    expect(result.map((p) => p.id)).toEqual(['gathering-2025'])
  })
})
