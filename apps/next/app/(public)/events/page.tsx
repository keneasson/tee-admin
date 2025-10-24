'use client'

import { Events } from '@my/app/features/events'
import { useUserRole } from '@/hooks/use-user-role'

export default function EventsPage() {
  const { role, isMemberOrHigher, isLoading } = useUserRole()

  return (
    <Events
      eventId={undefined}
      userRole={role}
      isMemberOrHigher={isMemberOrHigher}
      isAuthLoading={isLoading}
    />
  )
}