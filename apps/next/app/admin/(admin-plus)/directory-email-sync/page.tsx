'use client'

import { DirectoryEmailSync } from '@my/app/features/directory-email-sync'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useSession } from 'next-auth/react'

export default function DirectoryEmailSyncPage() {
  const isHydrated = useHydrated()
  const { data: session, status } = useSession()

  if (!isHydrated) {
    return null
  }

  return <DirectoryEmailSync session={session} status={status} />
}
