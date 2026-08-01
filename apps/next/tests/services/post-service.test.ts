import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the data sources; keep legacyToPost + redactPost REAL so the test
// exercises the actual merge + redaction pipeline.
vi.mock('@my/app/provider/dynamodb/repositories/post-repository', () => ({
  postRepository: {
    listPosts: vi.fn(),
    listAllPosts: vi.fn(),
  },
}))
vi.mock('@my/app/services/event-service', () => ({
  getPublishedEvents: vi.fn(),
}))
vi.mock('@my/app/services/news-service', () => ({
  listNewsItems: vi.fn(),
}))

import { getPostsForViewer } from '@my/app/services/post-service'
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
    const posts = await getPostsForViewer(member)
    expect(posts.map((p) => p.id).sort()).toEqual(['ev-1', 'native-1', 'nw-1'])
    // Legacy came through the adapter (news defaults to includeExpired:false).
    expect(getPublishedEvents).toHaveBeenCalledTimes(1)
    expect(listNewsItems).toHaveBeenCalledWith({ includeExpired: false })
    expect(postRepository.listAllPosts).toHaveBeenCalledTimes(1)
  })

  it('redacts PII for an anonymous viewer (first-name floor, bio + members-only text dropped)', async () => {
    const posts = await getPostsForViewer(ANONYMOUS_VIEWER)

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
    const posts = await getPostsForViewer(member)

    expect(person(byId(posts, 'native-1')).lastName).toBe('Jones')

    const candidate = person(byId(posts, 'ev-1'))
    expect(candidate.lastName).toBe('Archibald')
    expect(candidate.bio).toBe('A heartfelt testimony')

    const news = byId(posts, 'nw-1')
    const text = news.blocks.find((b) => b.kind === 'text')
    expect(text && text.kind === 'text' ? text.body : null).toBe('Private medical details')
  })

  it('scopes to a tenant via listPosts and filters legacy by tenant', async () => {
    ;(getPublishedEvents as any).mockResolvedValue([
      legacyEvent,
      { ...legacyEvent, id: 'ev-other', ownerEcclesia: 'Hamilton' },
    ])

    const posts = await getPostsForViewer(member, { tenant: 'Toronto East' })

    expect(postRepository.listPosts).toHaveBeenCalledWith(
      expect.objectContaining({ tenant: 'Toronto East' })
    )
    expect(postRepository.listAllPosts).not.toHaveBeenCalled()
    // The Hamilton event is filtered out; Toronto East legacy + native remain.
    expect(posts.map((p) => p.id).sort()).toEqual(['ev-1', 'native-1', 'nw-1'])
  })
})
