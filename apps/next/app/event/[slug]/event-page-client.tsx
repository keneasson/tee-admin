'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { Loading } from '@my/app/provider/loading'
import { Wrapper } from '@my/app/provider/wrapper'
import { Event } from '@my/app/types/events'
import { EventPageTemplate } from '@my/ui'
import { notFound, redirect } from 'next/navigation'
import React from 'react'

interface EventPageClientProps {
  slug: string
}

export default function EventPageClient({ slug }: EventPageClientProps) {
  const isHydrated = useHydrated()
  const [event, setEvent] = React.useState<Event | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [requiresAuth, setRequiresAuth] = React.useState(false)

  React.useEffect(() => {
    if (!isHydrated) return

    async function fetchEvent() {
      try {
        setLoading(true)

        // Try to fetch the event
        const fetchedEvent = await fetch(`/api/events/by-slug/${slug}`)

        if (!fetchedEvent.ok) {
          if (fetchedEvent.status === 401) {
            setRequiresAuth(true)
            return
          }
          if (fetchedEvent.status === 404) {
            return notFound()
          }
          throw new Error('Failed to fetch event')
        }

        const eventData = await fetchedEvent.json()

        // Check if event is draft and user has permission
        if (eventData.status === 'draft') {
          // TODO: Check user permissions
          // For now, redirect to login
          redirect('/auth/signin?redirect=' + encodeURIComponent(`/event/${slug}`))
        }

        setEvent(eventData)
      } catch (error) {
        console.error('Error fetching event:', error)
        notFound()
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [slug, isHydrated])

  // Show loading state
  if (!isHydrated || loading) {
    return (
      <Wrapper subHeader="Loading Event...">
        <Loading />
      </Wrapper>
    )
  }

  // Show auth required state
  if (requiresAuth) {
    return (
      <Wrapper subHeader="Sign In Required">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Authentication Required</h2>
          <p>This event requires you to be signed in to view the details.</p>
          <a href={`/auth/signin?redirect=${encodeURIComponent(`/event/${slug}`)}`}>
            Sign In to Continue
          </a>
        </div>
      </Wrapper>
    )
  }

  // Show event not found
  if (!event) {
    return notFound()
  }

  return (
    <Wrapper subHeader={event.title}>
      <EventPageTemplate event={event} />
    </Wrapper>
  )
}
