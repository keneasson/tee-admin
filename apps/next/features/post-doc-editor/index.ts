/**
 * Document-canvas editor (Consolidated CMS Phase 2R-1 KEYSTONE) — the
 * Google-Docs / Notion redo of the block-form editor.
 *
 * WHAT IS LEFT HERE is only the Lexical BRIDGE: the composer, its plugins, the
 * decorator node, the floating toolbar and the drag-canvas — i.e. the parts that
 * genuinely need a DOM rich-text engine. Everything portable (the PII gate, the
 * doc ⇄ blocks bijection, the resolvers, the widget UIs, the chrome and the
 * page's autosave state machine) has moved into `@my/app` / `@my/ui`, so an Expo
 * canvas can reuse it. Keep that boundary: if a new file here does not import
 * Lexical or touch the DOM, it belongs in a package instead.
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

// Occasion-aware PII defaulting now lives in `@my/app/features/post-editor` (it
// is a rule about posts, not about Lexical). Re-exported for existing callers.
export {
  PII_BEARING_OCCASIONS,
  occasionIsPiiBearing,
  gatePiiProse,
  ungatePiiProse,
} from '@my/app/features/post-editor'

// Pure serialization bijection — unit-tested in isolation (no Lexical/Tamagui).
export {
  docToBlocks,
  blocksToDocState,
  insertBlockNodeAt,
  POST_BLOCK_TYPE,
  type SerializedDocState,
  type SerializedTopNode,
} from '@my/app/features/post-editor/doc-serialization'

// Armed-tool catalogue + factories (blank insert + seeded convert-selection).
export { TOOLS, makeToolBlock, makeSeededToolBlock, type ToolKind, type ToolDef } from '@my/app/features/post-editor/tool-blocks'

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
} from '@my/app/features/post-editor/resolvers/location-resolve'
