'use client'

import { DirectoryEmailSync } from '@my/app/features/directory-email-sync'
import { useHydrated } from '@my/app/hooks/use-hydrated'

export default function DirectoryEmailSyncPage() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return null
  }

  return <DirectoryEmailSync />
}
