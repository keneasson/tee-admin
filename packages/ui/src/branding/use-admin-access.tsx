'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROLES } from '@my/app/provider/auth/auth-roles'

export function useAdminAccess() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const hasAccess = session?.user?.role === ROLES.ADMIN || session?.user?.role === ROLES.OWNER
  
  useEffect(() => {
    if (status === 'loading') return // Still loading
    
    if (!session) {
      router.push('/auth/signin')
      return
    }
    
    if (!hasAccess) {
      router.push('/')
      return
    }
  }, [session, status, hasAccess, router])
  
  return {
    hasAccess,
    isLoading: status === 'loading',
    user: session?.user
  }
}