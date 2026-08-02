/**
 * Unified Post lifecycle / display-rules engine (Consolidated CMS #131, Phase 4a).
 *
 * ONE lifetime rule for News AND Events (design §6). Today News and Events have
 * two DIFFERENT lifetime rules, and it's wrong: News expires on a flat publish
 * window (`isNewsActive` / `expiresAt` / `durationWeeks`) that IGNORES any future
 * event it announces — so a "Wedding Shower" news item expired 2 weeks BEFORE the
 * shower and missed the newsletter. Events, meanwhile, only date-anchor a
 * "Thursday-before" reminder for funerals. This engine collapses both into one
 * rule over the {@link Post} model:
 *
 *   - A Post with a FUTURE happening is **event-shaped**: it stays active through
 *     that happening (it does NOT expire early like news), and fires a bounded
 *     eve-of reminder on the Thursday immediately before it.
 *   - A Post with NO future happening (none, or all past) is **news-shaped**:
 *     active from publish for a retrospective window (subsumes `isNewsActive`).
 *
 * Sequence-aware: a Post can carry a SEQUENCE of happenings (multiple
 * {@link TimeBlock}s), e.g. a death that evolves into visitation → funeral →
 * graveside → celebration-of-life, "sometimes all separate events" weeks apart.
 * The Post is event-shaped while ANY happening is still upcoming; the eve-of
 * reminder fires before EACH one (the "next" advances as each passes); it becomes
 * news-shaped only after the LAST happening passes.
 *
 * ── The "future date" caveat (crux of "the shower stays up") ──
 * TODAY legacy News has NO explicit future-event-date field. `legacyToPost` maps a
 * news item's future date only if it carries a TimeBlock — which legacy news never
 * does. So a migrated news item is NEWS-shaped (and can still expire early) UNLESS
 * an author adds a TimeBlock in the editor, or Phase 4b's migration infers one.
 * The event-shaped "stays up until the date" behaviour lands the moment a future
 * TimeBlock exists on the Post — not before.
 *
 * Pure + I/O-free, platform-free, fully unit-testable. Reuses the legacy date
 * helpers (Thursday-before + timezone-aware day compare) from
 * `newsletter/date-helpers.ts` — no duplication.
 */

import type { Post, TimeBlock } from '../types/post'
import { getThursdayBefore, isSameDay, isUserDateOnOrBefore } from './newsletter/date-helpers'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Retrospective window (weeks) for a news-shaped Post when `expiresAt` is absent. */
export const DEFAULT_NEWS_WINDOW_WEEKS = 2

export interface PostDisplayState {
  /** Should the Post be shown / included right now? */
  active: boolean
  /** Is `now` the bounded eve-of (Thursday-before) reminder for the next happening? */
  isReminder: boolean
  /** Human-readable rationale (mirrors the legacy engine's debuggable reasons). */
  reason: string
}

export interface DisplayStateOptions {
  /**
   * Retrospective window in weeks for news-shaped posts when `lifecycle.expiresAt`
   * is absent. Defaults to {@link DEFAULT_NEWS_WINDOW_WEEKS}.
   */
  defaultNewsWindowWeeks?: number
}

/** A single time happening on a Post (a TimeBlock, or the lifecycle-level date). */
interface Happening {
  startsAt: string
  endsAt?: string
  label?: string
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d
}

function sameInstant(a: string, b: string): boolean {
  const da = parseDate(a)
  const db = parseDate(b)
  return !!da && !!db && da.getTime() === db.getTime()
}

/**
 * All time happenings on a Post: every {@link TimeBlock} with a `startsAt`, plus
 * the lifecycle-level `startsAt` when it is not already represented by a TimeBlock
 * (native posts may set `lifecycle.startsAt` without a TimeBlock; the legacy
 * adapter sets both to the same instant, which we de-dupe).
 */
function collectHappenings(post: Post): Happening[] {
  const out: Happening[] = []
  for (const block of post.blocks) {
    if (block.kind === 'time') {
      const tb = block as TimeBlock
      if (tb.startsAt) {
        out.push({ startsAt: tb.startsAt, endsAt: tb.endsAt, label: tb.label })
      }
    }
  }
  const ls = post.lifecycle.startsAt
  if (ls && !out.some((h) => sameInstant(h.startsAt, ls))) {
    out.push({ startsAt: ls, endsAt: post.lifecycle.endsAt, label: post.title })
  }
  return out
}

/** The date through which a happening keeps a post active (multi-day → its end). */
function happeningBoundary(h: Happening): Date {
  return parseDate(h.endsAt) ?? parseDate(h.startsAt)!
}

/**
 * The Post's effective START date — `lifecycle.startsAt` if set, else the EARLIEST
 * `TimeBlock.startsAt`. Undefined ⇒ the post has no date at all (news-shaped).
 *
 * NOTE: this is the earliest-OVERALL start (which may be in the past). For the
 * lifecycle decision use {@link resolvePostNextDate} (the earliest still-upcoming).
 */
