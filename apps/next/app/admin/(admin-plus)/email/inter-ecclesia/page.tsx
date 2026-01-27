'use client'

import { InterEcclesiaEmailSender } from '@my/app/features/inter-ecclesia-sender'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

export default function InterEcclesiaPage() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <Loading />
  }

  return <InterEcclesiaEmailSender />
}
