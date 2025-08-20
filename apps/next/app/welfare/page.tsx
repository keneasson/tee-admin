'use client'

import { Welfare } from '@my/app/features/welfare'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

export default function WelfarePage() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <Loading />
  }

  return <Welfare />
}
