'use client'

import { useSession } from 'next-auth/react'
import { HomeScreen } from '@my/app/features/home/screen'
import { useUserRole } from '@/hooks/use-user-role'

export default function HomePage() {
  const { data: session, status } = useSession()
  const { role, isMemberOrHigher } = useUserRole()

  return (
    <HomeScreen
      isAuthenticated={!!session?.user}
      isAuthLoading={status === 'loading'}
      userRole={role}
      isMemberOrHigher={isMemberOrHigher}
    />
  )
}