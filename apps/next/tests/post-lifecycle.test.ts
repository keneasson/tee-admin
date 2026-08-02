import { describe, it, expect } from 'vitest'
import type { Block, Post } from '@my/app/types/post'
import {
  DEFAULT_NEWS_WINDOW_WEEKS,
  getPostDisplayState,
  isPostActive,
  resolvePostLastDate,
  resolvePostNextDate,
  resolvePostStartsAt,
} from '@my/app/utils/post-lifecycle'

/**
 * Unit tests for the unified Post lifecycle / display-rules engine (Phase 4a).
 *
 * ALL dates are constructed at NOON UTC so the engine's timezone-aware day
 * comparison (`isUserDateOnOrBefore`, UTC accessors) and its local-time
 * weekday check (`getThursdayBefore`/`isSameDay`) both resolve to the intended
 * calendar day regardless of the machine running the test. `now` is always
 * injected — no `Date.now()` in any assertion.
 */

/** ISO-8601 at noon UTC on the given calendar day (month is 1-based). */
function iso(y: number, m: number, d: number, h = 12): string {
  return new Date(Date.UTC(y, m - 1, d, h)).toISOString()
}
/** A Date at noon UTC — the injected `now`. */
function at(y: number, m: number, d: number, h = 12): Date {
  return new Date(Date.UTC(y, m - 1, d, h))
}

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p',
    tenant: 'Toronto East',
    authorId: 'a',
    title: 'Test Post',
    occasion: ['general'],
    visibility: 'public',
    sharingScope: 'own',
    lifecycle: {},
    blocks: [],
    createdAt: iso(2026, 7, 1),
    updatedAt: iso(2026, 7, 1),
    status: 'ready',
    ...overrides,
  }
}

function timeBlock(id: string, startsAt: string, label?: string, endsAt?: string): Block {
  return { id, kind: 'time', startsAt, ...(endsAt ? { endsAt } : {}), ...(label ? { label } : {}) }
}

// ── resolvePostStartsAt ───────────────────────────────────────────────────────
describe('resolvePostStartsAt', () => {
  it('prefers lifecycle.startsAt when set', () => {
    const post = makePost({
      lifecycle: { startsAt: iso(2026, 9, 1) },
      blocks: [timeBlock('t', iso(2026, 8, 1))],
    })
    expect(resolvePostStartsAt(post)).toBe(iso(2026, 9, 1))
  })

  it('falls back to the EARLIEST TimeBlock start when lifecycle.startsAt absent', () => {
    const post = makePost({
      blocks: [timeBlock('t2', iso(2026, 9, 19)), timeBlock('t1', iso(2026, 8, 14))],
    })
    expect(resolvePostStartsAt(post)).toBe(iso(2026, 8, 14))
  })

  it('is undefined when the post has no date at all (news-shaped)', () => {
    expect(resolvePostStartsAt(makePost())).toBeUndefined()
  })
})

// ── resolvePostNextDate / resolvePostLastDate ─────────────────────────────────
describe('resolvePostNextDate / resolvePostLastDate (sequence-aware)', () => {
  const arc = makePost({
    blocks: [
      timeBlock('funeral', iso(2026, 8, 14), 'Funeral'),
      timeBlock('celebration', iso(2026, 9, 19), 'Celebration'),
    ],
  })

  it('resolvePostNextDate returns the earliest STILL-UPCOMING happening', () => {
    // Before both → funeral is next.
    expect(resolvePostNextDate(arc, at(2026, 8, 1))?.label).toBe('Funeral')
    // After the funeral, before the celebration → celebration is next (not the
    // earliest-overall, which is in the past).
    expect(resolvePostNextDate(arc, at(2026, 8, 20))?.label).toBe('Celebration')
    // After the last happening → undefined.
    expect(resolvePostNextDate(arc, at(2026, 10, 1))).toBeUndefined()
  })

  it('resolvePostLastDate returns the latest happening boundary', () => {
    expect(resolvePostLastDate(arc)).toBe(iso(2026, 9, 19))
  })

  it('resolvePostLastDate uses endsAt for a multi-day happening', () => {
    const md = makePost({ blocks: [timeBlock('t', iso(2026, 8, 15), 'Weekend', iso(2026, 8, 17))] })
    expect(resolvePostLastDate(md)).toBe(iso(2026, 8, 17))
  })
})

// ── THE shower scenario ───────────────────────────────────────────────────────
describe('getPostDisplayState — the Wedding Shower (event-shaped stays up)', () => {
  // Published 2026-07-01; the shower is 2026-08-15 (a Saturday), ~6.5 weeks out.
  const shower = makePost({
    id: 'shower',
    title: 'Wedding Shower',
    occasion: ['shower'],
    lifecycle: { publishDate: iso(2026, 7, 1) },
    blocks: [timeBlock('t', iso(2026, 8, 15), 'Shower')],
  })

  it('is active early (soon after publish)', () => {
    const s = getPostDisplayState(shower, at(2026, 7, 5))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(false)
    expect(s.reason).toMatch(/Event-shaped/)
  })

  it('STAYS active mid-gap — unlike a news item, which would already be expired', () => {
    // The shower is still active 3 weeks after publish because of its future date.
    expect(isPostActive(shower, at(2026, 7, 20))).toBe(true)

    // Same post WITHOUT the future TimeBlock is news-shaped and has expired by now
    // (publish + default 2-week window). This is the exact bug 4a fixes.
    const asNews = makePost({
      ...shower,
      blocks: [],
    })
    expect(isPostActive(asNews, at(2026, 7, 20))).toBe(false)
  })

  it('flags the eve-of reminder on the Thursday immediately before the shower', () => {
    // 2026-08-15 is a Saturday → Thursday-before is 2026-08-13.
    const s = getPostDisplayState(shower, at(2026, 8, 13))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(true)
    expect(s.reason).toMatch(/final reminder/i)
    expect(s.reason).toContain('Shower')
  })

  it('is still active on the event day, no longer a reminder', () => {
    const s = getPostDisplayState(shower, at(2026, 8, 15))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(false)
  })

  it('is inactive well after the event (retrospective window elapsed)', () => {
    // Retrospective anchors at the last happening (08-15) + 2 weeks = 08-29.
    expect(isPostActive(shower, at(2026, 9, 10))).toBe(false)
  })
})

