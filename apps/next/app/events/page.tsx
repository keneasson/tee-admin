'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, XStack, Text, Button, Card, Spinner, Input } from '@my/ui'
import { Calendar, MapPin, User, Search, Filter, Eye, Clock, ExternalLink } from '@tamagui/lucide-icons'
import { Event, EventListResponse, EventType } from '@my/app/types/events'

export default function EventsPage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<EventType | ''>('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '12',
        published: 'true',
        status: 'published'
      })
      
      if (searchTerm) params.append('search', searchTerm)
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
  }, [page, searchTerm, typeFilter])

  // Early return after all hooks have been called
  if (!isHydrated) {
    return (
      <YStack padding="$4" alignItems="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setPage(1)
  }

  const handleTypeFilter = (type: EventType | '') => {
    setTypeFilter(type)
    setPage(1)
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

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getEventDate = (event: Event) => {
    if (event.type === 'study-weekend') {
      const start = formatDate(event.dateRange.start)
      const end = formatDate(event.dateRange.end)
      return start === end ? start : `${start} - ${end}`
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
    return 'Date TBD'
  }

  const getEventTime = (event: Event) => {
    if (event.type === 'study-weekend') {
      return formatTime(event.dateRange.start)
    }
    if (event.type === 'funeral') {
      return formatTime(event.serviceDate)
    }
    if (event.type === 'wedding') {
      return formatTime(event.ceremonyDate)
    }
    if (event.type === 'general' && event.startDate) {
      return formatTime(event.startDate)
    }
    return null
  }

  const getEventLocation = (event: Event) => {
    if (event.type === 'study-weekend') {
      return event.location?.name
    }
    if (event.type === 'funeral') {
      return event.locations?.service?.name
    }
    if (event.type === 'wedding') {
      return event.ceremonyLocation?.name
    }
    if (event.type === 'general') {
      return event.location?.name
    }
    return null
  }

  const getSpeakerCount = (event: Event) => {
    if (event.type === 'study-weekend') {
      return event.speakers?.length || 0
    }
    if (event.type === 'funeral') {
      return event.serviceDetails?.speakers?.length || 0
    }
    if (event.type === 'wedding') {
      return event.serviceDetails?.speakers?.length || 0
    }
    if (event.type === 'general') {
      return event.speakers?.length || 0
    }
    return 0
  }

  const isNewEvent = (event: Event) => {
    if (!event.publishDate) return false
    const publishDate = new Date(event.publishDate)
    const fiveDaysAgo = new Date()
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    return publishDate > fiveDaysAgo
  }

  const isUpcoming = (event: Event) => {
    const now = new Date()
    if (event.type === 'study-weekend') {
      return new Date(event.dateRange.start) > now
    }
    if (event.type === 'funeral') {
      return new Date(event.serviceDate) > now
    }
    if (event.type === 'wedding') {
      return new Date(event.ceremonyDate) > now
    }
    if (event.type === 'general' && event.startDate) {
      return new Date(event.startDate) > now
    }
    return true
  }

  const upcomingEvents = (events || []).filter(isUpcoming)
  const pastEvents = (events || []).filter(event => !isUpcoming(event))

  return (
    <YStack padding="$4" space="$4" maxWidth={1200} alignSelf="center">
      {/* Header */}
      <YStack space="$2">
        <Text fontSize="$8" fontWeight="bold">Ecclesial Events</Text>
        <Text color="$gray11" fontSize="$5">
          Stay updated with upcoming study weekends, services, and community events.
        </Text>
      </YStack>

      {/* Search and Filters */}
      <Card padding="$4">
        <YStack space="$3">
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
              <Input placeholder="All Types" />
            </YStack>
          </XStack>
        </YStack>
      </Card>

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
            {searchTerm || typeFilter
              ? 'Try adjusting your search terms or filters.'
              : 'Check back soon for upcoming events.'}
          </Text>
        </Card>
      ) : (
        <YStack space="$6">
          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <YStack space="$4">
              <Text fontSize="$7" fontWeight="bold" color="$blue11">Upcoming Events</Text>
              <YStack space="$3">
                {upcomingEvents.map((event) => (
                  <Card
                    key={event.id}
                    padding="$4"
                    borderWidth={1}
                    borderColor="$borderColor"
                    pressStyle={{ scale: 0.98 }}
                    cursor="pointer"
                    onPress={() => router.push(`/events/${event.id}`)}
                  >
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
                            {isNewEvent(event) && (
                              <Text
                                fontSize="$2"
                                color="$green10"
                                backgroundColor="$green2"
                                paddingHorizontal="$2"
                                paddingVertical="$1"
                                borderRadius="$2"
                                fontWeight="600"
                              >
                                NEW
                              </Text>
                            )}
                            {event.featured && (
                              <Text
                                fontSize="$2"
                                color="$orange10"
                                backgroundColor="$orange2"
                                paddingHorizontal="$2"
                                paddingVertical="$1"
                                borderRadius="$2"
                                fontWeight="600"
                              >
                                FEATURED
                              </Text>
                            )}
                          </XStack>
                        </XStack>
                        
                        <XStack space="$4" alignItems="center" flexWrap="wrap">
                          <XStack space="$1" alignItems="center">
                            <Calendar size="$0.75" color="$gray11" />
                            <Text fontSize="$3" color="$gray11">{getEventDate(event)}</Text>
                            {getEventTime(event) && (
                              <>
                                <Clock size="$0.75" color="$gray11" />
                                <Text fontSize="$3" color="$gray11">{getEventTime(event)}</Text>
                              </>
                            )}
                          </XStack>
                          
                          {getEventLocation(event) && (
                            <XStack space="$1" alignItems="center">
                              <MapPin size="$0.75" color="$gray11" />
                              <Text fontSize="$3" color="$gray11">{getEventLocation(event)}</Text>
                            </XStack>
                          )}
                          
                          {getSpeakerCount(event) > 0 && (
                            <XStack space="$1" alignItems="center">
                              <User size="$0.75" color="$gray11" />
                              <Text fontSize="$3" color="$gray11">
                                {getSpeakerCount(event)} speaker{getSpeakerCount(event) !== 1 ? 's' : ''}
                              </Text>
                            </XStack>
                          )}
                        </XStack>
                        
                        {event.description && (
                          <Text fontSize="$3" color="$gray11" numberOfLines={2} lineHeight="$1">
                            {event.description}
                          </Text>
                        )}
                      </YStack>
                      
                      <Button
                        size="$3"
                        variant="outlined"
                        icon={Eye}
                        onPress={() => router.push(`/events/${event.id}`)}
                      >
                        View Details
                      </Button>
                    </XStack>
                  </Card>
                ))}
              </YStack>
            </YStack>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <YStack space="$4">
              <Text fontSize="$7" fontWeight="bold" color="$gray11">Past Events</Text>
              <YStack space="$3">
                {pastEvents.map((event) => (
                  <Card
                    key={event.id}
                    padding="$4"
                    borderWidth={1}
                    borderColor="$borderColor"
                    opacity={0.8}
                    pressStyle={{ scale: 0.98 }}
                    cursor="pointer"
                    onPress={() => router.push(`/events/${event.id}`)}
                  >
                    <XStack space="$4" alignItems="flex-start">
                      <YStack flex={1} space="$2">
                        <XStack space="$2" alignItems="center">
                          <Text fontSize="$5" fontWeight="600" color="$gray11">{event.title}</Text>
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
                        </XStack>
                        
                        <XStack space="$4" alignItems="center">
                          <XStack space="$1" alignItems="center">
                            <Calendar size="$0.75" color="$gray11" />
                            <Text fontSize="$3" color="$gray11">{getEventDate(event)}</Text>
                          </XStack>
                          
                          {getEventLocation(event) && (
                            <XStack space="$1" alignItems="center">
                              <MapPin size="$0.75" color="$gray11" />
                              <Text fontSize="$3" color="$gray11">{getEventLocation(event)}</Text>
                            </XStack>
                          )}
                        </XStack>
                      </YStack>
                      
                      <Button
                        size="$3"
                        variant="outlined"
                        icon={Eye}
                        onPress={() => router.push(`/events/${event.id}`)}
                      >
                        View
                      </Button>
                    </XStack>
                  </Card>
                ))}
              </YStack>
            </YStack>
          )}

          {/* Load More */}
          {hasMore && (
            <XStack justifyContent="center" paddingVertical="$4">
              <Button
                variant="outlined"
                onPress={() => setPage(prev => prev + 1)}
                disabled={loading}
              >
                {loading ? <Spinner size="small" /> : 'Load More Events'}
              </Button>
            </XStack>
          )}
        </YStack>
      )}
    </YStack>
  )
}
