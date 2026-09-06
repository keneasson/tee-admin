/**
 * Pure helpers for the {@link FlyerUploader} (Consolidated CMS 2R-2). A FlyerBlock
 * carries a {@link DocumentAttachment}; the uploader's only non-trivial decisions
 * are "does this block already have an image?" and "is this picked file an image
 * we can preview inline?". Kept here (no React / fetch) so they are unit-testable.
 */

import type { FlyerBlock } from '@my/app/types/post'

/** File-input accept filter: the image types the flyer canvas can preview inline. */
export const FLYER_ACCEPT = 'image/*'

/** True when a picked file's MIME type is an image (vs a PDF or other upload). */
export function isImageMime(mimeType: string | undefined): boolean {
  return !!mimeType && mimeType.trim().toLowerCase().startsWith('image/')
}

/**
 * True when the flyer block already has an uploaded image (a non-blank fileUrl).
 * A fresh `emptyFlyer()` block has all-empty document strings, so this is false
 * until an upload succeeds — the uploader shows the picker vs the preview on it.
 */
export function hasFlyerImage(block: FlyerBlock): boolean {
  return !!block.document?.fileUrl?.trim()
}
