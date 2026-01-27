'use client'

import { useSession } from 'next-auth/react'
import { HomeScreen } from '@my/app/features/home/screen'

export default function HomePage() {
  const { data: session, status } = useSession()

  return (
    <HomeScreen
      isAuthenticated={!!session?.user}
      isAuthLoading={status === 'loading'}
    />
  )
}