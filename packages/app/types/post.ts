/**
 * Unified Post model — PII-aware by construction.
 *
 * One entity for News AND Events. "Event-shaped" vs "news-shaped" is DERIVED
 * from `lifecycle`, not a type. Every block field that can hold PII carries a
 * declared {@link PiiClass}, so redaction is a single server-side traversal
 * (`redactPost`) instead of an audit of every string-interpolation site.
 *
 * Phase 0 of the Consolidated CMS epic (#131). See
 * docs/UNIFIED_POST_MODEL_DESIGN.md §2–§3 for the design this file realizes.
 *
 * Cross-platform: pure types, no platform imports — safe to import from web,
 * native, and email render paths.
 */

import type { DocumentAttachment, EventSharingScope, OnlineMeetingInfo } from './events'
import type { RichNode } from '../features/post-editor/rich-text'

// Re-export so the post model is a single import surface for consumers. The
// canonical PiiClass definition lives in viewer-pii.ts (the redaction primitive);
// re-exporting avoids a second, divergable copy.
export type { PiiClass } from '../utils/viewer-pii'

/**
 * Post reach ladder (design §8.4): public < recognized < members < admins.
 * Maps onto the assurance tiers + access roles. Gates whether a viewer can see
 * the post (or block) AT ALL — distinct from per-field PII scrubbing.
 */
export type Visibility = 'public' | 'recognized' | 'members' | 'admins'

/**
 * Geo reach of a post (own ecclesia / region / global). Reuses the existing
 * event sharing scope so there is ONE sharing resolver for posts.
 */
export type SharingScope = EventSharingScope

/**
 * Occasion is DATA, not a code path (design §8.5). One generic post; occasion
 * tags free-combine (e.g. `['wedding','shower']`). Legacy `EventType` values and
 * news categories map onto these during adaptation — no new code per occasion.
 */
/**
 * Exposure states. `'ready'` is the LEGACY spelling of `'published'`, accepted
 * on read so records written before the rename still load; it is normalized
 * away at the read boundary and never written.
 */
export type PostStatus = 'draft' | 'published' | 'archived'
export type LegacyPostStatus = PostStatus | 'ready'

export type OccasionTag =
  | 'baptism'
  | 'wedding'
  | 'shower'
  | 'funeral'
  | 'engagement'
  | 'study-weekend'
  | 'general'
  | 'recurring'
  | 'election-cycle'
  | 'news'
  | 'medical'
  | 'announcement'

export type BlockKind =
  | 'text'
  | 'person'
  | 'location'
  | 'time'
  | 'flyer'
  | 'registration'
  | 'link'

/**
 * Kinds that read naturally as a phrase inside prose. A flyer or a registration
 * panel is structurally standalone; a time, a person, a place or a link is a
 * value the author is likely to mention mid-sentence.
 *
 * NOTE this is a hint for the toolbar, NOT a layout property. Where a block
 * renders is DERIVED from where its marker sits in the prose (see
 * `inline-markers.ts`): a marker alone on its line stacks; a marker among words
 * flows inline. Layout is never a field an author sets — the stack just happens
 * to be stacked.
 */
export const PHRASE_KINDS = ['time', 'person', 'location', 'link'] as const
export type PhraseKind = (typeof PHRASE_KINDS)[number]

export function isPhraseKind(kind: BlockKind): kind is PhraseKind {
  return (PHRASE_KINDS as readonly string[]).includes(kind)
}

export interface BlockBase {
  id: string
  kind: BlockKind
  /**
   * Optional per-block override of {@link Post.visibility} (e.g. a flyer or an
   * obituary text block set to `members`). When absent the block inherits the
   * post's reach.
   */
  visibility?: Visibility
}

/**
 * Rich text / markdown. Copy-paste-from-email lands here. Free prose can hide
 * PII the redactor can't locate, so under a PII-bearing occasion this block
 * defaults to `visibility: 'members'` (design §5, §8.3) — anon simply never sees
 * it. `containsPii` drives a save-time author warning + future auto-detection.
 */
