/**
 * Centralized Home Ecclesia Configuration
 *
 * This is the SINGLE source of truth for ecclesia naming throughout the system.
 * Use these values instead of hardcoding ecclesia names.
 *
 * Naming Convention:
 * - canonicalName: Used for database storage and internal references
 * - publicName: Used for public-facing content (YouTube, email footers)
 */

/**
 * All known variants of the home ecclesia name that should be normalized
 */
const HOME_ECCLESIA_VARIANTS = [
  'tee',
  'toronto east',
  'toronto east ecclesia',
  'toronto east christadelphian ecclesia',
  'toronto east christadelphians',
] as const

export const HOME_ECCLESIA = {
  /**
   * The canonical database name - used for all internal storage and references
   */
  canonicalName: 'Toronto East Ecclesia',

  /**
   * The public-facing brand name - used for YouTube, email footers, etc.
   */
  publicName: 'Toronto East Christadelphians',

  /**
   * Check if a value matches any variant of the home ecclesia name
   * Used for backward compatibility during migration from "TEE" to full name
   *
   * @param value - The ecclesia value to check
   * @returns true if the value matches any known variant
   */
  isHomeEcclesia: (value: string | undefined | null): boolean => {
    if (!value) return false
    const normalized = value.toLowerCase().trim()
    return HOME_ECCLESIA_VARIANTS.includes(
      normalized as (typeof HOME_ECCLESIA_VARIANTS)[number]
    )
  },

  /**
   * Normalize any ecclesia variant to the canonical name
   * Non-home ecclesia values are returned unchanged
   *
   * @param value - The ecclesia value to normalize
   * @returns The canonical name if it matches a home ecclesia variant, otherwise the original value
   */
  normalize: (value: string | undefined | null): string => {
    if (!value) return ''
    if (HOME_ECCLESIA.isHomeEcclesia(value)) return HOME_ECCLESIA.canonicalName
    return value
  },
} as const
