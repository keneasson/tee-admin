/**
 * Synthetic email addresses, and how to keep them out of people's faces.
 *
 * Relationships and PersonRecords are keyed by email, so somebody with no
 * address of their own — or who shares a household one — is given a generated
 * key like `pending-1789001511101-dntj1@family.local`. That is plumbing: it
 * exists so a person can have an identity at all.
 *
 * It must NEVER be shown. Somebody looking at Brian Rose's profile and reading
 * "pending-1789001511101-dntj1@family.local" would reasonably conclude the
 * record is broken, or try to email it. Nothing is ever delivered there —
 * `family.local` is not a routable domain.
 *
 * The right fix is for relationships to key on `personId` (issue #129), after
 * which these disappear. Until then they are hidden at every read boundary.
 *
 * Pure + I/O-free. Cross-platform.
 */

/** Domain used for generated, non-routable placeholder addresses. */
export const PLACEHOLDER_EMAIL_DOMAIN = '@family.local'

/** True when an address is generated plumbing rather than a real mailbox. */
export function isPlaceholderEmail(email?: string | null): boolean {
  if (!email) return false
  return email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN)
}

/** The address to display, or undefined when there is nothing real to show. */
export function displayableEmail(email?: string | null): string | undefined {
  if (!email || isPlaceholderEmail(email)) return undefined
  return email
}

/** Drop placeholder addresses from a list meant for display. */
export function withoutPlaceholderEmails<T extends { email?: string | null }>(items: T[]): T[] {
  return items.filter((item) => !isPlaceholderEmail(item.email))
}
