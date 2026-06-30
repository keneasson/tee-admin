import React from 'react'
import { useEmailIdentity } from './email-identity'
import { FooterContent } from './FooterContent'
import type { EmailIdentity } from '@my/app/types/brand-profile'

/**
 * Hook-based footer: takes identity from the {@link EmailIdentityProvider}
 * context (or an explicit `identity` prop). Used by templates rendered through
 * get-email-content. Server routes that can't invoke the `'use client'` context
 * hook should render {@link FooterContent} directly with an `identity` prop.
 */
export const Footer = ({ identity: identityProp }: { identity?: EmailIdentity } = {}) => {
  const contextIdentity = useEmailIdentity()
  return <FooterContent identity={identityProp ?? contextIdentity} />
}
