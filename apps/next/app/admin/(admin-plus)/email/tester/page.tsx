'use client'

import { EmailTester } from '@my/app/features/email-tester'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { useSession } from 'next-auth/react'

export default function EmailTesterPage() {
  const isHydrated = useHydrated()
  const { data: session, status } = useSession()

  if (!isHydrated) {
    return <Loading />
  }

  return <EmailTester session={session} status={status} />
}