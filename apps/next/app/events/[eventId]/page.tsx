'use client'

import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { YStack, XStack, Text, Button, Card, Spinner, Separator } from '@my/ui'
import { ArrowLeft, Calendar, MapPin, User, Clock, Phone, Mail, FileText, Download, ExternalLink } from '@tamagui/lucide-icons'
import { Event } from '@my/app/types/events'

export default function EventPage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  const params = useParams()
  const eventId = params?.eventId as string
  
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/events/${eventId}`)
        if (response.ok) {
          const eventData = await response.json()
          setEvent(eventData)
        } else if (response.status === 404) {
          setError('Event not found')
        } else {
          setError('Failed to load event')
        }
      } catch (error) {
        console.error('Error fetching event:', error)
        setError('Failed to load event')
      } finally {
        setLoading(false)
      }
    }

    if (eventId) {
      fetchEvent()
    }
  }, [eventId])

  // Early return after all hooks have been called
  if (!isHydrated) {
    return (
      <YStack padding="$4" alignItems="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  if (loading) {
    return (
      <YStack padding="$4" alignItems="center">
        <Spinner size="large" />
        <Text color="$gray11">Loading event...</Text>
      </YStack>
    )
  }

  if (error) {
    return (
      <YStack padding="$4" alignItems="center" space="$3">
        <Text fontSize="$6" fontWeight="600" color="$red11">{error}</Text>
        <Button
          onPress={() => router.back()}
          variant="outlined"
          icon={ArrowLeft}
        >
          Go Back
        </Button>
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

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'study-weekend': return '$blue10'
      case 'funeral': return '$gray10'
      case 'wedding': return '$pink10'
      case 'general': return '$green10'
      default: return '$gray10'
    }
  }

  const getEventTypeLabel = (type: string) => {
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

  const formatDateTime = (date: Date | string) => {
    return `${formatDate(date)} at ${formatTime(date)}`
  }

  const renderStudyWeekendEvent = (event: any) => (
    <YStack space="$4">
      {/* Date Range */}
      <Card padding="$4">
        <YStack space="$3">
          <XStack space="$2" alignItems="center">
            <Calendar size="$1" color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Event Dates</Text>
          </XStack>
          <Text fontSize="$4">
            {formatDate(event.dateRange.start)} - {formatDate(event.dateRange.end)}
          </Text>
        </YStack>
      </Card>

      {/* Theme */}
      {event.theme && (
        <Card padding="$4">
          <YStack space="$3">
            <Text fontSize="$5" fontWeight="600">Theme</Text>
            <Text fontSize="$4">{event.theme}</Text>
          </YStack>
        </Card>
      )}

      {/* Location */}
      {event.location && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <MapPin size="$1" color="$blue10" />
              <Text fontSize="$5" fontWeight="600">Location</Text>
            </XStack>
            <YStack space="$2">
              <Text fontSize="$4" fontWeight="600">{event.location.name}</Text>
              <Text fontSize="$3" color="$gray11">
                {event.location.address}, {event.location.city}, {event.location.province}
                {event.location.postalCode && ` ${event.location.postalCode}`}
              </Text>
              {event.location.directions && (
                <Text fontSize="$3" color="$gray11">{event.location.directions}</Text>
              )}
              {event.location.parkingInfo && (
                <Text fontSize="$3" color="$gray11">
                  <Text fontWeight="600">Parking:</Text> {event.location.parkingInfo}
                </Text>
              )}
            </YStack>
          </YStack>
        </Card>
      )}

      {/* Speakers */}
      {event.speakers && event.speakers.length > 0 && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <User size="$1" color="$blue10" />
              <Text fontSize="$5" fontWeight="600">Speakers</Text>
            </XStack>
            <YStack space="$3">
              {event.speakers.map((speaker: any, index: number) => (
                <YStack key={index} space="$2">
                  <Text fontSize="$4" fontWeight="600">
                    {speaker.title} {speaker.firstName} {speaker.lastName}
                  </Text>
                  {speaker.role && (
                    <Text fontSize="$3" color="$blue11">{speaker.role}</Text>
                  )}
                  {speaker.bio && (
                    <Text fontSize="$3" color="$gray11">{speaker.bio}</Text>
                  )}
                </YStack>
              ))}
            </YStack>
          </YStack>
        </Card>
      )}

      {/* Schedule */}
      {event.schedule && event.schedule.length > 0 && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <Clock size="$1" color="$blue10" />
              <Text fontSize="$5" fontWeight="600">Schedule</Text>
            </XStack>
            <YStack space="$3">
              {event.schedule.map((item: any, index: number) => (
                <YStack key={index} space="$2">
                  <XStack space="$2" alignItems="center">
                    <Text fontSize="$4" fontWeight="600">{item.title}</Text>
                    <Text fontSize="$3" color="$gray11">
                      {formatTime(item.startTime)}
                      {item.endTime && ` - ${formatTime(item.endTime)}`}
                    </Text>
                  </XStack>
                  {item.description && (
                    <Text fontSize="$3" color="$gray11">{item.description}</Text>
                  )}
                </YStack>
              ))}
            </YStack>
          </YStack>
        </Card>
      )}

      {/* Registration */}
      {event.registration && event.registration.required && (
        <Card padding="$4" borderColor="$blue8">
          <YStack space="$3">
            <Text fontSize="$5" fontWeight="600" color="$blue11">Registration Required</Text>
            <YStack space="$2">
              {event.registration.deadline && (
                <Text fontSize="$3">
                  <Text fontWeight="600">Deadline:</Text> {formatDateTime(event.registration.deadline)}
                </Text>
              )}
              {event.registration.fee && (
                <Text fontSize="$3">
                  <Text fontWeight="600">Fee:</Text> ${event.registration.fee}
                </Text>
              )}
              {event.registration.contactEmail && (
                <XStack space="$2" alignItems="center">
                  <Mail size="$0.75" />
                  <Text fontSize="$3">{event.registration.contactEmail}</Text>
                </XStack>
              )}
              {event.registration.contactPhone && (
                <XStack space="$2" alignItems="center">
                  <Phone size="$0.75" />
                  <Text fontSize="$3">{event.registration.contactPhone}</Text>
                </XStack>
              )}
              {event.registration.registrationUrl && (
                <Button
                  size="$3"
                  theme="blue"
                  icon={ExternalLink}
                  onPress={() => window.open(event.registration.registrationUrl, '_blank')}
                >
                  Register Online
                </Button>
              )}
            </YStack>
          </YStack>
        </Card>
      )}
    </YStack>
  )

  const renderFuneralEvent = (event: any) => (
    <YStack space="$4">
      {/* Deceased Information */}
      <Card padding="$4">
        <YStack space="$3">
          <Text fontSize="$5" fontWeight="600">In Memory of</Text>
          <Text fontSize="$6" fontWeight="600">
            {event.deceased.firstName} {event.deceased.lastName}
          </Text>
          {event.deceased.dateOfBirth && event.deceased.dateOfDeath && (
            <Text fontSize="$4" color="$gray11">
              {formatDate(event.deceased.dateOfBirth)} - {formatDate(event.deceased.dateOfDeath)}
            </Text>
          )}
          {event.deceased.obituary && (
            <Text fontSize="$4" color="$gray11" lineHeight="$2">
              {event.deceased.obituary}
            </Text>
          )}
        </YStack>
      </Card>

      {/* Service Details */}
      <Card padding="$4">
        <YStack space="$3">
          <XStack space="$2" alignItems="center">
            <Calendar size="$1" color="$gray10" />
            <Text fontSize="$5" fontWeight="600">Service Information</Text>
          </XStack>
          <YStack space="$2">
            <Text fontSize="$4">
              <Text fontWeight="600">Service:</Text> {formatDateTime(event.serviceDate)}
            </Text>
            {event.viewingDate && (
              <Text fontSize="$4">
                <Text fontWeight="600">Viewing:</Text> {formatDateTime(event.viewingDate)}
              </Text>
            )}
          </YStack>
        </YStack>
      </Card>

      {/* Locations */}
      {event.locations && (
        <YStack space="$3">
          {event.locations.service && (
            <Card padding="$4">
              <YStack space="$3">
                <XStack space="$2" alignItems="center">
                  <MapPin size="$1" color="$gray10" />
                  <Text fontSize="$5" fontWeight="600">Service Location</Text>
                </XStack>
                <YStack space="$2">
                  <Text fontSize="$4" fontWeight="600">{event.locations.service.name}</Text>
                  <Text fontSize="$3" color="$gray11">
                    {event.locations.service.address}, {event.locations.service.city}, {event.locations.service.province}
                  </Text>
                </YStack>
              </YStack>
            </Card>
          )}
          
          {event.locations.viewing && (
            <Card padding="$4">
              <YStack space="$3">
                <Text fontSize="$5" fontWeight="600">Viewing Location</Text>
                <YStack space="$2">
                  <Text fontSize="$4" fontWeight="600">{event.locations.viewing.name}</Text>
                  <Text fontSize="$3" color="$gray11">
                    {event.locations.viewing.address}, {event.locations.viewing.city}, {event.locations.viewing.province}
                  </Text>
                </YStack>
              </YStack>
            </Card>
          )}
        </YStack>
      )}
    </YStack>
  )

  const renderWeddingEvent = (event: any) => (
    <YStack space="$4">
      {/* Couple Information */}
      <Card padding="$4">
        <YStack space="$3">
          <Text fontSize="$5" fontWeight="600">Celebrating the Marriage of</Text>
          <Text fontSize="$6" fontWeight="600">
            {event.couple.bride.firstName} {event.couple.bride.lastName}
          </Text>
          <Text fontSize="$4" color="$gray11">and</Text>
          <Text fontSize="$6" fontWeight="600">
            {event.couple.groom.firstName} {event.couple.groom.lastName}
          </Text>
        </YStack>
      </Card>

      {/* Ceremony Details */}
      <Card padding="$4">
        <YStack space="$3">
          <XStack space="$2" alignItems="center">
            <Calendar size="$1" color="$pink10" />
            <Text fontSize="$5" fontWeight="600">Ceremony</Text>
          </XStack>
          <Text fontSize="$4">
            {formatDateTime(event.ceremonyDate)}
          </Text>
        </YStack>
      </Card>

      {/* Ceremony Location */}
      {event.ceremonyLocation && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <MapPin size="$1" color="$pink10" />
              <Text fontSize="$5" fontWeight="600">Ceremony Location</Text>
            </XStack>
            <YStack space="$2">
              <Text fontSize="$4" fontWeight="600">{event.ceremonyLocation.name}</Text>
              <Text fontSize="$3" color="$gray11">
                {event.ceremonyLocation.address}, {event.ceremonyLocation.city}, {event.ceremonyLocation.province}
              </Text>
            </YStack>
          </YStack>
        </Card>
      )}

      {/* Reception */}
      {event.reception && (
        <Card padding="$4">
          <YStack space="$3">
            <Text fontSize="$5" fontWeight="600">Reception</Text>
            <YStack space="$2">
              {event.reception.date && (
                <Text fontSize="$4">
                  <Text fontWeight="600">Date:</Text> {formatDateTime(event.reception.date)}
                </Text>
              )}
              {event.reception.location && (
                <YStack space="$1">
                  <Text fontSize="$4" fontWeight="600">{event.reception.location.name}</Text>
                  <Text fontSize="$3" color="$gray11">
                    {event.reception.location.address}, {event.reception.location.city}
                  </Text>
                </YStack>
              )}
              {event.reception.details && (
                <Text fontSize="$3" color="$gray11">{event.reception.details}</Text>
              )}
            </YStack>
          </YStack>
        </Card>
      )}
    </YStack>
  )

  const renderGeneralEvent = (event: any) => (
    <YStack space="$4">
      {/* Date/Time */}
      <Card padding="$4">
        <YStack space="$3">
          <XStack space="$2" alignItems="center">
            <Calendar size="$1" color="$green10" />
            <Text fontSize="$5" fontWeight="600">Event Date</Text>
          </XStack>
          <YStack space="$2">
            {event.startDate && (
              <Text fontSize="$4">
                <Text fontWeight="600">Start:</Text> {formatDateTime(event.startDate)}
              </Text>
            )}
            {event.endDate && (
              <Text fontSize="$4">
                <Text fontWeight="600">End:</Text> {formatDateTime(event.endDate)}
              </Text>
            )}
          </YStack>
        </YStack>
      </Card>

      {/* Location */}
      {event.location && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <MapPin size="$1" color="$green10" />
              <Text fontSize="$5" fontWeight="600">Location</Text>
            </XStack>
            <YStack space="$2">
              <Text fontSize="$4" fontWeight="600">{event.location.name}</Text>
              <Text fontSize="$3" color="$gray11">
                {event.location.address}, {event.location.city}, {event.location.province}
              </Text>
            </YStack>
          </YStack>
        </Card>
      )}

      {/* Speakers */}
      {event.speakers && event.speakers.length > 0 && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <User size="$1" color="$green10" />
              <Text fontSize="$5" fontWeight="600">Speakers</Text>
            </XStack>
            <YStack space="$2">
              {event.speakers.map((speaker: any, index: number) => (
                <Text key={index} fontSize="$4">
                  {speaker.title} {speaker.firstName} {speaker.lastName}
                  {speaker.role ? ` - ${speaker.role}` : ''}
                </Text>
              ))}
            </YStack>
          </YStack>
        </Card>
      )}
    </YStack>
  )

  const renderEventContent = () => {
    switch (event.type) {
      case 'study-weekend':
        return renderStudyWeekendEvent(event)
      case 'funeral':
        return renderFuneralEvent(event)
      case 'wedding':
        return renderWeddingEvent(event)
      case 'general':
        return renderGeneralEvent(event)
      default:
        return null
    }
  }

  return (
    <YStack padding="$4" space="$4" maxWidth={1000} alignSelf="center">
      {/* Header */}
      <YStack space="$3">
        <XStack space="$3" alignItems="center">
          <Button
            size="$3"
            variant="outlined"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
          <YStack flex={1}>
            <XStack space="$2" alignItems="center">
              <Text fontSize="$8" fontWeight="bold">{event.title}</Text>
              <Text
                fontSize="$3"
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
          </YStack>
        </XStack>
      </YStack>

      {/* Description */}
      {event.description && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <FileText size="$1" color="$gray10" />
              <Text fontSize="$5" fontWeight="600">Description</Text>
            </XStack>
            <Text fontSize="$4" lineHeight="$2" color="$gray11">
              {event.description}
            </Text>
          </YStack>
        </Card>
      )}

      {/* Event-specific content */}
      {renderEventContent()}

      {/* Documents */}
      {event.documents && event.documents.length > 0 && (
        <Card padding="$4">
          <YStack space="$3">
            <XStack space="$2" alignItems="center">
              <FileText size="$1" color="$gray10" />
              <Text fontSize="$5" fontWeight="600">Documents</Text>
            </XStack>
            <YStack space="$2">
              {event.documents.map((doc: any, index: number) => (
                <XStack key={index} space="$2" alignItems="center">
                  <Download size="$0.75" color="$blue10" />
                  <Text fontSize="$4" color="$blue11" textDecorationLine="underline">
                    {doc.originalName}
                  </Text>
                </XStack>
              ))}
            </YStack>
          </YStack>
        </Card>
      )}
    </YStack>
  )
}
