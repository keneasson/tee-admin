import { describe, it, expect } from 'vitest'
import { eventToPostStatus, newsToPostStatus } from '@my/app/utils/legacy-status'
import { legacyToPost } from '@my/app/utils/legacy-to-post'
import { isPostLive, isPostScheduled } from '@my/app/utils/post-lifecycle'
import type { Event } from '@my/app/types/events'

/**
 * ONE exposure vocabulary across Post, Event and News — the premise of the
 * Consolidated CMS is that they are one thing, so they cannot keep three
 * answers to "is this out yet?".
 *
 * Event previously carried FOUR spellings at once (`'ready'` and `'published'`
 * as separate values, plus a deprecated `active` boolean, plus `publishDate`),
 * and `legacyToPost` sidestepped all of it by hardcoding `status: 'published'`.
 * That was safe only because its one caller pre-filters with
 * `getPublishedEvents()`; any other caller would have turned a draft event into
 * a published Post.
 */
const event = (over: Partial<Event> = {}): Partial<Event> => ({
  id: 'e1',
  type: 'general',
  title: 'Gathering',
  ...over,
})

describe('eventToPostStatus — the precedence isEventActive already used', () => {
  it('archived wins outright — retirement is not overridden by a date', () => {
    expect(
      eventToPostStatus(event({ status: 'archived', publishDate: '2020-01-01' } as Partial<Event>))
    ).toBe('archived')
  })

  it('a publishDate means published (scheduling is decided later, by isPostLive)', () => {
    expect(eventToPostStatus(event({ publishDate: '2030-01-01' } as Partial<Event>))).toBe(
      'published'
    )
  })

  it('falls back to the deprecated active boolean', () => {
    expect(eventToPostStatus(event({ active: true } as Partial<Event>))).toBe('published')
    expect(eventToPostStatus(event({ active: false } as Partial<Event>))).toBe('draft')
  })

  it("treats the legacy 'ready' as 'published'", () => {
    expect(eventToPostStatus(event({ status: 'ready' } as Partial<Event>))).toBe('published')
  })

  it('an unknown record is never assumed to be out', () => {
    expect(eventToPostStatus(event())).toBe('draft')
  })

  it('news has no draft concept — an item that exists is published', () => {
    expect(newsToPostStatus({})).toBe('published')
  })
})

describe('the adapter derives status instead of asserting it', () => {
  it('a draft event no longer becomes a published Post', () => {
    const post = legacyToPost(event({ active: false }) as Event)
    expect(post.status).toBe('draft')
    expect(isPostLive(post, new Date('2026-09-08'))).toBe(false)
  })

  it('a future-dated event is published but not yet live — scheduling survives', () => {
    const post = legacyToPost(event({ publishDate: '2030-01-01' }) as Event)
    expect(post.status).toBe('published')
    expect(isPostLive(post, new Date('2026-09-08'))).toBe(false)
    expect(isPostScheduled(post, new Date('2026-09-08'))).toBe(true)
  })

  it('an archived event stays archived through the adapter', () => {
    const post = legacyToPost(event({ status: 'archived' }) as Event)
    expect(post.status).toBe('archived')
    expect(isPostLive(post, new Date('2026-09-08'))).toBe(false)
  })
})
