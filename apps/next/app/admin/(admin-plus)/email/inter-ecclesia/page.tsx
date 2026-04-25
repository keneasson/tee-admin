'use client'

import { InterEcclesiaEmailSender } from '@my/app/features/inter-ecclesia-sender'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { useSession } from 'next-auth/react'

export default function InterEcclesiaPage() {
  const isHydrated = useHydrated()
  const { data: session, status } = useSession()

  if (!isHydrated) {
    return <Loading />
  }

  return <InterEcclesiaEmailSender session={session} status={status} />
}
