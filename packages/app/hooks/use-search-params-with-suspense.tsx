'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Wrapper hook that provides useSearchParams with suspense boundary
export function useSearchParamsWithSuspense() {
  return useSearchParams()
}

// Higher order component to wrap components that use useSearchParams
export function withSearchParamsSuspense<T extends {}>(
  Component: React.ComponentType<T>
) {
  return function WrappedComponent(props: T) {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <Component {...props} />
      </Suspense>
    )
  }
}