'use client'

import { EmailSender } from '@my/app/features/email-sender'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { useSession } from 'next-auth/react'

export default function EmailSenderPage() {
  const isHydrated = useHydrated()
  const { data: session, status } = useSession()

  if (!isHydrated) {
    return <Loading />
  }

  return <EmailSender session={session} status={status} />
}