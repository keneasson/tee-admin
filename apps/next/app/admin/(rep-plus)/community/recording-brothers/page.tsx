'use client'

import { RecordingBrothers } from '@my/app/features/recording-brothers'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { useSession } from 'next-auth/react'

export default function RecordingBrothersPage() {
  const isHydrated = useHydrated()
  const { data: session, status } = useSession()

  if (!isHydrated) {
    return <Loading />
  }

  return <RecordingBrothers session={session} status={status} />
}
