'use client'

import { Events } from '@my/app/features/events'
import { useParams } from 'next/navigation'
import { useUserRole } from '@/hooks/use-user-role'

export default function EventPage() {
  const params = useParams()
  const eventId = params?.eventId as string
  const { role, isMemberOrHigher, isLoading } = useUserRole()

  return (
    <Events
      eventId={eventId}
      userRole={role}
      isMemberOrHigher={isMemberOrHigher}
      isAuthLoading={isLoading}
    />
  )
}