// ── news-shaped post ──────────────────────────────────────────────────────────
describe('getPostDisplayState — news-shaped (retrospective window)', () => {
  it('honours an explicit expiresAt (subsumes isNewsActive)', () => {
    const news = makePost({
      lifecycle: { publishDate: iso(2026, 7, 1), expiresAt: iso(2026, 7, 15) },
    })
    expect(isPostActive(news, at(2026, 7, 5))).toBe(true)
    expect(isPostActive(news, at(2026, 7, 14))).toBe(true)
    expect(isPostActive(news, at(2026, 7, 20))).toBe(false)
  })

  it('falls back to a default window from publish when expiresAt is absent', () => {
    const news = makePost({ lifecycle: { publishDate: iso(2026, 7, 1) } })
    // publish + DEFAULT_NEWS_WINDOW_WEEKS (2) = 2026-07-15.
    expect(DEFAULT_NEWS_WINDOW_WEEKS).toBe(2)
    expect(isPostActive(news, at(2026, 7, 10))).toBe(true)
    expect(isPostActive(news, at(2026, 7, 20))).toBe(false)
    const s = getPostDisplayState(news, at(2026, 7, 20))
    expect(s.reason).toMatch(/News-shaped/)
  })

  it('respects a custom defaultNewsWindowWeeks', () => {
    const news = makePost({ lifecycle: { publishDate: iso(2026, 7, 1) } })
    const s = getPostDisplayState(news, at(2026, 7, 20), { defaultNewsWindowWeeks: 4 })
    // publish + 4 weeks = 2026-07-29 → still active on 07-20.
    expect(s.active).toBe(true)
  })
})

// ── not yet published ─────────────────────────────────────────────────────────
describe('getPostDisplayState — not yet published', () => {
  it('is inactive while publishDate is in the future, even with a future event', () => {
    const post = makePost({
      lifecycle: { publishDate: iso(2026, 8, 1) },
      blocks: [timeBlock('t', iso(2026, 9, 1), 'Event')],
    })
    const s = getPostDisplayState(post, at(2026, 7, 5))
    expect(s.active).toBe(false)
    expect(s.isReminder).toBe(false)
    expect(s.reason).toMatch(/Not yet published/)
  })
})

// ── exact Thursday-before boundary ────────────────────────────────────────────
describe('getPostDisplayState — exact Thursday-before boundary', () => {
  // Event 2026-08-15 (Saturday) → Thursday-before is 2026-08-13.
  const post = makePost({
    lifecycle: { publishDate: iso(2026, 7, 1) },
    blocks: [timeBlock('t', iso(2026, 8, 15), 'Service')],
  })

  it('Wednesday before: active, NOT a reminder', () => {
    const s = getPostDisplayState(post, at(2026, 8, 12))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(false)
  })
  it('Thursday before: reminder fires', () => {
    expect(getPostDisplayState(post, at(2026, 8, 13)).isReminder).toBe(true)
  })
  it('Friday before: active, reminder no longer fires', () => {
    const s = getPostDisplayState(post, at(2026, 8, 14))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(false)
  })
})

// ── the death arc (sequence of happenings) ────────────────────────────────────
describe('getPostDisplayState — death arc (funeral → celebration of life)', () => {
  // Death announced 2026-07-01. Funeral 2026-08-14 (Fri). Celebration 2026-09-19
  // (Sat) — five weeks later, a separate event.
  const arc = makePost({
    id: 'death-arc',
    title: 'Passing of Brother X',
    occasion: ['funeral'],
    lifecycle: { publishDate: iso(2026, 7, 1) },
    blocks: [
      timeBlock('funeral', iso(2026, 8, 14), 'Funeral Service'),
      timeBlock('celebration', iso(2026, 9, 19), 'Celebration of Life'),
    ],
  })

  it('reminder before the FUNERAL (Thu 2026-08-13), naming that happening', () => {
    const s = getPostDisplayState(arc, at(2026, 8, 13))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(true)
    expect(s.reason).toContain('Funeral Service')
  })

  it('stays active in the gap between the funeral and the celebration', () => {
    const s = getPostDisplayState(arc, at(2026, 8, 20))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(false)
  })

  it('is active INTO the second window, before the celebration', () => {
    expect(isPostActive(arc, at(2026, 9, 10))).toBe(true)
  })

  it('reminder before the CELEBRATION (Thu 2026-09-17), naming that happening', () => {
    const s = getPostDisplayState(arc, at(2026, 9, 17))
    expect(s.active).toBe(true)
    expect(s.isReminder).toBe(true)
    expect(s.reason).toContain('Celebration of Life')
  })

  it('is retrospective/inactive only AFTER the last happening passes', () => {
    // Still active on the celebration day.
    expect(isPostActive(arc, at(2026, 9, 19))).toBe(true)
    // After the last happening + retrospective window (09-19 + 2wk = 10-03) → inactive.
    const s = getPostDisplayState(arc, at(2026, 10, 10))
    expect(s.active).toBe(false)
    expect(s.reason).toMatch(/News-shaped/)
  })
})
