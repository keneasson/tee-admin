/**
 * Shared, cross-platform post-editor logic (Consolidated CMS epic #131).
 *
 * NOTE FOR packages/ui: import from this package by MODULE PATH, never through
 * this barrel — it re-exports the screens, which import '@my/ui', so the barrel
 * would create a packages/ui → packages/app → packages/ui cycle.
 *
 * Everything here is platform-agnostic: it knows about Posts and Blocks, never
 * about Lexical, the DOM, or Next.js. The web app's Lexical canvas and a future
 * Expo canvas both sit ON TOP of this — the canvas is a rendering choice, the
 * rules are not.
 */
export {
  PII_BEARING_OCCASIONS,
  occasionIsPiiBearing,
  gatePiiProse,
  ungatePiiProse,
} from './pii-occasion-defaults'

// The authoring screen + its state machine. The route file is only a mount point.
export {
  PostEditorScreen,
  type PostEditorScreenProps,
  type PostDocEditorSlotProps,
} from './post-editor-screen'
export {
  usePostEditorState,
  AUTOSAVE_DEBOUNCE_MS,
  type PostEditorState,
  type SaveState,
} from './use-post-editor-state'

// Pure doc ⇄ blocks bijection (no Lexical, no DOM) — unit-tested in isolation.
export {
  docToBlocks,
  blocksToDocState,
  insertBlockNodeAt,
  POST_BLOCK_TYPE,
  type SerializedDocState,
  type SerializedTopNode,
} from './doc-serialization'

// Armed-tool catalogue + block factories.
export {
  TOOLS,
  makeToolBlock,
  makeSeededToolBlock,
  type ToolKind,
  type ToolDef,
} from './tool-blocks'

// Occasion starter templates.
export * from './templates'

// Pure block-mapping logic behind each widget (unit-tested).
export * from './resolvers/location-resolve'
export * from './resolvers/person-resolve'
export * from './resolvers/link-resolve'
export * from './resolvers/time-resolve'
export * from './resolvers/flyer-resolve'
export * from './resolvers/registration-resolve'

// The post list screen (ADR-0003: the route is a mount point).
export { PostListScreen, type PostListScreenProps } from './post-list-screen'
