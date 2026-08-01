/**
 * The single read boundary for the unified Post model (design §4).
 *
 * `redactPost(post, viewer, { channel })` walks a post's typed blocks and:
 *   1. REACH-gates the post, then each block, by {@link Visibility} vs the
 *      viewer's tier (channel-aware — the curated newsletter email is a member
 *      audience, design §8.2). A block the viewer can't reach is dropped.
 *   2. PII-scrubs each surviving block's fields by class (§4 table), reusing the
 *      viewer-pii primitives so name/location/bio shaping lives in ONE place.
 *
 * Sanitation happens HERE, before serialization — a redacted post literally
 * cannot carry a surname / street address / obituary (no ship-then-hide leak).
 * Obtaining full data requires an explicit reveal-tier Viewer or the
 * `newsletter-email` channel (design §4.1: the narrow, audited full-data door).
 *
 * Pure + I/O-free — unit-tests cleanly, runs in any context. Cross-platform:
 * no platform imports.
 */

import type {
  Block,
  LocationBlock,
  PersonBlock,
  Post,
  RegistrationBlock,
  Visibility,
} from '../types/post'
import {
  canRevealPii,
  revealBio,
  shapeLocation,
  shapePersonName,
  type Channel,
  type Viewer,
} from './viewer-pii'

interface RedactOptions {
  channel?: Channel
}

// Reach ranks — higher sees more. Mirrors the assurance/role ladder.
const VISIBILITY_RANK: Record<Visibility, number> = {
  public: 0,
  recognized: 1,
  members: 2,
  admins: 3,
}

/**
 * The reach tier a (viewer, channel) can see UP TO. Channel-aware: the curated
 * `newsletter-email` renders at member tier (§8.2). Otherwise derived from the
 * viewer's assurance + effective role (already capped for recognized viewers).
 */
function viewerReach(viewer: Viewer, channel: Channel): number {
  if (channel === 'newsletter-email') return VISIBILITY_RANK.members
  if (viewer.assurance === 'anonymous') return VISIBILITY_RANK.public
  if (viewer.assurance === 'authenticated') {
    if (viewer.role === 'owner' || viewer.role === 'admin') return VISIBILITY_RANK.admins
    if (viewer.role === 'member' || viewer.role === 'recorder' || viewer.role === 'rep') {
      return VISIBILITY_RANK.members
    }
    // Authenticated but below member (guest) — recognized floor.
    return VISIBILITY_RANK.recognized
  }
  // recognized (valid email token, never above member) — recognized floor.
  return VISIBILITY_RANK.recognized
}

/** Reach gate: may this (viewer, channel) see content at `visibility`? */
export function canSee(
  visibility: Visibility,
  viewer: Viewer,
  channel: Channel = 'public-web'
): boolean {
  return viewerReach(viewer, channel) >= VISIBILITY_RANK[visibility]
}

function redactPerson(block: PersonBlock, viewer: Viewer, channel: Channel): PersonBlock {
  return {
    ...block,
    people: block.people.map((p) => {
      // shapePersonName drops lastName below reveal tier — no View-Source leak.
      const named = shapePersonName(p, viewer, channel)
      const out: PersonBlock['people'][number] = {
        firstName: named.firstName,
      }
      if (named.lastName) out.lastName = named.lastName
      const bio = revealBio(p.bio, viewer, channel)
      if (bio) out.bio = bio
      // contact-class — dropped below reveal tier.
      if (p.contact && canRevealPii(viewer, channel)) out.contact = p.contact
      // pii:'none' — always carried.
      if (p.ecclesia) out.ecclesia = p.ecclesia
      if (p.title) out.title = p.title
      if (typeof p.age === 'number') out.age = p.age
      if (p.label) out.label = p.label
      return out
    }),
  }
}

/**
 * Shape a LocationBlock. Reuses `shapeLocation` for the venue+city floor and the
 * private-residence drop. Returns `null` when the whole block must disappear
 * (private residence, non-reveal viewer) so `redactPost` can filter it out.
 */
function redactLocation(
  block: LocationBlock,
  viewer: Viewer,
  channel: Channel
): LocationBlock | null {
  const shaped = shapeLocation(
    {
      venueName: block.venueName,
      city: block.city,
      province: block.province,
      address: block.address,
      postalCode: block.postalCode,
      lat: block.lat,
      lng: block.lng,
      privateResidence: block.privateResidence,
    },
    viewer,
    channel
  )
  if (!shaped) return null // private residence, non-reveal — drop whole block

  if (canRevealPii(viewer, channel)) return block // reveal tier keeps everything

  // Non-reveal: rebuild carrying ONLY the safe floor + non-PII fields. Precise
  // street/geo/directions/maps are omitted from the object entirely.
  const out: LocationBlock = {
    id: block.id,
    kind: 'location',
    mode: block.mode,
  }
  if (block.visibility) out.visibility = block.visibility
  if (block.ecclesiaRef) out.ecclesiaRef = block.ecclesiaRef
  if (block.label) out.label = block.label
  if (shaped.venueName) out.venueName = shaped.venueName
  if (shaped.city) out.city = shaped.city
  if (shaped.province) out.province = shaped.province
  if (block.country) out.country = block.country
  if (block.onlineMeeting) out.onlineMeeting = block.onlineMeeting
  return out
}

function redactRegistration(
  block: RegistrationBlock,
  viewer: Viewer,
  channel: Channel
): RegistrationBlock {
  if (canRevealPii(viewer, channel)) return block
  // contact-class — drop email/phone; keep the public registration url + logistics.
  const { contactEmail: _e, contactPhone: _p, ...rest } = block
  return rest
}

/**
 * Scrub a single block's PII fields for a (viewer, channel). Returns `null` when
 * the block must be removed (a private-residence location for a non-reveal
 * viewer). Reach gating is done by the caller. Blocks with no PII-class fields
 * (time, flyer, link, text) pass through unchanged — text/flyer are protected by
 * their `visibility` reach gate, not by field scrubbing.
 */
export function redactBlock(
  block: Block,
  viewer: Viewer,
  channel: Channel = 'public-web'
): Block | null {
  switch (block.kind) {
    case 'person':
      return redactPerson(block, viewer, channel)
    case 'location':
      return redactLocation(block, viewer, channel)
    case 'registration':
      return redactRegistration(block, viewer, channel)
    case 'text':
    case 'time':
    case 'flyer':
    case 'link':
      return block
  }
}

/**
 * Redact a whole post for a (viewer, channel). Returns `null` when the viewer
 * cannot reach the post at all. Otherwise: drops blocks the viewer can't reach,
 * then PII-scrubs the survivors.
 */
export function redactPost(
  post: Post,
  viewer: Viewer,
  opts: RedactOptions = {}
): Post | null {
  const channel: Channel = opts.channel ?? 'public-web'
  if (!canSee(post.visibility, viewer, channel)) return null

  const blocks: Block[] = []
  for (const block of post.blocks) {
    if (!canSee(block.visibility ?? post.visibility, viewer, channel)) continue
    const redacted = redactBlock(block, viewer, channel)
    if (redacted) blocks.push(redacted)
  }

  return { ...post, blocks }
}

/** Redact a list of posts, dropping any the viewer cannot reach. */
export function redactPosts(
  posts: Post[],
  viewer: Viewer,
  opts: RedactOptions = {}
): Post[] {
  const out: Post[] = []
  for (const p of posts) {
    const r = redactPost(p, viewer, opts)
    if (r) out.push(r)
  }
  return out
}
