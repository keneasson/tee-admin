import { canRevealPii, type Viewer, type Channel } from '@my/app/utils/viewer-pii'

/**
 * Cache-Control for a per-viewer, PII-redacted API response.
 *
 * When the viewer can see PII (authenticated member+), the payload carries full
 * names / addresses and MUST NOT land in any shared or CDN cache — otherwise a
 * later ANONYMOUS request could be served the cached full-name copy (cache
 * poisoning → the exact PII leak the redaction exists to prevent). Anonymous and
 * recognized responses are already redacted, so they stay publicly cacheable.
 *
 * Pass the `publicValue` you'd use for an anonymous response; a PII-bearing
 * viewer gets `private, no-store` instead. Keep this the single source of truth
 * for that decision so every viewer-aware endpoint stays consistent.
 */
export function piiAwareCacheControl(
  viewer: Viewer,
  publicValue: string,
  channel: Channel = 'public-web'
): string {
  return canRevealPii(viewer, channel) ? 'private, no-store' : publicValue
}
