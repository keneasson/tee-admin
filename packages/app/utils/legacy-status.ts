/**
 * ONE exposure vocabulary across Post, Event and News.
 *
 * The Consolidated CMS premise is that News = Events = one Post, so they cannot
 * keep three different answers to "is this out yet?". They had exactly that:
 *
 *   - **Event** carried FOUR spellings at once —
 *     `EventStatus = 'draft' | 'ready' | 'published' | 'archived'` (two words for
 *     one state), plus a deprecated `active: boolean`, plus `publishDate`, and
 *     `isEventActive()` resolved the pile into a boolean.
 *   - **News** had no status at all — only an `expiresAt` window, which is a
 *     different axis (how long it stays up, not whether it is out).
 *   - **Post** used `'ready'` where Event used `'published'`.
 *
 * This resolves any legacy record to the single {@link PostStatus}. It mirrors
 * the precedence `isEventActive()` already used, but yields a STATE rather than
 * a boolean — so scheduling stays expressible (a future `publishDate` is
 * `published`-but-not-yet-live, which `isPostLive` decides) instead of collapsing
 * to false.
 *
 * Pure + I/O-free. Cross-platform.
 */

import type { Event } from '../types/events'
import type { NewsItem } from '../types/news'
import type { PostStatus } from '../types/post'

/** Normalize any spelling — including the legacy `'ready'` — to a PostStatus. */
export function normalizeStatusWord(word: unknown): PostStatus | undefined {
  if (word === 'archived') return 'archived'
  if (word === 'published' || word === 'ready') return 'published'
  if (word === 'draft') return 'draft'
  return undefined
}

/**
 * Derive a legacy Event's exposure state.
 *
 * Precedence matches `isEventActive()` so behaviour does not change:
 *   1. `archived` wins outright — retirement is not overridden by a date.
 *   2. `publishDate` is the source of truth: set ⇒ published (a FUTURE date is
 *      published-but-scheduled, and `isPostLive` withholds it); absent ⇒ fall
 *      through rather than assume.
 *   3. the deprecated `active` boolean.
 *   4. the oldest `status` field.
 *   5. otherwise `draft` — an unknown record is never assumed to be out.
 */
export function eventToPostStatus(event: Partial<Event>): PostStatus {
  if (normalizeStatusWord(event.status) === 'archived') return 'archived'

  if (event.publishDate) {
    const t = new Date(event.publishDate).getTime()
    if (!Number.isNaN(t)) return 'published'
  }

  if (typeof event.active === 'boolean') return event.active ? 'published' : 'draft'

  return normalizeStatusWord(event.status) ?? 'draft'
}

/**
 * Derive a legacy NewsItem's exposure state.
 *
 * News has no draft concept — a NewsItem exists only once it has been written
 * and published, and its lifetime is governed by `expiresAt` (a WINDOW, handled
 * by the lifecycle engine, not by status). So an existing item is `published`.
 * Kept as a named function rather than a literal so the assumption is visible
 * and has somewhere to change if News ever gains drafts.
 */
export function newsToPostStatus(_item: Partial<NewsItem>): PostStatus {
  return 'published'
}
