/**
 * Repair stored Posts whose string fields came back as `null`.
 *
 * WHY THIS IS NEEDED: the shared DynamoDB client sets `convertEmptyValues: true`
 * (`provider/dynamodb/config.ts`), legacy AWS SDK v2 behaviour that rewrites
 * every empty string `''` to a DynamoDB `NULL` on write. DynamoDB has allowed
 * empty strings on non-key attributes since 2020, so this silently corrupts data:
 * `makeTextBlock()` creates `{ body: '' }`, and it reads back as `{ body: null }`
 * — violating the declared `TextBlock.body: string`.
 *
 * TypeScript cannot catch that: the type says `string`, and the value breaking it
 * comes from the database. So a reader that trusts the type crashes — which is
 * exactly what happened to the doc canvas (`body.split(...)` → "Cannot read
 * properties of null", a white screen on every post with an untouched text
 * block).
 *
 * This normalizes at the ONE read boundary (`PostRepository.toPost`) so every
 * consumer — doc canvas, block form, email render, public view, redaction — sees
 * the types the code is written against, instead of each caller guarding
 * defensively (ADR-0003 §3: declared once, not per-caller).
 *
 * It restores the declared shape exactly:
 *   - a REQUIRED string that is null becomes `''` (what was actually stored),
 *   - any other null becomes `undefined` (absent), which is what an optional
 *     field means.
 *
 * Turning `convertEmptyValues` off is the real fix, but it is shared by every
 * repository and needs its own migration — see the follow-up on #214.
 *
 * Pure + I/O-free. Cross-platform.
 */

import type { Block, Post } from '../types/post'

/** Required (non-optional) string fields, by block kind. */
const REQUIRED_BLOCK_STRINGS: Partial<Record<Block['kind'], readonly string[]>> = {
  text: ['body'],
}

/** Drop `null`s from a flat record: absent is what an optional field means. */
function dropNulls<T extends object>(value: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v !== null) out[k] = v
  }
  return out as T
}

function normalizeBlock(block: Block): Block {
  const cleaned = dropNulls(block as unknown as Record<string, unknown>) as unknown as Block

  // Re-seat required strings that were stored as NULL.
  for (const field of REQUIRED_BLOCK_STRINGS[block.kind] ?? []) {
    const current = (cleaned as unknown as Record<string, unknown>)[field]
    if (typeof current !== 'string') {
      ;(cleaned as unknown as Record<string, unknown>)[field] = ''
    }
  }

  // `people[]` carries its own required string (`firstName`).
  if (cleaned.kind === 'person' && Array.isArray(cleaned.people)) {
    cleaned.people = cleaned.people.map((person) => {
      const p = dropNulls(
        person as unknown as Record<string, unknown>
      ) as unknown as typeof person
      if (typeof p.firstName !== 'string') p.firstName = ''
      return p
    })
  }

  return cleaned
}

/** Normalize a Post read out of storage back to its declared shape. */
export function normalizePost(post: Post): Post {
  const cleaned = dropNulls(post as unknown as Record<string, unknown>) as unknown as Post

  if (typeof cleaned.title !== 'string') cleaned.title = ''
  cleaned.occasion = Array.isArray(cleaned.occasion) ? cleaned.occasion : []
  cleaned.lifecycle = cleaned.lifecycle ? dropNulls(cleaned.lifecycle) : {}
  cleaned.blocks = Array.isArray(cleaned.blocks) ? cleaned.blocks.map(normalizeBlock) : []

  return cleaned
}
