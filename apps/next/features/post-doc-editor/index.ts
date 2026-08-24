/**
 * Document-canvas editor (Consolidated CMS Phase 2R-1 KEYSTONE) — the
 * Google-Docs / Notion redo of the block-form editor. WEB-ONLY (Lexical, a DOM
 * rich-text engine): lives in apps/next, never imported from packages/ui.
 *
 * "Structured underneath, freeform on top": you write prose and drop structured
 * blocks inline as form-widgets; the underlying `Post.blocks[]` data model,
 * lifecycle, redaction and rendering are all untouched (a container swap).
 */
export { PostDocEditor, type PostDocEditorProps } from './post-doc-editor'
export { PostDocEditorShowcase } from './post-doc-editor-showcase'

// The metadata chrome around the doc-canvas editor — same controlled contract as
// the block-form PostEditor, so the authoring page can swap either editor in.
export {
  PostDocEditorChrome,
  type PostDocEditorChromeProps,
} from './post-doc-editor-chrome'

// Occasion-aware PII defaulting for canvas prose (pure; unit-testable).
export {
  PII_BEARING_OCCASIONS,
  occasionIsPiiBearing,
  gatePiiProse,
  ungatePiiProse,
} from './pii-occasion-defaults'

// Pure serialization bijection — unit-tested in isolation (no Lexical/Tamagui).
export {
  docToBlocks,
  blocksToDocState,
  insertBlockNodeAt,
  POST_BLOCK_TYPE,
  type SerializedDocState,
  type SerializedTopNode,
} from './doc-serialization'

// Armed-tool catalogue + factories (blank insert + seeded convert-selection).
export { TOOLS, makeToolBlock, makeSeededToolBlock, type ToolKind, type ToolDef } from './tool-blocks'

// Progressive Location resolver + its pure block-mapping logic (unit-tested).
export { LocationResolver, type LocationResolverProps } from './widgets/location-resolver'
export {
  makeLocationBlock,
  makeSeededLocationBlock,
  ecclesiaToLocationBlock,
  plainLocationBlock,
  externalPlaceToLocationBlock,
  isLocationResolved,
  pickUniqueMatch,
  canEditEcclesiaClient,
  type EcclesiaSuggestion,
  type ExternalPlaceAddress,
} from './widgets/location-resolve'
