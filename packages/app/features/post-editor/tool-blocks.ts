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
 * WIRED end-to-end: Location (2R-1), Speaker/Person + Date/Time + Link (2R-2a),
 * Image/Flyer + Registration (2R-2b) — all six tools.
 */

import type {
  Block,
  FlyerBlock,
  LinkBlock,
  LocationBlock,
  PersonBlock,
  RegistrationBlock,
  TimeBlock,
} from '@my/app/types/post'
import { genId } from '@my/ui/src/post-editor/post-reducer'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import { plainNameToPerson } from './resolvers/person-resolve'
import { looksLikeUrl, normalizeUrl } from './resolvers/link-resolve'

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
  { kind: 'flyer', label: 'Image / Flyer', enabled: true },
  { kind: 'registration', label: 'Registration', enabled: true },
]

/**
 * A fresh, empty flyer block — an image-less {@link FlyerBlock} whose document is
 * blank strings + `uploadedAt: new Date(0)` (mirrors `emptyFlyer()` in
 * templates.ts). The doc renders it as an "Add an image" placeholder; the
 * FlyerUploader fills the document on a successful upload.
 */
function emptyFlyerBlock(): FlyerBlock {
  return {
    id: genId(),
    kind: 'flyer',
    document: {
      id: genId(),
      documentType: 'upload',
      fileName: '',
      originalName: '',
      fileUrl: '',
      fileSize: 0,
      mimeType: '',
      uploadedAt: new Date(0),
      uploadedBy: '',
    },
  }
}

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
    case 'flyer':
      return emptyFlyerBlock()
    case 'registration':
      return { id: genId(), kind: 'registration' } satisfies RegistrationBlock
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
 *  - registration → a URL-looking selection seeds `registrationUrl`; otherwise `notes`
 *  - flyer    → the seed is IGNORED (an image can't come from selected text); a
 *               blank flyer block is returned to open the uploader
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
    case 'registration':
      return looksLikeUrl(text)
        ? ({ id: genId(), kind: 'registration', registrationUrl: normalizeUrl(text) } satisfies RegistrationBlock)
        : ({ id: genId(), kind: 'registration', notes: text } satisfies RegistrationBlock)
    case 'flyer':
      // An image can't come from selected text — ignore the seed, open blank.
      return emptyFlyerBlock()
  }
}
