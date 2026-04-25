'use client'

import { EmailLists } from '@my/app/features/email-lists'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { useSession } from 'next-auth/react'

export default function EmailListsPage() {
  const isHydrated = useHydrated()
  const { data: session, status } = useSession()

  if (!isHydrated) {
    return <Loading />
  }

  return <EmailLists session={session} status={status} />
}