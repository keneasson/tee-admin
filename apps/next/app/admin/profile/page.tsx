'use client'

import { Profile } from '@my/app/features/profile'
import { useSession } from 'next-auth/react'

export default function ProfilePage() {
  const { data: session, status } = useSession()

  return <Profile session={session} status={status} />
}