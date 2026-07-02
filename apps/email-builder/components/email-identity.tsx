'use client'

import React, { createContext, useContext } from 'react'
import type { EmailIdentity } from '@my/app/types/brand-profile'
// Default lives in the server-safe FooterContent module (single source of
// truth) so it can also be used from App Router server routes; re-exported here
// for existing importers.
import { DEFAULT_EMAIL_IDENTITY } from './FooterContent'

export { DEFAULT_EMAIL_IDENTITY }

const EmailIdentityContext = createContext<EmailIdentity>(DEFAULT_EMAIL_IDENTITY)

export const EmailIdentityProvider = EmailIdentityContext.Provider

export function useEmailIdentity(): EmailIdentity {
  return useContext(EmailIdentityContext)
}
