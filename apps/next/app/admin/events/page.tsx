'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, XStack, Text, Button, Card, Spinner, Input } from '@my/ui'
import { Plus, Search, Filter, MoreHorizontal, Calendar, MapPin, User, Eye, Edit3, Archive, Trash2 } from '@tamagui/lucide-icons'
import { Event, EventListResponse, EventType, EventStatus } from '@my/app/types/events'

export default function EventsAdminPage() {
  const isHydrated = useHydrated()
  const { data: session } = useSession()
  const router = useRouter()
  
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<EventStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<EventType | ''>('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter) params.append('status', statusFilter)
      if (typeFilter) params.append('type', typeFilter)
      
      const response = await fetch(`/api/events?${params}`)
      const data: EventListResponse = await response.json()
      
      if (page === 1) {
        setEvents(data.events)
      } else {
        setEvents(prev => [...prev, ...data.events])
      }
      
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [page, searchTerm, statusFilter, typeFilter])

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

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setPage(1)
  }

  const handleStatusFilter = (status: EventStatus | '') => {
    setStatusFilter(status)
    setPage(1)
  }

  const handleTypeFilter = (type: EventType | '') => {
    setTypeFilter(type)
    setPage(1)
  }

  const handlePublish = async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/publish`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchEvents()
      }
    } catch (error) {
      console.error('Error publishing event:', error)
    }
  }

  const handleArchive = async (eventId: string) => {
    try {
      const response = await fetch(`/api/events/${eventId}/archive`, {
        method: 'POST'
      })
      
      if (response.ok) {
        fetchEvents()
      }
    } catch (error) {
      console.error('Error archiving event:', error)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }
    
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchEvents()
      }
    } catch (error) {
      console.error('Error deleting event:', error)
    }
  }

  const getEventTypeColor = (type: EventType) => {
    switch (type) {
      case 'study-weekend': return '$blue10'
      case 'funeral': return '$gray10'
      case 'wedding': return '$pink10'
      case 'general': return '$green10'
      default: return '$gray10'
    }
  }

  const getEventTypeLabel = (type: EventType) => {
    switch (type) {
      case 'study-weekend': return 'Study Weekend'
      case 'funeral': return 'Funeral'
      case 'wedding': return 'Wedding'
      case 'general': return 'General'
      default: return type
    }
  }

  const getStatusColor = (status: EventStatus) => {
    switch (status) {
      case 'draft': return '$orange10'
      case 'published': return '$green10'
      case 'archived': return '$gray10'
      default: return '$gray10'
    }
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getEventDate = (event: Event) => {
    if (event.type === 'study-weekend') {
      return formatDate(event.dateRange.start)
    }
    if (event.type === 'funeral') {
      return formatDate(event.serviceDate)
    }
    if (event.type === 'wedding') {
      return formatDate(event.ceremonyDate)
    }
    if (event.type === 'general' && event.startDate) {
      return formatDate(event.startDate)
    }
    return 'TBD'
  }

  return (
    <YStack padding="$4" space="$4" maxWidth={1200} alignSelf="center">
      {/* Header */}
      <YStack space="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text fontSize="$8" fontWeight="bold">Event Management</Text>
            <Text color="$gray11">
              Create and manage ecclesial events with flexible structure and progressive disclosure.
            </Text>
          </YStack>
          
          <Button
            theme="blue"
            icon={Plus}
            onPress={() => router.push('/admin/events/create')}
          >
            Create Event
          </Button>
        </XStack>
      </YStack>

      {/* Filters */}
      <Card padding="$4">
        <YStack space="$3">
          <Text fontSize="$5" fontWeight="600">Filters</Text>
          
          <XStack space="$3" alignItems="center">
            <YStack flex={2}>
              <XStack space="$2" alignItems="center">
                <Search size="$1" color="$gray11" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChangeText={handleSearch}
                  flex={1}
                />
              </XStack>
            </YStack>
            
            <YStack flex={1}>
              <Input placeholder="All Statuses" />
            </YStack>
            
            <YStack flex={1}>
              <Input placeholder="All Types" />
            </YStack>
          </XStack>
        </YStack>
      </Card>

      {/* Events List */}
      <YStack space="$3">
        {loading && page === 1 ? (
          <YStack padding="$8" alignItems="center">
            <Spinner size="large" />
            <Text color="$gray11">Loading events...</Text>
          </YStack>
        ) : !events || events.length === 0 ? (
          <Card padding="$6" alignItems="center">
            <Calendar size="$3" color="$gray8" />
            <Text fontSize="$6" fontWeight="600" color="$gray11">No events found</Text>
            <Text color="$gray11" textAlign="center">
              {searchTerm || statusFilter || typeFilter
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by creating your first event.'}
            </Text>
            <Button
              theme="blue"
              icon={Plus}
              onPress={() => router.push('/admin/events/create')}
              marginTop="$4"
            >
              Create Event
            </Button>
          </Card>
        ) : (
          <>
            {events.map((event) => (
              <Card key={event.id} padding="$4" borderWidth={1} borderColor="$borderColor">
                <XStack space="$4" alignItems="flex-start">
                  <YStack flex={1} space="$2">
                    <XStack space="$2" alignItems="center">
                      <Text fontSize="$6" fontWeight="600">{event.title}</Text>
                      <XStack space="$2">
                        <Text
                          fontSize="$2"
                          color={getEventTypeColor(event.type)}
                          backgroundColor={`${getEventTypeColor(event.type)}20`}
                          paddingHorizontal="$2"
                          paddingVertical="$1"
                          borderRadius="$2"
                          fontWeight="600"
                        >
                          {getEventTypeLabel(event.type)}
                        </Text>
                        <Text
                          fontSize="$2"
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
                    </XStack>
                    
                    <XStack space="$4" alignItems="center">
                      <XStack space="$1" alignItems="center">
                        <Calendar size="$0.75" color="$gray11" />
                        <Text fontSize="$3" color="$gray11">{getEventDate(event)}</Text>
                      </XStack>
                      
                      {event.type === 'study-weekend' && event.location && (
                        <XStack space="$1" alignItems="center">
                          <MapPin size="$0.75" color="$gray11" />
                          <Text fontSize="$3" color="$gray11">{event.location.name}</Text>
                        </XStack>
                      )}
                      
                      {event.type === 'study-weekend' && event.speakers && event.speakers.length > 0 && (
                        <XStack space="$1" alignItems="center">
                          <User size="$0.75" color="$gray11" />
                          <Text fontSize="$3" color="$gray11">{event.speakers.length} speakers</Text>
                        </XStack>
                      )}
                    </XStack>
                    
                    {event.description && (
                      <Text fontSize="$3" color="$gray11" numberOfLines={2}>
                        {event.description}
                      </Text>
                    )}
                  </YStack>
                  
                  <XStack space="$2">
                    <Button
                      size="$3"
                      variant="outlined"
                      icon={Eye}
                      onPress={() => router.push(`/events/${event.id}`)}
                    />
                    <Button
                      size="$3"
                      variant="outlined"
                      icon={Edit3}
                      onPress={() => router.push(`/admin/events/${event.id}/edit`)}
                    />
                    
                    {event.status === 'draft' && (
                      <Button
                        size="$3"
                        theme="blue"
                        onPress={() => handlePublish(event.id)}
                      >
                        Publish
                      </Button>
                    )}
                    
                    {event.status === 'published' && (
                      <Button
                        size="$3"
                        variant="outlined"
                        icon={Archive}
                        onPress={() => handleArchive(event.id)}
                      />
                    )}
                    
                    <Button
                      size="$3"
                      variant="outlined"
                      color="$red10"
                      icon={Trash2}
                      onPress={() => handleDelete(event.id)}
                    />
                  </XStack>
                </XStack>
              </Card>
            ))}
            
            {hasMore && (
              <XStack justifyContent="center" paddingVertical="$4">
                <Button
                  variant="outlined"
                  onPress={() => setPage(prev => prev + 1)}
                  disabled={loading}
                >
                  {loading ? <Spinner size="small" /> : 'Load More'}
                </Button>
              </XStack>
            )}
          </>
        )}
      </YStack>
    </YStack>
  )
}