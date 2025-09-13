'use client'

import React from 'react'
import { 
  YStack, 
  XStack, 
  Text, 
  Button, 
  Card, 
  Separator, 
  ScrollView,
  H1,
  H2,
  H3,
  Paragraph,
  useThemeName
} from 'tamagui'
import { 
  Event, 
  StudyWeekendEvent, 
  FuneralEvent, 
  WeddingEvent, 
  BaptismEvent, 
  GeneralEvent,
  isStudyWeekendEvent,
  isFuneralEvent,
  isWeddingEvent,
  isBaptismEvent,
  isGeneralEvent
} from '@my/app/types/events'
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Mail, 
  Phone, 
  ExternalLink,
  Download,
  Share2
} from '@tamagui/lucide-icons'
import { brandColors } from '../branding/brand-colors'

interface EventPageTemplateProps {
  event: Event
  showDraftBanner?: boolean
}

export function EventPageTemplate({ event, showDraftBanner = false }: EventPageTemplateProps) {
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDateTime = (date: Date | string) => {
    return `${formatDate(date)} at ${formatTime(date)}`
  }

  const renderEventHeader = () => (
    <YStack gap="$4" padding="$4">
      {showDraftBanner && (
        <Card backgroundColor="$orange2" borderColor="$orange6" padding="$3">
          <Text color="$orange11" fontWeight="600">
            🚧 Draft Event - Not yet published
          </Text>
        </Card>
      )}
      
      <YStack gap="$2">
        <H1 size="$9" fontWeight="700" color={colors.textPrimary}>
          {event.title}
        </H1>
        
        {event.description && (
          <Paragraph fontSize="$5" color={colors.textSecondary} lineHeight="$6">
            {event.description}
          </Paragraph>
        )}
      </YStack>
    </YStack>
  )

  const renderLocationInfo = (location: any, label: string = "Location") => {
    if (!location) return null
    
    // Build address lines, skipping empty fields
    const addressParts = []
    if (location.address?.trim()) addressParts.push(location.address.trim())
    
    const cityProvinceParts = []
    if (location.city?.trim()) cityProvinceParts.push(location.city.trim())
    if (location.province?.trim()) cityProvinceParts.push(location.province.trim())
    
    const cityProvinceText = cityProvinceParts.join(', ')
    if (cityProvinceText) addressParts.push(cityProvinceText)
    
    const countryText = location.country?.trim()
    if (countryText && countryText !== 'Canada') {
      addressParts.push(countryText)
    }
    
    return (
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <YStack gap="$3">
          <XStack alignItems="center" gap="$2">
            <MapPin size="$1" color={colors.primary} />
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
              {label}
            </Text>
          </XStack>
          <YStack gap="$1">
            {location.name?.trim() && (
              <Text fontSize="$4" color={colors.textPrimary}>{location.name.trim()}</Text>
            )}
            {addressParts.map((part, index) => (
              <Text key={index} fontSize="$3" color={colors.textSecondary}>
                {part}
              </Text>
            ))}
            {location.postalCode?.trim() && (
              <Text fontSize="$3" color={colors.textSecondary}>
                {location.postalCode.trim()}
              </Text>
            )}
            {location.directions?.trim() && (
              <Text fontSize="$3" color={colors.textSecondary} fontStyle="italic">
                {location.directions.trim()}
              </Text>
            )}
            {location.parkingInfo?.trim() && (
              <Text fontSize="$3" color={colors.textSecondary} fontStyle="italic">
                Parking: {location.parkingInfo.trim()}
              </Text>
            )}
          </YStack>
        </YStack>
      </Card>
    )
  }

  const renderSpeakers = (speakers: any[]) => (
    <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
      <YStack gap="$3">
        <XStack alignItems="center" gap="$2">
          <Users size="$1" color={colors.primary} />
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
            Speakers
          </Text>
        </XStack>
        <YStack gap="$2">
          {speakers.map((speaker, index) => (
            <XStack key={index} gap="$2" alignItems="center">
              <Text fontSize="$4" color={colors.textPrimary}>
                {speaker.firstName} {speaker.lastName}
              </Text>
              {speaker.ecclesia && (
                <Text fontSize="$3" color={colors.textSecondary}>
                  ({speaker.ecclesia})
                </Text>
              )}
            </XStack>
          ))}
        </YStack>
      </YStack>
    </Card>
  )

  const renderSchedule = (schedule: any[]) => (
    <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
      <YStack gap="$3">
        <XStack alignItems="center" gap="$2">
          <Clock size="$1" color={colors.primary} />
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
            Schedule
          </Text>
        </XStack>
        <YStack gap="$3">
          {schedule.map((item, index) => (
            <XStack key={index} gap="$4" alignItems="flex-start">
              <Text fontSize="$3" fontWeight="600" color={colors.primary} minWidth={80}>
                {formatTime(item.startTime)}
              </Text>
              <YStack flex={1} gap="$1">
                <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
                  {item.title}
                </Text>
                {item.description && (
                  <Text fontSize="$3" color={colors.textSecondary}>
                    {item.description}
                  </Text>
                )}
                {item.speakers && item.speakers.length > 0 && (
                  <Text fontSize="$3" color={colors.textSecondary}>
                    Speaker: {item.speakers.map(s => `${s.firstName} ${s.lastName}`).join(', ')}
                  </Text>
                )}
              </YStack>
            </XStack>
          ))}
        </YStack>
      </YStack>
    </Card>
  )

  const renderRegistration = (registration: any) => (
    <Card padding="$4" backgroundColor={colors.primary + '10'} borderColor={colors.primary}>
      <YStack gap="$3">
        <H3 size="$6" color={colors.primary}>Registration Required</H3>
        
        <YStack gap="$2">
          {registration.deadline && (
            <XStack alignItems="center" gap="$2">
              <Calendar size="$1" color={colors.textSecondary} />
              <Text fontSize="$4" color={colors.textPrimary}>
                Deadline: {formatDate(registration.deadline)}
              </Text>
            </XStack>
          )}
          
          {registration.fee && (
            <XStack alignItems="center" gap="$2">
              <Text fontSize="$4" color={colors.textPrimary}>
                Fee: ${registration.fee} {registration.currency || 'CAD'}
              </Text>
            </XStack>
          )}
          
          {registration.maxAttendees && (
            <Text fontSize="$3" color={colors.textSecondary}>
              Capacity: {registration.currentAttendees || 0} / {registration.maxAttendees} attendees
            </Text>
          )}
        </YStack>

        <YStack gap="$2">
          {registration.registrationUrl && (
            <Button
              backgroundColor={colors.primary}
              color={colors.primaryForeground}
              icon={<ExternalLink size="$1" />}
              onPress={() => window.open(registration.registrationUrl, '_blank')}
            >
              Register Now
            </Button>
          )}
          
          {(registration.contactEmail || registration.contactPhone) && (
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600" color={colors.textPrimary}>
                Registration Contact:
              </Text>
              {registration.contactEmail && (
                <XStack alignItems="center" gap="$2">
                  <Mail size="$0.75" color={colors.textSecondary} />
                  <Text fontSize="$3" color={colors.textSecondary}>
                    {registration.contactEmail}
                  </Text>
                </XStack>
              )}
              {registration.contactPhone && (
                <XStack alignItems="center" gap="$2">
                  <Phone size="$0.75" color={colors.textSecondary} />
                  <Text fontSize="$3" color={colors.textSecondary}>
                    {registration.contactPhone}
                  </Text>
                </XStack>
              )}
            </YStack>
          )}
        </YStack>
        
        {registration.notes && (
          <Text fontSize="$3" color={colors.textSecondary} fontStyle="italic">
            {registration.notes}
          </Text>
        )}
      </YStack>
    </Card>
  )

  const renderDocuments = (documents: any[]) => {
    if (!documents || documents.length === 0) return null
    
    return (
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <YStack gap="$3">
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
            Documents & Resources
          </Text>
          <YStack gap="$2">
            {documents.map((doc, index) => (
              <XStack 
                key={index} 
                alignItems="center" 
                gap="$2" 
                padding="$2"
                backgroundColor={colors.background}
                borderRadius="$2"
                pressStyle={{ opacity: 0.8 }}
                onPress={() => window.open(doc.fileUrl, '_blank')}
                cursor="pointer"
              >
                <Download size="$1" color={colors.primary} />
                <YStack flex={1}>
                  <Text fontSize="$3" fontWeight="500" color={colors.textPrimary}>
                    {doc.originalName || doc.fileName}
                  </Text>
                  {doc.description && (
                    <Text fontSize="$2" color={colors.textSecondary}>
                      {doc.description}
                    </Text>
                  )}
                </YStack>
                <ExternalLink size="$0.75" color={colors.textSecondary} />
              </XStack>
            ))}
          </YStack>
        </YStack>
      </Card>
    )
  }

  const renderStudyWeekendEvent = (event: StudyWeekendEvent) => (
    <YStack gap="$4">
      {/* Date Range */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <XStack alignItems="center" gap="$2" marginBottom="$2">
          <Calendar size="$1" color={colors.primary} />
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
            Event Dates
          </Text>
        </XStack>
        <Text fontSize="$4" color={colors.textPrimary}>
          {formatDate(event.dateRange.start)} - {formatDate(event.dateRange.end)}
        </Text>
      </Card>

      {/* Theme */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
          Theme
        </Text>
        <Text fontSize="$4" color={colors.textPrimary}>
          {event.theme}
        </Text>
      </Card>

      {/* Location */}
      {renderLocationInfo(event.location)}

      {/* Speakers */}
      {event.speakers && event.speakers.length > 0 && renderSpeakers(event.speakers)}

      {/* Schedule */}
      {event.schedule && event.schedule.length > 0 && renderSchedule(event.schedule)}

      {/* Registration */}
      {event.registration?.required && renderRegistration(event.registration)}

      {/* Accommodation */}
      {event.accommodation?.available && (
        <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
            Accommodation
          </Text>
          <Text fontSize="$4" color={colors.textPrimary}>
            {event.accommodation.details || 'Accommodation is available.'}
          </Text>
          {event.accommodation.contactInfo && (
            <Text fontSize="$3" color={colors.textSecondary} marginTop="$2">
              Contact: {event.accommodation.contactInfo}
            </Text>
          )}
        </Card>
      )}

      {/* Documents */}
      {renderDocuments(event.documents)}
    </YStack>
  )

  const renderFuneralEvent = (event: FuneralEvent) => (
    <YStack gap="$4">
      {/* Service Date */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <XStack alignItems="center" gap="$2" marginBottom="$2">
          <Calendar size="$1" color={colors.primary} />
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
            Service Date
          </Text>
        </XStack>
        <Text fontSize="$4" color={colors.textPrimary}>
          {formatDateTime(event.serviceDate)}
        </Text>
      </Card>

      {/* Deceased Information */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
          In Memory Of
        </Text>
        <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
          {event.deceased.firstName} {event.deceased.lastName}
        </Text>
        {event.deceased.age && (
          <Text fontSize="$4" color={colors.textSecondary}>
            Age {event.deceased.age}
          </Text>
        )}
        {event.deceased.obituary && (
          <Text fontSize="$4" color={colors.textPrimary} marginTop="$3">
            {event.deceased.obituary}
          </Text>
        )}
      </Card>

      {/* Locations */}
      {event.locations.viewing && renderLocationInfo(event.locations.viewing, "Viewing")}
      {renderLocationInfo(event.locations.service, "Service")}
      {event.locations.burial && renderLocationInfo(event.locations.burial, "Burial")}

      {/* Documents */}
      {renderDocuments(event.documents)}
    </YStack>
  )

  const renderWeddingEvent = (event: WeddingEvent) => (
    <YStack gap="$4">
      {/* Ceremony Date */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <XStack alignItems="center" gap="$2" marginBottom="$2">
          <Calendar size="$1" color={colors.primary} />
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
            Ceremony Date
          </Text>
        </XStack>
        <Text fontSize="$4" color={colors.textPrimary}>
          {formatDateTime(event.ceremonyDate)}
        </Text>
      </Card>

      {/* Couple */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
          Celebrating the Union Of
        </Text>
        <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
          {event.couple.bride.firstName} {event.couple.bride.lastName}
        </Text>
        <Text fontSize="$4" color={colors.textSecondary} textAlign="center" marginVertical="$2">
          and
        </Text>
        <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
          {event.couple.groom.firstName} {event.couple.groom.lastName}
        </Text>
      </Card>

      {/* Ceremony Location */}
      {renderLocationInfo(event.ceremonyLocation, "Ceremony")}

      {/* Reception */}
      {event.reception && (
        <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
            Reception
          </Text>
          {event.reception.date && (
            <Text fontSize="$4" color={colors.textPrimary}>
              {formatDateTime(event.reception.date)}
            </Text>
          )}
          {event.reception.location && renderLocationInfo(event.reception.location, "Reception Location")}
          {event.reception.details && (
            <Text fontSize="$4" color={colors.textPrimary} marginTop="$2">
              {event.reception.details}
            </Text>
          )}
        </Card>
      )}

      {/* Documents */}
      {renderDocuments(event.documents)}
    </YStack>
  )

  const renderBaptismEvent = (event: BaptismEvent) => (
    <YStack gap="$4">
      {/* Baptism Date */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <XStack alignItems="center" gap="$2" marginBottom="$2">
          <Calendar size="$1" color={colors.primary} />
          <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
            Baptism Date
          </Text>
        </XStack>
        <Text fontSize="$4" color={colors.textPrimary}>
          {formatDateTime(event.baptismDate)}
        </Text>
      </Card>

      {/* Candidate */}
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
          Candidate for Baptism
        </Text>
        <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
          {event.candidate.firstName} {event.candidate.lastName}
        </Text>
        {event.candidate.testimony && (
          <YStack marginTop="$3">
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary} marginBottom="$2">
              Testimony
            </Text>
            <Text fontSize="$4" color={colors.textPrimary}>
              {event.candidate.testimony}
            </Text>
          </YStack>
        )}
      </Card>

      {/* Location */}
      {renderLocationInfo(event.location)}

      {/* Zoom Link */}
      {event.zoomLink && (
        <Card padding="$4" backgroundColor={colors.primary + '10'} borderColor={colors.primary}>
          <YStack gap="$2">
            <Text fontSize="$4" fontWeight="600" color={colors.primary}>
              Join via Zoom
            </Text>
            <Button
              backgroundColor={colors.primary}
              color={colors.primaryForeground}
              icon={<ExternalLink size="$1" />}
              onPress={() => window.open(event.zoomLink, '_blank')}
            >
              Join Zoom Meeting
            </Button>
          </YStack>
        </Card>
      )}

      {/* Documents */}
      {renderDocuments(event.documents)}
    </YStack>
  )

  const renderGeneralEvent = (event: GeneralEvent) => (
    <YStack gap="$4">
      {/* Event Dates */}
      {(event.startDate || event.endDate) && (
        <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
          <XStack alignItems="center" gap="$2" marginBottom="$2">
            <Calendar size="$1" color={colors.primary} />
            <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
              Event Date{event.startDate && event.endDate ? 's' : ''}
            </Text>
          </XStack>
          {event.startDate && event.endDate ? (
            <Text fontSize="$4" color={colors.textPrimary}>
              {formatDate(event.startDate)} - {formatDate(event.endDate)}
            </Text>
          ) : event.startDate ? (
            <Text fontSize="$4" color={colors.textPrimary}>
              {formatDateTime(event.startDate)}
            </Text>
          ) : event.endDate ? (
            <Text fontSize="$4" color={colors.textPrimary}>
              Until {formatDateTime(event.endDate)}
            </Text>
          ) : null}
        </Card>
      )}

      {/* Location */}
      {event.location && renderLocationInfo(event.location)}

      {/* Speakers */}
      {event.speakers && event.speakers.length > 0 && renderSpeakers(event.speakers)}

      {/* Schedule */}
      {event.schedule && event.schedule.length > 0 && renderSchedule(event.schedule)}

      {/* Registration */}
      {event.registration?.required && renderRegistration(event.registration)}

      {/* Documents */}
      {renderDocuments(event.documents)}
    </YStack>
  )

  const renderEventContent = () => {
    if (isStudyWeekendEvent(event)) {
      return renderStudyWeekendEvent(event)
    } else if (isFuneralEvent(event)) {
      return renderFuneralEvent(event)
    } else if (isWeddingEvent(event)) {
      return renderWeddingEvent(event)
    } else if (isBaptismEvent(event)) {
      return renderBaptismEvent(event)
    } else if (isGeneralEvent(event)) {
      return renderGeneralEvent(event)
    }
    
    return (
      <Card padding="$4" backgroundColor={colors.backgroundSecondary}>
        <Text color={colors.textSecondary}>
          Event details are being prepared...
        </Text>
      </Card>
    )
  }

  const renderActionButtons = () => (
    <XStack gap="$2" padding="$4" justifyContent="center">
      <Button
        variant="outlined"
        icon={<Share2 size="$1" />}
        onPress={() => {
          if (navigator.share) {
            navigator.share({
              title: event.title,
              text: event.description || `Join us for ${event.title}`,
              url: window.location.href
            })
          } else {
            navigator.clipboard.writeText(window.location.href)
            // TODO: Show toast notification
          }
        }}
      >
        Share Event
      </Button>
    </XStack>
  )

  return (
    <ScrollView flex={1}>
      <YStack maxWidth={900} alignSelf="center" width="100%">
        {renderEventHeader()}
        <Separator marginVertical="$2" />
        {renderEventContent()}
        {renderActionButtons()}
      </YStack>
    </ScrollView>
  )
}