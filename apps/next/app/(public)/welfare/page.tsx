'use client'

import { useSession } from 'next-auth/react'
import { Welfare } from '@my/app/features/welfare'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

export default function WelfarePage() {
  const { data: session } = useSession()
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <Loading />
  }

  return <Welfare isAuthenticated={!!session?.user} />
}