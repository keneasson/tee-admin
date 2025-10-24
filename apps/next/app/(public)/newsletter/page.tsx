'use client'

import { NewsletterScreen } from '@my/app/features/newsletter/newsletter-screen'
import { useUserRole } from '@/hooks/use-user-role'

export default function NewsletterPage() {
  const { role, isMemberOrHigher, isLoading } = useUserRole()

  return (
    <NewsletterScreen
      userRole={role}
      isMemberOrHigher={isMemberOrHigher}
      isAuthLoading={isLoading}
    />
  )
}