'use client'

import React, { createContext, useContext } from 'react'

/**
 * Signed-in user's home ecclesia, surfaced in the page header (Banner).
 *
 * Cross-platform safe: this context holds a plain string and never imports
 * platform auth. Platform code (Next.js layout / Expo) reads the session and
 * provides the value; shared components consume it. When no provider is
 * mounted (or no user is signed in) the value is null and the header falls
 * back to the brand's default title.
 */
const HeaderEcclesiaContext = createContext<string | null>(null)

export const HeaderEcclesiaProvider = HeaderEcclesiaContext.Provider

export function useHeaderEcclesia(): string | null {
  return useContext(HeaderEcclesiaContext)
}
