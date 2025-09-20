'use client'

import { EmailLists } from '@my/app/features/email-lists'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

export default function EmailListsPage() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <Loading />
  }

  return <EmailLists />
}