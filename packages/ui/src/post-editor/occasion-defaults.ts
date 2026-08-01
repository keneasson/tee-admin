import type { Block, LocationBlock, OccasionTag, PersonBlock, Post, TextBlock, TimeBlock } from '@my/app/types/post'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import { genId } from './post-reducer'

/**
 * Occasion → default block set (Consolidated CMS Phase 2c; design doc "Phase
 * 2 — Toolbar authoring UI": *"`occasion` tags seed default block sets (a
 * baptism occasion pre-adds Candidate + Location + Time + a members-only
 * Testimony text block)"*).
 *
 * Pure, data-only map — no code path per occasion (occasion is DATA, design
 * §8.5). Setting an occasion tag pre-adds a small starting set of EMPTY
 * blocks so the author isn't staring at a blank canvas; every added block is
 * just a normal block afterwards — freely edited or deleted like any other.
 *
 * ADDITIVE / SAFE-BY-DEFAULT (see {@link applyOccasionDefaults}): a default is
 * only added for a "slot" the post doesn't already occupy — existing author
 * content is NEVER removed, replaced, or edited. This covers both "no blocks
 * yet" and "some blocks already, top up the missing defaults" with the same
 * rule, so there's no special-casing between create and edit.
 *
 * Cross-platform: pure types + logic, no platform imports. Deliberately does
 * NOT import the `blocks/*-block-editor.tsx` `make*Block()` factories — several
 * of those pull in `@tamagui/lucide-icons` (via `PlainSelect`/`PlainCheckbox`),
 * which the plain-Node Vitest environment can't parse (see
 * `post-editor-blocks-2b.test.ts`'s file header for the full story). Blocks are
 * constructed directly here from the typed shape instead, so this module —
 * and its tests — stay lightweight and hang-free.
 */

interface OccasionDefaultBlock {
  /**
   * The "slot" this default occupies, for the already-present check. Block
   * kind for most blocks; Person blocks use `kind:role` so e.g. a wedding's
   * bride and groom defaults are independently addable (two `person` blocks,
   * two different slots).
   */
  slot: string
  make: () => Block
}

function personDefault(role: PersonBlock['role']): OccasionDefaultBlock {
  return {
    slot: `person:${role}`,
    make: (): PersonBlock => ({ id: genId('blk'), kind: 'person', role, people: [] }),
  }
}

const LOCATION_DEFAULT: OccasionDefaultBlock = {
  slot: 'location',
  make: (): LocationBlock => ({ id: genId('blk'), kind: 'location', mode: 'plain' }),
}

const TIME_DEFAULT: OccasionDefaultBlock = {
  slot: 'time',
  make: (): TimeBlock => ({ id: genId('blk'), kind: 'time', timezone: DEFAULT_TIMEZONE }),
}

/** A members-only text block seeded for the baptism candidate's testimony. */
const TESTIMONY_TEXT_DEFAULT: OccasionDefaultBlock = {
  slot: 'text',
  make: (): TextBlock => ({
    id: genId('blk'),
    kind: 'text',
    body: '## Testimony\n\n',
    containsPii: true,
    visibility: 'members',
  }),
}

/** A single, plain text block — the news/default shape. */
const TEXT_DEFAULT: OccasionDefaultBlock = {
  slot: 'text',
  make: (): TextBlock => ({ id: genId('blk'), kind: 'text', body: '', containsPii: false }),
}

/**
 * occasion → default block set (design doc examples): baptism gets a
 * candidate + location + time + a members-only testimony text block; funeral
 * gets a deceased + location + time; wedding gets a bride + groom + location +
 * time; news gets a single text block. Occasions with no entry here fall back
 * to {@link FALLBACK_DEFAULTS} (also a single text block) via
 * {@link defaultBlockSetFor}.
 */
const OCCASION_DEFAULTS: Partial<Record<OccasionTag, OccasionDefaultBlock[]>> = {
  baptism: [personDefault('candidate'), LOCATION_DEFAULT, TIME_DEFAULT, TESTIMONY_TEXT_DEFAULT],
  funeral: [personDefault('deceased'), LOCATION_DEFAULT, TIME_DEFAULT],
  wedding: [personDefault('bride'), personDefault('groom'), LOCATION_DEFAULT, TIME_DEFAULT],
  news: [TEXT_DEFAULT],
}

/** Fallback for occasions with no specific mapping (e.g. 'general', 'announcement'). */
const FALLBACK_DEFAULTS: OccasionDefaultBlock[] = [TEXT_DEFAULT]

/**
 * The union of default blocks for a post's occasion tags, de-duplicated by
 * slot (a post can carry multiple free-combining occasion tags, design §8.5).
 * The generic fallback only applies when NONE of the post's tags has a
 * specific mapping — e.g. `['wedding','shower']` gets wedding's defaults, not
 * wedding's defaults PLUS a generic text block for 'shower'.
 */
function defaultBlockSetFor(occasion: OccasionTag[]): OccasionDefaultBlock[] {
  const bySlot = new Map<string, OccasionDefaultBlock>()
  for (const tag of occasion) {
    for (const def of OCCASION_DEFAULTS[tag] ?? []) {
      if (!bySlot.has(def.slot)) bySlot.set(def.slot, def)
    }
  }
  if (bySlot.size === 0) {
    for (const def of FALLBACK_DEFAULTS) bySlot.set(def.slot, def)
  }
  return Array.from(bySlot.values())
}

/** The slot an EXISTING block occupies, using the same discriminator as the defaults above. */
function slotOf(block: Block): string {
  return block.kind === 'person' ? `person:${block.role}` : block.kind
}

/**
 * Pre-add the occasion's default blocks — ADDITIVE ONLY. For each default
 * "slot" the post doesn't already have a block in, append a fresh instance;
 * slots the post already occupies (author content OR a previously-applied
 * default) are left completely untouched. Never removes, replaces, or edits
 * an existing block — call this as often as you like, it only ever adds.
 */
export function applyOccasionDefaults(post: Post): Post {
  const defaults = defaultBlockSetFor(post.occasion)
  const existingSlots = new Set(post.blocks.map(slotOf))
  const toAdd = defaults.filter((d) => !existingSlots.has(d.slot)).map((d) => d.make())
  if (toAdd.length === 0) return post
  return { ...post, blocks: [...post.blocks, ...toAdd] }
}
