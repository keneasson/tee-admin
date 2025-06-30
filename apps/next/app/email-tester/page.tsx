'use client'

import { EmailTester } from '@my/app/features/email-tester'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

export default function EmailTesterPage() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <Loading />
  }

  return <EmailTester />
}