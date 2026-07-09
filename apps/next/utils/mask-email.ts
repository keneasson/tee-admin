/**
 * Mask an email for display as a "which address did I use?" reminder without
 * revealing the whole thing (e.g. to a forward recipient holding a recognized
 * token — see #80).
 *
 *   ken.easson@gmail.com  ->  k***n@gmail.com     (free/ISP domain shown whole)
 *   ken@rangle.io         ->  k***n@r**e.io       (custom domain masked too)
 *
 * Free / ISP providers are shown in full because the domain gives nothing away.
 * A custom (org) domain is masked because it can identify where someone works.
 */

// Providers where the domain reveals nothing personal → show it whole.
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.ca', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
  // Microsoft consumer domains
  'hotmail.com', 'hotmail.ca', 'hotmail.co.uk', 'hotmail.fr',
  'outlook.com', 'outlook.ca', 'outlook.co.uk', 'live.com', 'live.ca', 'live.co.uk', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'gmx.com', 'mail.com', 'zoho.com', 'yandex.com',
  'proton.me', 'protonmail.com',
  // Public ISP mailboxes (don't identify an org)
  'rogers.com', 'sympatico.ca', 'bell.net', 'cogeco.ca', 'shaw.ca', 'telus.net',
  'comcast.net', 'verizon.net', 'sbcglobal.net', 'att.net', 'cox.net', 'charter.net',
  'bigpond.com', 'golden.net', 'gto.net',
])

/** First char + stars + last char. Short labels get a single trailing star. */
function maskLabel(s: string, stars: number): string {
  if (!s) return s
  if (s.length <= 2) return s[0] + '*'
  return s[0] + '*'.repeat(stars) + s[s.length - 1]
}

export function maskEmail(email: string): string {
  const value = (email || '').trim()
  const at = value.lastIndexOf('@')
  if (at < 1 || at === value.length - 1) return value

  const local = value.slice(0, at)
  const domain = value.slice(at + 1).toLowerCase()
  const maskedLocal = maskLabel(local, 3)

  if (PUBLIC_DOMAINS.has(domain)) {
    return `${maskedLocal}@${domain}`
  }

  // Custom domain: keep the TLD, mask the registrable label and any subdomains.
  const parts = domain.split('.')
  if (parts.length < 2) return `${maskedLocal}@${maskLabel(domain, 2)}`
  for (let i = 0; i < parts.length - 1; i++) {
    parts[i] = maskLabel(parts[i], 2)
  }
  return `${maskedLocal}@${parts.join('.')}`
}
