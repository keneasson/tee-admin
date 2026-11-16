/**
 * The name to address a person by (#334).
 *
 * A directory entry can carry a preferred first and/or last name (#332) — the
 * name the person actually goes by. Anything that SPEAKS TO or SIGNS AS a
 * person (an email greeting, a sign-off, "Hi …" on a page) uses it; each half
 * falls back to the legal name on its own, so a preferred first name alone
 * gives "Ben Sample".
 *
 * Not for matching (see `personNames` in name-resolver) and not for the
 * person's display name in lists — only for addressing them.
 *
 * PURE: no I/O, safe on web and native.
 */

export interface AddressablePerson {
  firstName?: string | null
  lastName?: string | null
  preferredFirstName?: string | null
  preferredLastName?: string | null
  displayName?: string | null
}

/** True when either half of a preferred name is filled in. */
export function hasPreferredName(p: AddressablePerson | null | undefined): boolean {
  return Boolean(p?.preferredFirstName?.trim() || p?.preferredLastName?.trim())
}

/** Preferred first name, else first name, else ''. */
export function addressFirstName(p: AddressablePerson | null | undefined): string {
  if (!p) return ''
  return p.preferredFirstName?.trim() || p.firstName?.trim() || ''
}

/** Preferred last name, else last name, else ''. */
export function addressLastName(p: AddressablePerson | null | undefined): string {
  if (!p) return ''
  return p.preferredLastName?.trim() || p.lastName?.trim() || ''
}

/** "First Last" using each preferred half when set; '' when there is no name. */
export function addressFullName(p: AddressablePerson | null | undefined): string {
  return [addressFirstName(p), addressLastName(p)].filter(Boolean).join(' ')
}
