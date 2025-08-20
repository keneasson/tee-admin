import { useEffect, useState } from 'react'

/**
 * Hook to check if the component has been hydrated on the client side.
 * Prevents hydration mismatches when using client-side only features.
 */
export function useHydrated() {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return isHydrated
}
