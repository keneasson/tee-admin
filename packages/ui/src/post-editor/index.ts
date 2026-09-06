/**
 * Post editor — self-contained, cross-platform Tamagui module for the unified
 * Post model (Consolidated CMS epic #131, Phase 2a). One editor for create AND
 * edit; the ONLY contract to the page is `value` / `onChange`.
 *
 * See docs/UNIFIED_POST_MODEL_DESIGN.md §3 (blocks) + §3.1 (packaging).
 */
export { PostEditor, type PostEditorProps } from './post-editor'

// Pure model helpers (also unit-testable in isolation).
export {
  postReducer,
  createEmptyPost,
  validateForPublish,
  genId,
  type PostAction,
} from './post-reducer'

// Block registry — the extensibility seam.
export {
  registerBlock,
  getBlockDef,
  listBlockDefs,
  clearBlockRegistry,
  type BlockDef,
  type BlockEditorProps,
} from './registry'
export { registerDefaultBlocks } from './register-default-blocks'

// Occasion-tag default block sets (Phase 2c) — pure, unit-testable in isolation.
export { applyOccasionDefaults } from './occasion-defaults'

// Block editors + factories (for direct reuse / registration).
export { TextBlockEditor, makeTextBlock } from './blocks/text-block-editor'
export { TimeBlockEditor, makeTimeBlock } from './blocks/time-block-editor'
export { PersonBlockEditor, makePersonBlock } from './blocks/person-block-editor'
export { LocationBlockEditor, makeLocationBlock } from './blocks/location-block-editor'
export { FlyerBlockEditor, makeFlyerBlock } from './blocks/flyer-block-editor'
export {
  RegistrationBlockEditor,
  makeRegistrationBlock,
} from './blocks/registration-block-editor'
export { LinkBlockEditor, makeLinkBlock } from './blocks/link-block-editor'

// Document-canvas chrome (Consolidated CMS Phase 2R). Cross-platform: the canvas
// itself arrives through `renderCanvas` (Lexical on web, native on Expo).
export {
  PostDocChrome,
  type PostDocChromeProps,
  type PostDocCanvasProps,
} from './post-doc-chrome'

// Document-canvas widget UIs that are already platform-free (Tamagui only).
// The remaining three (location / person / flyer) still reach for relative-URL
// fetches and stay in apps/next until they get a shared data seam — see the
// follow-up issue referenced in docs/adr/0003.
export { TemplatePicker } from './template-picker'
export { LinkEditor } from './widgets/link-editor'
export { RegistrationEditor } from './widgets/registration-editor'
export { TimePicker } from './widgets/time-picker'
