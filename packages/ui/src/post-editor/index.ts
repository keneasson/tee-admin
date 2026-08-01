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