export function resolvePostStartsAt(post: Post): string | undefined {
  if (post.lifecycle.startsAt) return post.lifecycle.startsAt
  let earliest: string | undefined
  for (const block of post.blocks) {
    if (block.kind === 'time') {
      const s = (block as TimeBlock).startsAt
      if (s && (!earliest || parseDate(s)! < parseDate(earliest)!)) earliest = s
    }
  }
  return earliest
}

/**
 * The NEXT upcoming happening relative to `now`: the earliest happening whose
 * boundary (its end, or start) is still today-or-later. Undefined ⇒ every
 * happening has passed (or there are none) ⇒ news-shaped. Sequence-aware: as each
 * happening passes, the next one is returned.
 */
export function resolvePostNextDate(post: Post, now: Date): Happening | undefined {
  const upcoming = collectHappenings(post).filter((h) =>
    isUserDateOnOrBefore(now, happeningBoundary(h))
  )
  if (upcoming.length === 0) return undefined
  return upcoming.reduce((next, h) =>
    parseDate(h.startsAt)! < parseDate(next.startsAt)! ? h : next
  )
}

/**
 * The LAST date on the Post — the latest happening boundary (end, or start).
 * Undefined ⇒ the post has no dated happenings. Used to anchor the retrospective
 * window so a post lingers briefly AFTER its final happening (e.g. a
 * celebration-of-life), rather than vanishing the instant the event ends.
 */
export function resolvePostLastDate(post: Post): string | undefined {
  let latest: Date | undefined
  let latestIso: string | undefined
  for (const h of collectHappenings(post)) {
    const b = h.endsAt ?? h.startsAt
    const d = parseDate(b)
    if (d && (!latest || d > latest)) {
      latest = d
      latestIso = b
    }
  }
  return latestIso
}

/**
 * THE unified lifecycle rule. Given a Post and `now`, decide whether it is active
 * and whether `now` is its bounded eve-of reminder.
 *
 * 1. Not yet published (`publishDate` in the future) ⇒ inactive.
 * 2. Has a future happening ({@link resolvePostNextDate}) ⇒ **event-shaped**:
 *    active through that happening; `isReminder` on the Thursday immediately
 *    before the NEXT happening. As each happening passes the next becomes current.
 * 3. No future happening (none, or all past) ⇒ **news-shaped**: active from
 *    publish for its retrospective window (`lifecycle.expiresAt`, else a default
 *    window anchored at the later of publish / last happening). Subsumes
 *    `isNewsActive`.
 */
export function getPostDisplayState(
  post: Post,
  now: Date,
  opts: DisplayStateOptions = {}
): PostDisplayState {
  // 1. Not yet published.
  const publishDate = parseDate(post.lifecycle.publishDate)
  if (publishDate && publishDate.getTime() > now.getTime()) {
    return {
      active: false,
      isReminder: false,
      reason: `Not yet published (publishDate ${publishDate.toDateString()})`,
    }
  }

  // 2. Event-shaped: any happening still upcoming.
  const next = resolvePostNextDate(post, now)
  if (next) {
    const nextStart = parseDate(next.startsAt)!
    const thursdayBefore = getThursdayBefore(nextStart)
    const isReminder = isSameDay(now, thursdayBefore)
    const which = next.label ?? post.title
    return {
      active: true,
      isReminder,
      reason: isReminder
        ? `Event-shaped: final reminder — Thursday before ${which} (${nextStart.toDateString()})`
        : `Event-shaped: next happening ${which} on ${nextStart.toDateString()} — active until then`,
    }
  }

  // 3. News-shaped: no upcoming happening → retrospective window.
  const hadHappening = collectHappenings(post).length > 0
  const lastDate = parseDate(resolvePostLastDate(post))
  const windowStart =
    // Anchor at the later of publish / last happening so a post that HAD events
    // lingers `defaultNewsWindowWeeks` after the final one; pure news anchors at
    // publish (subsuming isNewsActive exactly when expiresAt is set).
    [publishDate, lastDate, parseDate(post.createdAt)]
      .filter((d): d is Date => !!d)
      .reduce((a, b) => (a && a.getTime() >= b.getTime() ? a : b), undefined as Date | undefined) ??
    now

  const windowWeeks = opts.defaultNewsWindowWeeks ?? DEFAULT_NEWS_WINDOW_WEEKS
  const expiresAt =
    parseDate(post.lifecycle.expiresAt) ??
    new Date(windowStart.getTime() + windowWeeks * WEEK_MS)

  const active = now.getTime() < expiresAt.getTime()
  const tail = hadHappening ? ' (all happenings passed)' : ''
  return {
    active,
    isReminder: false,
    reason: active
      ? `News-shaped: within retrospective window until ${expiresAt.toDateString()}${tail}`
      : `News-shaped: retrospective window ended ${expiresAt.toDateString()}${tail}`,
  }
}

/** Convenience: is the Post active at `now` (defaults to the current time)? */
export function isPostActive(post: Post, now: Date = new Date()): boolean {
  return getPostDisplayState(post, now).active
}
