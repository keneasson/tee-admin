/**
 * Post view — the read-only display twin of the post editor (Consolidated CMS
 * epic #131, Phase 3). Renders an ALREADY-REDACTED {@link Post} read-only.
 */
export { PostView, type PostViewProps } from './post-view'

// Pure display-string helpers (platform-free, unit-testable in isolation —
// PostView itself pulls in Tamagui + Lucide which the plain-Node test env
// can't load).
export {
  personRoleLabel,
  formatPersonName,
  personMetaLine,
  locationAddressLines,
  locationMapsHref,
  formatTimeBlock,
  formatDateFacet,
  looksLikeImage,
  formatOccasions,
  type FormattedTime,
} from './post-view-format'
