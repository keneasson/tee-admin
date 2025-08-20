'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useSession } from 'next-auth/react'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, XStack, Text, Button, Spinner } from '@my/ui'
import { ArrowLeft, Save, Eye, Trash2, Archive } from '@tamagui/lucide-icons'
import { ProgressiveEventForm } from '@my/ui'
import { Event } from '@my/app/types/events'

interface EditEventPageProps {
  params: Promise<{
    id: string
  }>
}

export default function EditEventPage({ params }: EditEventPageProps) {
  const resolvedParams = use(params)
  const isHydrated = useHydrated()
  const { data: session } = useSession()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${resolvedParams.id}`)
        if (response.ok) {
          const eventData = await response.json()
          setEvent(eventData)
        } else {
          console.error('Event not found')
          router.back()
        }
      } catch (error) {
        console.error('Error fetching event:', error)
        router.back()
      } finally {
        setIsFetching(false)
      }
    }

    fetchEvent()
  }, [resolvedParams.id, router])

  // Early returns after all hooks have been called
  if (!isHydrated) {
    return (
      <YStack padding="$4" alignItems="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (!session?.user) {
    return (
      <YStack padding="$4" alignItems="center">
        <Text>Please sign in to access this page.</Text>
      </YStack>
    )
  }

  if (session.user.role !== 'owner' && session.user.role !== 'admin') {
    return (
      <YStack padding="$4" alignItems="center">
        <Text>Insufficient permissions. Admin/Owner access required.</Text>
      </YStack>
    )
  }

  const handleSave = async (eventData: any) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/events/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (response.ok) {
        const updatedEvent = await response.json()
        setEvent(updatedEvent)
        alert('Event updated successfully!')
      } else {
        const error = await response.json()
        console.error('Error updating event:', error)
        alert('Failed to update event. Please try again.')
      }
    } catch (error) {
      console.error('Error updating event:', error)
      alert('Failed to update event. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreview = (eventData: any) => {
    // Open the public event page in a new tab
    window.open(`/events/${resolvedParams.id}`, '_blank')
  }

  const handlePublish = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/events/${resolvedParams.id}/publish`, {
        method: 'POST',
      })

      if (response.ok) {
        const updatedEvent = await response.json()
        setEvent(updatedEvent)
        alert('Event published successfully!')
      } else {
        const error = await response.json()
        console.error('Error publishing event:', error)
        alert('Failed to publish event. Please try again.')
      }
    } catch (error) {
      console.error('Error publishing event:', error)
      alert('Failed to publish event. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleArchive = async () => {
    if (!confirm('Are you sure you want to archive this event?')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/events/${resolvedParams.id}/archive`, {
        method: 'POST',
      })

      if (response.ok) {
        const updatedEvent = await response.json()
        setEvent(updatedEvent)
        alert('Event archived successfully!')
      } else {
        const error = await response.json()
        console.error('Error archiving event:', error)
        alert('Failed to archive event. Please try again.')
      }
    } catch (error) {
      console.error('Error archiving event:', error)
      alert('Failed to archive event. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/events/${resolvedParams.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.back()
      } else {
        const error = await response.json()
        console.error('Error deleting event:', error)
        alert('Failed to delete event. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '$orange10'
      case 'published': return '$green10'
      case 'archived': return '$gray10'
      default: return '$gray10'
    }
  }

  if (isFetching) {
    return (
      <YStack padding="$4" alignItems="center">
        <Spinner size="large" />
        <Text color="$gray11">Loading event...</Text>
      </YStack>
    )
  }

  if (!event) {
    return (
      <YStack padding="$4" alignItems="center">
        <Text>Event not found</Text>
      </YStack>
    )
  }

  return (
    <YStack padding="$4" space="$4" maxWidth={1000} alignSelf="center">
      {/* Header */}
      <YStack space="$2">
        <XStack space="$3" alignItems="center">
          <Button
            size="$3"
            variant="outlined"
            icon={ArrowLeft}
            onPress={() => router.back()}
            disabled={isLoading}
          />
          <YStack flex={1}>
            <XStack space="$2" alignItems="center">
              <Text fontSize="$8" fontWeight="bold">Edit Event</Text>
              <Text
                fontSize="$3"
                color={getStatusColor(event.status)}
                backgroundColor={`${getStatusColor(event.status)}20`}
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                fontWeight="600"
              >
                {event.status.toUpperCase()}
              </Text>
            </XStack>
            <Text color="$gray11" fontSize="$4">
              {event.title}
            </Text>
          </YStack>
        </XStack>
      </YStack>

      {/* Action Buttons */}
      <XStack space="$2" justifyContent="flex-end">
        <Button
          size="$3"
          variant="outlined"
          icon={Eye}
          onPress={() => handlePreview(event)}
          disabled={isLoading}
        >
          Preview
        </Button>
        
        {event.status === 'draft' && (
          <Button
            size="$3"
            theme="blue"
            onPress={handlePublish}
            disabled={isLoading}
          >
            Publish
          </Button>
        )}
        
        {event.status === 'published' && (
          <Button
            size="$3"
            variant="outlined"
            icon={Archive}
            onPress={handleArchive}
            disabled={isLoading}
          >
            Archive
          </Button>
        )}
        
        <Button
          size="$3"
          variant="outlined"
          color="$red10"
          icon={Trash2}
          onPress={handleDelete}
          disabled={isLoading}
        >
          Delete
        </Button>
      </XStack>

      {/* Event Form */}
      <ProgressiveEventForm
        initialData={event}
        onSave={handleSave}
        onPreview={handlePreview}
        isLoading={isLoading}
        skipTypeSelection={true}
      />
    </YStack>
  )
}