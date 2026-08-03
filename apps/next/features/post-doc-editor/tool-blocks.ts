/**
 * Armed-tool catalogue + fresh-block factories for the document-canvas editor
 * (Consolidated CMS Phase 2R-1). The floating toolbar's tools map 1:1 onto the
 * unified Post block kinds; arming a tool then clicking the canvas inserts a
 * fresh block of that kind at the caret.
 *
 * PURE (types + the pure `genId` only) so it is shared by BOTH the live editor
 * (toolbar + insert plugin) and the serialization unit tests without dragging in
 * Tamagui / lucide. Rendering of a block is the decorator node's job, not this
 * module's.
 *
 * KEYSTONE SCOPE: only the Location tool is wired end-to-end. The rest are listed
 * (so the Photoshop-style armed-tool mechanic is fully visible) but disabled —
 * they are wired in 2R-2.
 */

import type { Block, LocationBlock } from '@my/app/types/post'
import { genId } from '@my/ui/src/post-editor/post-reducer'

export type ToolKind = 'location' | 'person' | 'time' | 'flyer' | 'registration' | 'link'

export interface ToolDef {
  kind: ToolKind
  label: string
  /** Wired end-to-end this slice? Disabled tools are "coming soon" (2R-2). */
  enabled: boolean
}

/** Toolbar order. Location is the ONE wired reference kind for the keystone. */
export const TOOLS: ToolDef[] = [
  { kind: 'location', label: 'Location', enabled: true },
  { kind: 'person', label: 'Speaker / Person', enabled: false },
  { kind: 'time', label: 'Date / Time', enabled: false },
  { kind: 'flyer', label: 'Image / Flyer', enabled: false },
  { kind: 'registration', label: 'Registration', enabled: false },
  { kind: 'link', label: 'Link', enabled: false },
]

/**
 * Fresh, empty block for an armed tool. Mirrors the packages/ui `make*` factories
 * (e.g. `makeLocationBlock`) but stays dependency-light so it is safe to import
 * from tests. Only Location is implemented this slice.
 */
export function makeToolBlock(kind: ToolKind): Block {
  switch (kind) {
    case 'location':
      return { id: genId(), kind: 'location', mode: 'plain' } satisfies LocationBlock
    default:
      throw new Error(`Tool "${kind}" is not wired yet (Consolidated CMS 2R-2)`)
  }
}

/**
 * SEEDED block for the convert-selection path (2R-1b): when a tool is applied to
 * a non-empty TEXT SELECTION, the selected string seeds a fresh block instead of
 * dropping a blank one. For Location the seed lands on `venueName` (keeping the
 * block a valid plain LocationBlock so the doc round-trip stays green) and the
 * resolver reads it as its initial query, immediately attempting a directory
 * resolution. Only Location is wired this slice; unwired kinds throw like
 * {@link makeToolBlock}.
 */
export function makeSeededToolBlock(kind: ToolKind, seed: string): Block {
  switch (kind) {
    case 'location':
      return { id: genId(), kind: 'location', mode: 'plain', venueName: seed.trim() } satisfies LocationBlock
    default:
      throw new Error(`Tool "${kind}" is not wired yet (Consolidated CMS 2R-2)`)
  }
}
