'use client'

import { Events } from '@my/app/features/events'
import { useParams, useSearchParams } from 'next/navigation'
import { useUserRole } from '@/hooks/use-user-role'

export default function EventPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const eventId = params?.eventId as string
  const { role, isMemberOrHigher, isLoading } = useUserRole()

  // When arriving from an email link (UTM tracking), provide a meaningful back link
  const fromEmail = searchParams?.get('utm_medium') === 'email'
  const backLink = fromEmail ? { href: '/newsletter', label: 'View full Newsletter' } : undefined
  // Where "Sign in to see all details" goes — and comes back to (#252).
  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(`/events/${eventId}`)}`

  return (
    <Events
      eventId={eventId}
      userRole={role}
      isMemberOrHigher={isMemberOrHigher}
      isAuthLoading={isLoading}
      backLink={backLink}
      signInHref={signInHref}
    />
  )
}