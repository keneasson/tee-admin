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
