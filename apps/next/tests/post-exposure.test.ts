import { describe, it, expect } from 'vitest'
import { isPostLive, isPostScheduled } from '@my/app/utils/post-lifecycle'
import { normalizePost } from '@my/app/utils/normalize-post'
import type { Post } from '@my/app/types/post'

/**
 * ONE meaning of "published". Before this, liveness had four spellings across
 * two models — Events resolved a fallback chain (`publishDate` → deprecated
 * `active` → legacy `status`), and Post had two of its own: `status === 'ready'`
 * (the only one enforced) and `lifecycle.publishDate` (honoured by
 * `computeLifecycle`, called by nothing — #227).
 */
const post = (over: Partial<Post> = {}): Post =>
  ({
    id: 'p1',
    tenant: 'Toronto East Ecclesia',
    authorId: 'a',
    title: 'T',
    occasion: ['general'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    blocks: [],
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as unknown as Post

const NOW = new Date('2026-09-07T12:00:00.000Z')

describe('isPostLive — the single liveness rule', () => {
  it('a ready post with no publish date is live', () => {
    expect(isPostLive(post(), NOW)).toBe(true)
  })

  it('a draft is never live', () => {
    expect(isPostLive(post({ status: 'draft' }), NOW)).toBe(false)
  })

  it('an archived post is never live', () => {
    expect(isPostLive(post({ status: 'archived' }), NOW)).toBe(false)
  })

  it('a ready post scheduled for the future is NOT live — the gap #227 closed', () => {
    const scheduled = post({ lifecycle: { publishDate: '2026-11-02' } } as Partial<Post>)
    expect(isPostLive(scheduled, NOW)).toBe(false)
    expect(isPostScheduled(scheduled, NOW)).toBe(true)
  })

  it('becomes live once the scheduled date passes', () => {
    const scheduled = post({ lifecycle: { publishDate: '2026-09-01' } } as Partial<Post>)
    expect(isPostLive(scheduled, NOW)).toBe(true)
    expect(isPostScheduled(scheduled, NOW)).toBe(false)
  })

  it('a DRAFT with a past publish date is still not live — status wins', () => {
    const p = post({ status: 'draft', lifecycle: { publishDate: '2026-01-01' } } as Partial<Post>)
    expect(isPostLive(p, NOW)).toBe(false)
  })

  it('a draft is never "scheduled" either — scheduling only applies to ready', () => {
    const p = post({ status: 'draft', lifecycle: { publishDate: '2026-11-02' } } as Partial<Post>)
    expect(isPostScheduled(p, NOW)).toBe(false)
  })
})

describe('legacy status spelling — no data migration required', () => {
  it("maps a stored 'ready' to 'published' at the read boundary", () => {
    const legacy = normalizePost(post({ status: 'ready' } as unknown as Partial<Post>))
    expect(legacy.status).toBe('published')
    expect(isPostLive(legacy, NOW)).toBe(true)
  })

  it('leaves the current spellings alone', () => {
    for (const status of ['draft', 'published', 'archived'] as const) {
      expect(normalizePost(post({ status })).status).toBe(status)
    }
  })

  it('an unrecognised status falls back to draft — never silently live', () => {
    const weird = normalizePost(post({ status: 'wat' } as unknown as Partial<Post>))
    expect(weird.status).toBe('draft')
    expect(isPostLive(weird, NOW)).toBe(false)
  })
})
