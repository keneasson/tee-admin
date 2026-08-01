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
  body: string
  containsPii: boolean
}

/** A person's field-classes: firstName always shown; lastName/bio/contact gated. */
export interface BlockPerson {
  id: string // pii:'none' — stable per-entry id (React keying; NOT shown/PII)
  firstName: string // pii:'name' — ALWAYS shown (first-name floor)
  lastName?: string // pii:'name' — dropped below reveal tier
  bio?: string // pii:'bio' — obituary / testimony / about — hidden below member
  contact?: string // pii:'contact' — phone / personal email — hidden below member
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

/** Timezone-aware date/time. Presence of a FUTURE `startsAt` drives the event facet. */
export interface TimeBlock extends BlockBase {
  kind: 'time'
  label?: string // e.g. 'Service', 'Baptism', a schedule item title
  startsAt?: string // ISO-8601
  endsAt?: string // ISO-8601
  timezone?: string // IANA (e.g. 'America/Toronto')
  display?: string // free-text time when no ISO value (e.g. '7:30pm')
}

/** PDF/image attachment. PII can be baked into pixels — unredactable — so under a
 * PII-bearing occasion this defaults to `visibility: 'members'` (design §5). */
export interface FlyerBlock extends BlockBase {
  kind: 'flyer'
  document: DocumentAttachment
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

  // Reach — coarse gate resolved vs viewer tier.
  visibility: Visibility
  sharingScope: SharingScope

  lifecycle: PostLifecycle

  blocks: Block[] // where all content (and all PII) lives

  createdAt: string
  updatedAt: string
  status: 'draft' | 'ready' | 'archived'
}
