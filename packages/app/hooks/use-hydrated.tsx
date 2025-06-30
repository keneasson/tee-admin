'use client'

import { useEffect, useState } from 'react'

/**
 * Hook to safely handle hydration mismatches in App Router
 * Returns false during SSR and initial hydration, true after client-side hydration
 * Use this to prevent hydration mismatches when content differs between server and client
 */
export function useHydrated(): boolean {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return isHydrated
}