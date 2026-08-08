/**
 * Armed-tool catalogue + fresh-block factories for the document-canvas editor
 * (Consolidated CMS Phase 2R-1 / 2R-2). The floating toolbar's tools map 1:1 onto
 * the unified Post block kinds; arming a tool then clicking the canvas inserts a
 * fresh block of that kind at the caret, which opens straight into its editor in
 * the floating tool.
 *
 * PURE (types + pure `genId`/mapping helpers only) so it is shared by BOTH the
 * live editor (toolbar + insert plugin) and the serialization unit tests without
 * dragging in Tamagui / lucide. Rendering of a block is the decorator node's job.
 *
 * WIRED end-to-end: Location (2R-1), Speaker/Person + Date/Time + Link (2R-2a).
 * Registration + Image/Flyer are listed but disabled — a later slice.
 */

import type { Block, LinkBlock, LocationBlock, PersonBlock, TimeBlock } from '@my/app/types/post'
import { genId } from '@my/ui/src/post-editor/post-reducer'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import { plainNameToPerson } from './widgets/person-resolve'
import { looksLikeUrl, normalizeUrl } from './widgets/link-resolve'

export type ToolKind = 'location' | 'person' | 'time' | 'flyer' | 'registration' | 'link'

export interface ToolDef {
  kind: ToolKind
  label: string
  /** Wired end-to-end? Disabled tools are "coming soon" (a later slice). */
  enabled: boolean
}

/** Toolbar order. */
export const TOOLS: ToolDef[] = [
  { kind: 'location', label: 'Location', enabled: true },
  { kind: 'person', label: 'Speaker / Person', enabled: true },
  { kind: 'time', label: 'Date / Time', enabled: true },
  { kind: 'link', label: 'Link', enabled: true },
  { kind: 'flyer', label: 'Image / Flyer', enabled: false },
  { kind: 'registration', label: 'Registration', enabled: false },
]

/**
 * Fresh, empty block for an armed tool. Mirrors the packages/ui `make*` factories
 * but stays dependency-light so it is safe to import from tests. Empty-but-typed
 * so the document renders it as a labelled placeholder until filled from the tool.
 */
export function makeToolBlock(kind: ToolKind): Block {
  switch (kind) {
    case 'location':
      return { id: genId(), kind: 'location', mode: 'plain' } satisfies LocationBlock
    case 'person':
      return { id: genId(), kind: 'person', role: 'speaker', people: [] } satisfies PersonBlock
    case 'time':
      return { id: genId(), kind: 'time', timezone: DEFAULT_TIMEZONE } satisfies TimeBlock
    case 'link':
      return { id: genId(), kind: 'link', url: '' } satisfies LinkBlock
    default:
      throw new Error(`Tool "${kind}" is not wired yet (Consolidated CMS)`)
  }
}

/**
 * SEEDED block for the convert-selection path: when a tool is applied to a
 * non-empty TEXT SELECTION, the selected string seeds a fresh block instead of a
 * blank one, and the editor opens to confirm/refine it:
 *  - location → seeds `venueName` (resolver's initial directory query)
 *  - person   → seeds a single plain person from the selected name
 *  - time     → seeds the free-text `display` (e.g. "7:30pm every Wednesday")
 *  - link     → a URL-looking selection seeds `url`; otherwise it seeds `label`
 */
export function makeSeededToolBlock(kind: ToolKind, seed: string): Block {
  const text = seed.trim()
  switch (kind) {
    case 'location':
      return { id: genId(), kind: 'location', mode: 'plain', venueName: text } satisfies LocationBlock
    case 'person':
      return {
        id: genId(),
        kind: 'person',
        role: 'speaker',
        people: [plainNameToPerson(text)],
      } satisfies PersonBlock
    case 'time':
      return { id: genId(), kind: 'time', timezone: DEFAULT_TIMEZONE, display: text } satisfies TimeBlock
    case 'link':
      return looksLikeUrl(text)
        ? ({ id: genId(), kind: 'link', url: normalizeUrl(text) } satisfies LinkBlock)
        : ({ id: genId(), kind: 'link', url: '', label: text } satisfies LinkBlock)
    default:
      throw new Error(`Tool "${kind}" is not wired yet (Consolidated CMS)`)
  }
}
