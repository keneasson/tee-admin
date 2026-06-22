'use client'

import React, { createContext, useContext } from 'react'
import type { EmailIdentity } from '@my/app/types/brand-profile'

/**
 * Brand identity for the email footer, supplied at render time. Defaults to
 * Toronto East so any template rendered without a provider is unchanged
 * (no regression). Callers wrap the rendered element with
 * <EmailIdentityProvider value={...}> to brand the footer per tenant/org.
 */
export const DEFAULT_EMAIL_IDENTITY: EmailIdentity = {
  name: 'Toronto East Christadelphians',
  addressLines: ['975 Cosburn Avenue', 'Toronto, On M4C 2W8', 'Canada'],
}

const EmailIdentityContext = createContext<EmailIdentity>(DEFAULT_EMAIL_IDENTITY)

export const EmailIdentityProvider = EmailIdentityContext.Provider

export function useEmailIdentity(): EmailIdentity {
  return useContext(EmailIdentityContext)
}
