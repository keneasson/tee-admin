/**
 * Parse a typed address line into its parts — the resilience that lets the
 * ecclesia form work when Google Places does not.
 *
 * WHY: the Add Ecclesia form had no province or city inputs at all. Those fields
 * were populated ONLY by the Places autocomplete callback, and Places is
 * unconfigured in production and fails silently. So a complete, correctly typed
 * address — "51 William St, Paris, ON N3L 1L2" — produced nothing, and the
 * ecclesia saved with empty province/city, which are KEY MATERIAL: the record
 * became permanently unlistable and unsearchable.
 *
 * A form that cannot do anything with a well-formed address the author already
 * typed is not resilient. This does the obvious parse locally, so the lookup is
 * an accelerator rather than a dependency.
 *
 * Deliberately conservative: it returns only what it is confident about and
 * leaves the rest for the author to fill in. Guessing wrongly would be worse
 * than leaving a field blank, because these fields form the key.
 *
 * Pure + I/O-free. Cross-platform.
 */

export interface ParsedAddressLine {
  streetAddress?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}

/** Canadian postal code, with or without the middle space. */
const CA_POSTAL = /\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/i
/** US ZIP, 5 digits or ZIP+4. */
const US_ZIP = /\b(\d{5})(?:-\d{4})?\b/

const CA_PROVINCES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
])

const CA_PROVINCE_NAMES: Record<string, string> = {
  alberta: 'AB',
  'british columbia': 'BC',
  manitoba: 'MB',
  'new brunswick': 'NB',
  'newfoundland and labrador': 'NL',
  newfoundland: 'NL',
  'nova scotia': 'NS',
  'northwest territories': 'NT',
  nunavut: 'NU',
  ontario: 'ON',
  'prince edward island': 'PE',
  quebec: 'QC',
  québec: 'QC',
  saskatchewan: 'SK',
  yukon: 'YT',
}

/** Normalise a token to a province code, or undefined if it is not one. */
function toProvince(token: string): string | undefined {
  const t = token.trim()
  if (!t) return undefined
  const upper = t.toUpperCase()
  if (CA_PROVINCES.has(upper)) return upper
  return CA_PROVINCE_NAMES[t.toLowerCase()]
}

/**
 * Parse a comma-separated address line. Handles the common shapes:
 *   "51 William St, Paris, ON N3L 1L2"
 *   "51 William St, Paris, Ontario, N3L 1L2"
 *   "Paris, ON"
 */
export function parseAddressLine(input: string): ParsedAddressLine {
  const out: ParsedAddressLine = {}
  if (typeof input !== 'string' || !input.trim()) return out

  let rest = input.trim()

  // Postal code first — it is the most distinctive token, and pulling it out
  // stops it being mistaken for part of the city or province segment.
  const ca = CA_POSTAL.exec(rest)
  if (ca) {
    out.postalCode = `${ca[1].toUpperCase()} ${ca[2].toUpperCase()}`
    out.country = 'CA'
    rest = rest.replace(ca[0], ' ').trim()
  } else {
    const us = US_ZIP.exec(rest)
    if (us) {
      out.postalCode = us[0]
      out.country = 'US'
      rest = rest.replace(us[0], ' ').trim()
    }
  }

  const parts = rest
    .split(',')
    .map((p) => p.trim().replace(/\s{2,}/g, ' '))
    .filter(Boolean)

  // Walk from the END: the last recognisable token is the province, and the one
  // before it is the city. Anything left in front is the street address.
  for (let i = parts.length - 1; i >= 0; i--) {
    const province = toProvince(parts[i])
    if (province) {
      out.province = province
      if (!out.country) out.country = 'CA'
      if (i - 1 >= 0) out.city = parts[i - 1]
      const street = parts.slice(0, Math.max(0, i - 1)).join(', ')
      if (street) out.streetAddress = street
      return out
    }
  }

  // A trailing province may be glued to the city ("Paris ON") once the postal
  // code has been removed.
  const last = parts[parts.length - 1]
  if (last) {
    const tokens = last.split(/\s+/)
    const province = tokens.length > 1 ? toProvince(tokens[tokens.length - 1]) : undefined
    if (province) {
      out.province = province
      if (!out.country) out.country = 'CA'
      out.city = tokens.slice(0, -1).join(' ')
      const street = parts.slice(0, -1).join(', ')
      if (street) out.streetAddress = street
      return out
    }
  }

  // No province found — hand back what is unambiguous and let the author finish.
  if (parts.length >= 2) {
    out.city = parts[parts.length - 1]
    out.streetAddress = parts.slice(0, -1).join(', ')
  } else if (parts.length === 1) {
    out.streetAddress = parts[0]
  }
  return out
}
