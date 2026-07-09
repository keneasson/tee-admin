import { Link, Text } from '@react-email/components'
import React from 'react'
import type { EmailIdentity } from '@my/app/types/brand-profile'

/**
 * Pure, presentational header line linking back to the sending site
 * (tee-admin.com / echadhub.org — whichever tenant sent the email). Identity is
 * a plain prop — no React context / hook — so this renders from any server
 * context (mirrors {@link FooterContent}). Templates that take identity from the
 * EmailIdentityProvider context use the hook-based {@link EmailBrandLink}.
 *
 * The URL itself is the link text (preceded by "For more, visit ") so the link
 * is self-describing / accessible — a screen reader announces the destination,
 * not a bare word. Renders nothing when the identity has no homeUrl.
 */
export const EmailBrandLinkContent = ({ identity }: { identity?: EmailIdentity }) => {
  const homeUrl = identity?.homeUrl
  if (!homeUrl) return null
  // Show the domain without the protocol — cleaner, still the real destination.
  const displayUrl = homeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <Text style={{ textAlign: 'center' as const, fontSize: '13px', margin: '10px 0 0', color: '#00102c' }}>
      {'For more, visit '}
      <Link href={homeUrl} style={{ color: '#003da9', textDecoration: 'underline' }}>
        {displayUrl}
      </Link>
    </Text>
  )
}