export interface TextBlock extends BlockBase {
  kind: 'text'
  /**
   * The plain-markdown PROJECTION of {@link TextBlock.rich} — always derived
   * from it when `rich` is present, never hand-edited.
   *
   * It is not deprecated. It is the graceful-degradation path (plain-text mail
   * parts, summaries, search) and the reason every renderer that predates
   * `rich` keeps working unchanged. Lossy by design: a mark markdown cannot
   * spell (underline, highlight, alignment) is absent here but preserved on
   * `rich`. See ADR-0004.
   */
  body: string
  /**
   * Lossless rich text. Source of truth when present.
   *
   * Storage captures every mark the editor can produce, whether or not any
   * renderer displays it yet; renderers upgrade one at a time and ignore marks
   * they do not know. Portable JSON — no Lexical or DOM types — so an Expo
   * canvas can read and write it (ADR-0003 §3, ADR-0004).
   */
  rich?: RichNode[]
  containsPii: boolean
}

/** A person's field-classes: firstName always shown; lastName/bio/contact gated. */
export interface BlockPerson {
  id: string // pii:'none' — stable per-entry id (React keying; NOT shown/PII)
  firstName: string // pii:'name' — ALWAYS shown (first-name floor)
  lastName?: string // pii:'name' — dropped below reveal tier
  bio?: string // pii:'bio' — obituary / testimony / about — hidden below member
  contact?: string // pii:'contact' — phone / personal email — hidden below member
  /**
   * pii:'none' — LINKAGE to the Contact List record this person is, when they
   * were picked from the directory (`/api/people` → `/people/{personId}`).
   *
   * The display fields stay a SNAPSHOT so the post still renders if the record
   * later changes and so redaction operates on the copied values; this is the
   * pointer alongside it, not a replacement for it. Absent for a visiting
   * speaker or anyone typed free-hand.
   */
  personId?: string
  ecclesia?: string // pii:'none'
  title?: string // pii:'none' — honorific (Brother/Sister/…)
  age?: number // pii:'none'
  /** pii:'none' — sub-role label (e.g. 'proposer', 'best man'). */
  label?: string
}

export interface PersonBlock extends BlockBase {
  kind: 'person'
  role: 'speaker' | 'candidate' | 'deceased' | 'bride' | 'groom' | 'sponsor' | 'contact' | 'other'
  people: BlockPerson[]
}

/**
 * Location — geo-aware address | plain text address | inherit-from-ecclesia.
 * `venueName`/`city`/`province`/`country` are the anon-safe floor (pii:'none');
 * `address`/`postalCode`/`lat`/`lng`/`directions`/`mapsUrl` are
 * `location-precise` and coarsened/hidden for anon. A `privateResidence` block
 * is dropped ENTIRELY for anon (design §8.1).
 */
export interface LocationBlock extends BlockBase {
  kind: 'location'
  mode: 'geo' | 'plain' | 'ecclesia'
  ecclesiaRef?: string // when mode==='ecclesia'
  label?: string // e.g. 'Service', 'Visitation', 'Ceremony', 'Reception'
  venueName?: string // pii:'none'
  city?: string // pii:'none' (coarse — safe floor)
  province?: string // pii:'none'
  country?: string // pii:'none'
  address?: string // pii:'location-precise'
  postalCode?: string // pii:'location-precise'
  lat?: number // pii:'location-precise'
  lng?: number // pii:'location-precise'
  directions?: string // pii:'location-precise'
  parkingInfo?: string // pii:'location-precise'
  mapsUrl?: string // pii:'location-precise'
  /** Author toggle: a private residence is hidden whole for anon (design §8.1). */
  privateResidence?: boolean
  onlineMeeting?: OnlineMeetingInfo // pii:'none' — virtual meeting link/details
}

/**
 * Author-controlled reminder offset anchored to a {@link TimeBlock}'s `startsAt`
 * or a {@link RegistrationBlock}'s `deadline`. Extensible (data, not a code path
 * per-type — mirrors {@link OccasionTag}). Both offsets always resolve to a
 * THURSDAY, matching the weekly newsletter cadence (post-lifecycle.ts):
 *  - `'eve-of'` — the Thursday immediately before the anchor date (the Phase 4a
 *    "final reminder" rule; if the anchor itself IS a Thursday, the PRIOR
 *    Thursday, 7 days back).
 *  - `'week-before'` — the Thursday exactly 7 calendar days before the
 *    `'eve-of'` Thursday (so ~9–13 days before the anchor, always a Thursday).
 */
export type ReminderOffset = 'eve-of' | 'week-before'

