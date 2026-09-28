/**
 * Add UTM parameters to all tee-admin.com links in email HTML
 * This connects email clicks to web analytics tracking
 */
export function addUtmParameters(
  html: string,
  emailType: string,
  sendDate: string
): string {
  // Match href attributes pointing to tee-admin.com URLs
  return html.replace(
    /href="(https?:\/\/[^"]*tee-admin\.com[^"]*)"/gi,
    (match, url: string) => {
      // Skip unsubscribe links
      if (url.includes('unsubscribe') || url.includes('opt-out')) {
        return match
      }

      try {
        const parsed = new URL(url)
        // Don't overwrite existing UTM params
        if (!parsed.searchParams.has('utm_source')) {
          parsed.searchParams.set('utm_source', emailType)
        }
        if (!parsed.searchParams.has('utm_medium')) {
          parsed.searchParams.set('utm_medium', 'email')
        }
        if (!parsed.searchParams.has('utm_campaign')) {
          parsed.searchParams.set('utm_campaign', `${emailType}-${sendDate}`)
        }
        return `href="${parsed.toString()}"`
      } catch {
        // If URL parsing fails, return original
        return match
      }
    }
  )
}

// First-party hosts whose pages honour the recognition cookie (#252).
const FIRST_PARTY_HREF = /href="(https?:\/\/(?:[a-z0-9-]+\.)*(?:tee-admin\.com|echadhub\.org|echadhub\.com)(?:[:/?#][^"]*)?)"/gi

/**
 * Append this recipient's recognition token (`?rt=`) to every first-party link,
 * so a reader who clicks through lands `recognized` and sees what the email
 * showed them — e.g. the registration contact email (#252). Middleware moves it
 * into a cookie and strips it from the URL on arrival.
 *
 * Left alone: unsubscribe/opt-out links, API and /auth links, and any link that
 * already carries its own `token` (preferences, sign-in, ecclesia-contact —
 * those pages authenticate the reader themselves).
 */
export function addRecognitionToken(html: string, token: string): string {
  return html.replace(FIRST_PARTY_HREF, (match, url: string) => {
    if (url.includes('unsubscribe') || url.includes('opt-out')) return match
    try {
      const parsed = new URL(url.replace(/&amp;/g, '&'))
      if (parsed.pathname.startsWith('/api/') || parsed.pathname.startsWith('/auth/')) return match
      if (parsed.searchParams.has('token') || parsed.searchParams.has('rt')) return match
      parsed.searchParams.set('rt', token)
      return `href="${parsed.toString().replace(/&/g, '&amp;')}"`
    } catch {
      return match
    }
  })
}
