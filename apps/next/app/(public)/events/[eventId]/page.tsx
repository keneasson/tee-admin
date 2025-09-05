'use client'

import { Events } from '@my/app/features/events'
import { useParams } from 'next/navigation'

export default function EventPage() {
  const params = useParams()
  const eventId = params?.eventId as string
  
  return <Events eventId={eventId} />
}