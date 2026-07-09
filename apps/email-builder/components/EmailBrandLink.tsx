import React from 'react'
import { useEmailIdentity } from './email-identity'
import { EmailBrandLinkContent } from './EmailBrandLinkContent'
import type { EmailIdentity } from '@my/app/types/brand-profile'

/**
 * Hook-based header brand link: takes identity from the
 * {@link EmailIdentityProvider} context (or an explicit `identity` prop). Used
 * by templates rendered through get-email-content. Server routes that can't
 * invoke the `'use client'` context hook should render
 * {@link EmailBrandLinkContent} directly with an `identity` prop.
 */
export const EmailBrandLink = ({ identity: identityProp }: { identity?: EmailIdentity } = {}) => {
  const contextIdentity = useEmailIdentity()
  return <EmailBrandLinkContent identity={identityProp ?? contextIdentity} />
}
