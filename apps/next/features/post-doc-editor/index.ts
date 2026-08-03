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

// Pure serialization bijection — unit-tested in isolation (no Lexical/Tamagui).
export {
  docToBlocks,
  blocksToDocState,
  insertBlockNodeAt,
  POST_BLOCK_TYPE,
  type SerializedDocState,
  type SerializedTopNode,
} from './doc-serialization'

// Armed-tool catalogue + factories.
export { TOOLS, makeToolBlock, type ToolKind, type ToolDef } from './tool-blocks'
