'use client'

import { EmailSender } from '@my/app/features/email-sender'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'

export default function EmailSenderPage() {
  const isHydrated = useHydrated()

  if (!isHydrated) {
    return <Loading />
  }

  return <EmailSender />
}