/** Timezone-aware date/time. Presence of a FUTURE `startsAt` drives the event facet. */
export interface TimeBlock extends BlockBase {
  kind: 'time'
  label?: string // e.g. 'Service', 'Baptism', a schedule item title
  startsAt?: string // ISO-8601
  endsAt?: string // ISO-8601
  timezone?: string // IANA (e.g. 'America/Toronto')
  display?: string // free-text time when no ISO value (e.g. '7:30pm')
  /**
   * pii:'none' — which reminder(s) to fire before `startsAt`. Unset (or empty)
   * ⇒ defaults to `['eve-of']`, preserving the Phase 4a behaviour exactly.
   */
  remind?: ReminderOffset[]
}

/** PDF/image attachment. PII can be baked into pixels — unredactable — so under a
 * PII-bearing occasion this defaults to `visibility: 'members'` (design §5). */
export interface FlyerBlock extends BlockBase {
  kind: 'flyer'
  document: DocumentAttachment
  /**
   * pii:'none' — presentation-only display controls set from the doc-editor's
   * in-canvas image handles (Google-Docs style). Both the editor's live preview
   * and the published {@link PostView} honour them, so the document stays the
   * final version. Additive & optional: absent ⇒ full width, no rotation.
   */
  displayWidth?: number // percent of the content column, 10–100 (default 100)
  rotation?: number // degrees clockwise, one of 0 | 90 | 180 | 270 (default 0)
}

export interface RegistrationBlock extends BlockBase {
  kind: 'registration'
  required?: boolean
  deadline?: string // ISO-8601
  registrationUrl?: string // pii:'none'
  contactEmail?: string // pii:'contact'
  contactPhone?: string // pii:'contact'
  hasFee?: boolean
  fee?: number
  paymentInstructions?: string
  notes?: string
  /**
   * pii:'none' — which reminder(s) to fire before `deadline`. Unset (or empty)
   * ⇒ no deadline reminder (this is new, opt-in behaviour; Phase 4a had none).
   */
  remindDeadline?: ReminderOffset[]
}

export interface LinkBlock extends BlockBase {
  kind: 'link'
  url: string
  label?: string
}

export type Block =
  | TextBlock
  | PersonBlock
  | LocationBlock
  | TimeBlock
  | FlyerBlock
  | RegistrationBlock
  | LinkBlock

export interface PostLifecycle {
  publishDate?: string // when it becomes visible (source of truth)
  startsAt?: string // a FUTURE start ⇒ event-shaped; absent/past ⇒ news-shaped
  endsAt?: string
  expiresAt?: string // news retrospective window
}

export interface Post {
  id: string
  tenant: string // owning ecclesia/org (today's ownerEcclesia / ecclesiaId)
  authorId: string

  title: string
  occasion: OccasionTag[] // DATA, not a code path
  summary?: string // short, PII-safe headline/teaser (public floor)

  /**
   * pii:'none' — shared id linking related Posts into ONE story/series (design
   * "Connect/series"): a death's separate events (funeral, celebration-of-life
   * weeks later), or a recurring annual gathering's yearly instances. Posts
   * with the same `seriesId` cross-reference and can be browsed as a series.
   * Unset for a post with no known relations. Never PII — just an internal
   * grouping id, so the redactor carries it through unchanged.
   */
  seriesId?: string

  // Reach — coarse gate resolved vs viewer tier.
  visibility: Visibility
  sharingScope: SharingScope

  lifecycle: PostLifecycle

  blocks: Block[] // where all content (and all PII) lives

  createdAt: string
  updatedAt: string
  /**
   * EXPOSURE — the single answer to "is this ready for readers?".
   *
   *  - `draft`     — a placeholder. Never appears on the web feed or in the
   *                  newsletter. Still SENDABLE as a one-off announcement email
   *                  (atomic and independently testable), which carries a DRAFT
   *                  warning.
   *  - `published` — live, unless `lifecycle.publishDate` is still in the
   *                  future, in which case it is scheduled.
   *  - `archived`  — END of the lifecycle: keep the record, drop it from the
   *                  lists. Not deleted, not live, not listed. Already honoured
   *                  by the repository (`archivePost`, and list reads filter it
   *                  out); deliberately NOT surfaced in the editor yet — it is a
   *                  retirement concern, not an authoring one.
   *
   * ONE word for exposure: **publish**. `'ready'` was the old spelling of
   * `'published'` and is accepted on read for records written before the rename
   * (`normalizePost` maps it); nothing writes it any more. Do not add a second
   * liveness flag — read it through `isPostLive()`.
   */
  status: PostStatus
}
