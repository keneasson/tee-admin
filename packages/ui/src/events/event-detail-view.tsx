'use client'

import { YStack, XStack, Text, H2, H4, Separator, Square, Card, Button, Image } from 'tamagui'
import { Download, ExternalLink, Lock, Gem } from '@tamagui/lucide-icons'
import { Event } from '@my/app/types/events'
import {
  formatDate,
  formatDateRange,
  formatTimeRange,
  getEventTypeDisplayName,
  getEventTypeColor,
  formatLocation,
  formatAddress,
} from './event-utils'

interface EventDetailViewProps {
  event: Partial<Event>
  showAdminInfo?: boolean
  /** User role passed from platform-specific auth (Next.js or Expo) */
  userRole?: string
  /** Whether user is member or higher, passed from platform-specific auth */
  isMemberOrHigher?: boolean
  /** Whether auth is loading */
  isAuthLoading?: boolean
}

/**
 * Reusable Event Detail View component
 * Used in: Event detail pages, Preview modal, Admin views
 */
export function EventDetailView({
  event,
  showAdminInfo = false,
  userRole,
  isMemberOrHigher = false,
  isAuthLoading = false
}: EventDetailViewProps) {
  // Check access for members-only events (member, admin, or owner)
  const hasAccess = !event.membersOnly || isMemberOrHigher

  // Format date for display
  const getFormattedDateRange = () => {
    // Check event-type specific date fields first
    if (event.type === 'study-weekend' && event.dateRange) {
      const start = new Date(event.dateRange.start)
      const end = new Date(event.dateRange.end)

      // Same month: Oct 10-12, 2025
      if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        return (
          start.toLocaleDateString('en-US', { month: 'short' }) +
          ' ' +
          start.getDate() +
          '-' +
          end.getDate() +
          ', ' +
          start.getFullYear()
        )
      }
      // Different months: Oct 30 - Nov 2, 2025
      return (
        start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' - ' +
        end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ', ' +
        end.getFullYear()
      )
    } else if (event.type === 'wedding' && event.ceremonyDate) {
      return new Date(event.ceremonyDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    } else if (event.type === 'baptism' && event.baptismDate) {
      return new Date(event.baptismDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    } else if (event.type === 'funeral' && event.serviceDate) {
      return new Date(event.serviceDate).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    } else if (event.type === 'recurring' && (event as any).recurringConfig) {
      const config = (event as any).recurringConfig
      const startDate = config.startDate || config.dateRange?.start
      const endDate = config.endDate || config.dateRange?.end
      
      if (startDate) {
        const start = new Date(startDate)
        
        // Get frequency info
        const frequency = config.frequency
        const daysOfWeek = config.daysOfWeek || []
        
        let frequencyText = 'Recurring Event'
        if (frequency === 'weekly' && daysOfWeek.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          const selectedDays = daysOfWeek.map((d: number) => dayNames[d]).join(', ')
          frequencyText = `Weekly on ${selectedDays}`
        } else if (frequency === 'biweekly' && daysOfWeek.length > 0) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          const selectedDays = daysOfWeek.map((d: number) => dayNames[d]).join(', ')
          frequencyText = `Bi-weekly on ${selectedDays}`
        } else if (frequency === 'monthly') {
          frequencyText = 'Monthly Recurring Event'
        } else if ((frequency as any) === 'custom') {
          frequencyText = 'Custom Recurring Event'
        }
        
        if (endDate) {
          const end = new Date(endDate)
          const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          const endStr = end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          return `${startStr} to ${endStr} (${frequencyText})`
        } else {
          const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          return `Starting ${startStr} (${frequencyText})`
        }
      }
    } else if ((event as any).startDate) {
      const start = new Date((event as any).startDate)
      const end = (event as any).endDate ? new Date((event as any).endDate) : null

      // Check if it's a one-day event
      const isSameDay = !end || (
        start.getDate() === end.getDate() &&
        start.getMonth() === end.getMonth() &&
        start.getFullYear() === end.getFullYear()
      )

      if (isSameDay) {
        // One-day event: Show date + time (e.g., "October 29, 2025 8:00pm")
        const hasTime = start.getHours() !== 0 || start.getMinutes() !== 0

        if (hasTime) {
          const hours = start.getHours()
          const minutes = start.getMinutes()
          const ampm = hours >= 12 ? 'pm' : 'am'
          const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
          const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`

          return start.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }) + ` ${timeStr}`
        } else {
          return start.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })
        }
      } else {
        // Multi-day event
        const hasSchedule = event.schedule && event.schedule.length > 0
        const startHasTime = start.getHours() !== 0 || start.getMinutes() !== 0
        const endHasTime = end!.getHours() !== 0 || end!.getMinutes() !== 0

        if (!hasSchedule && (startHasTime || endHasTime)) {
          // Show full date + time range if times specified and no schedule
          const formatDateTime = (date: Date) => {
            const hours = date.getHours()
            const minutes = date.getMinutes()
            const ampm = hours >= 12 ? 'pm' : 'am'
            const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
            const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`

            return date.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            }) + ` ${timeStr}`
          }

          return `${formatDateTime(start)} to ${formatDateTime(end!)}`
        } else {
          // Show date range only (schedule will show times, or no times specified)
          // Same month: Oct 10-12, 2025
          if (start.getMonth() === end!.getMonth() && start.getFullYear() === end!.getFullYear()) {
            return (
              start.toLocaleDateString('en-US', { month: 'long' }) +
              ' ' +
              start.getDate() +
              '-' +
              end!.getDate() +
              ', ' +
              start.getFullYear()
            )
          }
          // Different months: Oct 30 - Nov 2, 2025
          return (
            start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) +
            ' - ' +
            end!.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) +
            ', ' +
            end!.getFullYear()
          )
        }
      }
    }
    return null
  }

  // Group schedule items by day
  const getScheduleByDay = () => {
    if (!event.schedule || event.schedule.length === 0) return null

    const dayGroups: { [key: string]: typeof event.schedule } = {}

    event.schedule.forEach((item) => {
      const day = item.day || 'Schedule'
      if (!dayGroups[day]) {
        dayGroups[day] = []
      }
      dayGroups[day].push(item)
    })

    return dayGroups
  }

  const scheduleByDay = getScheduleByDay()
  const dateRange = getFormattedDateRange()

  // If event is members-only and session is still loading, show loading state
  if (event.membersOnly && isAuthLoading) {
    return (
      <YStack gap="$4" padding="$6" alignItems="center">
        <Text fontSize="$4" color="$gray11">
          Loading...
        </Text>
      </YStack>
    )
  }

  // Show access-denied message if event is members-only and user doesn't have access
  if (!hasAccess) {
    return (
      <YStack gap="$4" padding="$6" alignItems="center">
        <Lock size={64} color="$gray10" />
        <YStack gap="$2" alignItems="center">
          <H2 fontSize="$7" fontWeight="700" color="$color" textAlign="center">
            Members Only Event
          </H2>
          <Text fontSize="$4" color="$gray11" textAlign="center" maxWidth={500}>
            This event is restricted to Toronto East Ecclesia members.
            {!userRole ? ' Please sign in to view event details.' : null}
          </Text>
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack gap="$4">
      {/* Clean Header */}
      <YStack gap="$2">
        {/* Hide title for engagement events - blurb serves as the header */}
        {event.type !== 'engagement' && (
          <H2 fontSize="$8" fontWeight="700" color="$color">
            {event.title || 'Untitled Event'}
          </H2>
        )}

        {/* Engagement announcement - photo (if exists) | blurb, then names + date, then footer */}
        {event.type === 'engagement' ? (() => {
          const proposed = (event as any).engagementProposed || ''
          const to = (event as any).engagementTo || ''
          const blurb = (event as any).engagementAnnouncement || ''
          const photo = (event as any).engagementPhoto

          // Get the engagement date
          let dateText = ''
          if ((event as any).engagementDate) {
            const date = new Date((event as any).engagementDate)
            dateText = `. ${date.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}`
          }

          const namesLine = proposed && to ? `${proposed} is engaged to ${to}${dateText}` : ''

          return (
            <YStack gap="$6" paddingVertical="$4">
              {/* Icon + Congrats at the top, inline */}
              <XStack alignItems="center" gap="$3">
                <Gem size={100} color="$pink10" strokeWidth={1.5} />
                <Text fontSize="$7" color="$pink10" fontWeight="700">
                  Congrats!
                </Text>
              </XStack>

              {/* Photo | Blurb row */}
              {(photo?.url || blurb) && (
                <XStack gap="$4" flexWrap="wrap">
                  {photo?.url && (
                    <Image
                      source={{ uri: photo.url }}
                      width={180}
                      height={220}
                      borderRadius="$3"
                      objectFit="cover"
                    />
                  )}
                  {blurb && (
                    <YStack flex={1} minWidth={250} justifyContent="center">
                      <Text fontSize="$5" color="$color" lineHeight="$5" whiteSpace="pre-wrap">
                        {blurb}
                      </Text>
                    </YStack>
                  )}
                </XStack>
              )}

              {/* Names + date line below */}
              {namesLine && (
                <Text fontSize="$4" color="$gray11" fontStyle="italic">
                  {namesLine}
                </Text>
              )}

              {/* Footer with congratulations and bible verse */}
              <YStack gap="$4" paddingTop="$4" alignItems="center">
                <Text fontSize="$4" color="$color" fontWeight="600" textAlign="center">
                  Congratulations from your Brothers and Sisters of Toronto East
                </Text>
                <Text fontSize="$3" color="$gray11" fontStyle="italic" textAlign="center" lineHeight="$4">
                  Ephesians 5:1-2 Follow God's example, therefore, as dearly loved children and walk in the way of love, just as Christ loved us and gave himself up for us as a fragrant offering and sacrifice to God.
                </Text>
              </YStack>
            </YStack>
          )
        })() : null}

        {/* Baptism announcement - right after title, before date */}
        {event.type === 'baptism' && event.candidate ? (
          <Text fontSize="$5" color="$gray11">
            {(() => {
              const firstName = event.candidate.firstName || ''
              const lastName = event.candidate.lastName || ''
              const fullName = `${firstName} ${lastName}`.trim()
              return fullName
                ? `After a good confession of Faith, ${fullName} will be baptized into the saving name of our Lord.`
                : ''
            })()}
          </Text>
        ) : null}

        {/* Show date for non-funeral and non-engagement events - engagement date is shown inline with blurb */}
        {event.type !== 'funeral' && event.type !== 'engagement' && dateRange ? (
          <Text fontSize="$5" color="$gray11">
            {dateRange}
          </Text>
        ) : null}
        {/* Funeral announcement only shown in summary/newsletter view, not detail view (would be redundant with aboutDeceased) */}
      </YStack>

      <Separator />

      {/* Location - for events that have location data (non-funeral) */}
      {(event.type === 'general' || event.type === 'study-weekend' || event.type === 'baptism' || event.type === 'wedding') && (event as any).location ? (
        <YStack gap="$3">
          {(() => {
            const location = (event as any).location

            // Handle string location (legacy)
            if (typeof location === 'string') {
              return (
                <YStack gap="$2">
                  <Text fontSize="$5" fontWeight="600" color="$color">
                    Location
                  </Text>
                  <Text fontSize="$4" color="$gray11">
                    {location}
                  </Text>
                </YStack>
              )
            }

            const mode = location.mode || 'in-person'
            const showInPerson = mode === 'in-person' || mode === 'hybrid'
            const showOnline = mode === 'online' || mode === 'hybrid'

            return (
              <>
                {/* In-Person Location */}
                {showInPerson && location.name ? (
                  <YStack gap="$2">
                    <Text fontSize="$5" fontWeight="600" color="$color">
                      {mode === 'hybrid' ? 'In-Person Location' : 'Location'}
                    </Text>
                    <Text fontSize="$4" fontWeight="500" color="$gray12">
                      {location.name}
                    </Text>
                    {location.address ? (
                      <YStack gap="$1">
                        <Text fontSize="$4" color="$gray11">
                          {location.address}
                        </Text>
                        {(location.city || location.province || location.postalCode) ? (
                          <Text fontSize="$4" color="$gray11">
                            {[location.city, location.province, location.postalCode]
                              .filter(Boolean)
                              .join(', ')}
                          </Text>
                        ) : null}
                        {location.country && location.country !== 'Canada' ? (
                          <Text fontSize="$4" color="$gray11">
                            {location.country}
                          </Text>
                        ) : null}
                      </YStack>
                    ) : null}
                    {(event as any).hostingEcclesia ? (
                      <Text fontSize="$4" color="$gray11">
                        Hosted by: {typeof (event as any).hostingEcclesia === 'string'
                          ? (event as any).hostingEcclesia
                          : (event as any).hostingEcclesia.name}
                      </Text>
                    ) : null}
                    {location.parkingInfo ? (
                      <Text fontSize="$3" color="$gray10" fontStyle="italic">
                        Parking: {location.parkingInfo}
                      </Text>
                    ) : null}
                    {location.directions ? (
                      <Text fontSize="$3" color="$gray10" fontStyle="italic">
                        Directions: {location.directions}
                      </Text>
                    ) : null}
                  </YStack>
                ) : null}

                {/* Online Meeting */}
                {showOnline && location.onlineMeeting ? (
                  <YStack gap="$2">
                    <Text fontSize="$5" fontWeight="600" color="$color">
                      {mode === 'hybrid' ? 'Online Access' : 'Meeting Details'}
                    </Text>
                    {location.onlineMeeting.platform ? (
                      <Text fontSize="$4" color="$gray11">
                        Platform: {location.onlineMeeting.platform}
                      </Text>
                    ) : null}
                    {location.onlineMeeting.link ? (
                      <XStack gap="$2" alignItems="center">
                        <ExternalLink size={16} color="$blue10" />
                        <Text
                          fontSize="$4"
                          color="$blue10"
                          textDecorationLine="underline"
                          cursor="pointer"
                          onPress={() => window.open(location.onlineMeeting.link, '_blank')}
                        >
                          Join Meeting
                        </Text>
                      </XStack>
                    ) : null}
                    {location.onlineMeeting.meetingId ? (
                      <Text fontSize="$4" color="$gray11">
                        Meeting ID: {location.onlineMeeting.meetingId}
                      </Text>
                    ) : null}
                    {location.onlineMeeting.password ? (
                      <Text fontSize="$4" color="$gray11">
                        Password: {location.onlineMeeting.password}
                      </Text>
                    ) : null}
                    {location.onlineMeeting.dialInNumber ? (
                      <Text fontSize="$4" color="$gray11">
                        Dial-in: {location.onlineMeeting.dialInNumber}
                      </Text>
                    ) : null}
                    {location.onlineMeeting.additionalInfo ? (
                      <Text fontSize="$3" color="$gray10" fontStyle="italic">
                        {location.onlineMeeting.additionalInfo}
                      </Text>
                    ) : null}
                  </YStack>
                ) : null}
              </>
            )
          })()}
        </YStack>
      ) : null}

      {/* Funeral Service Location moved to after About section */}

      {/* Theme and Speaker Info */}
      <YStack gap="$2">
        {event.theme ? (
          <Text fontSize="$5" fontWeight="600" color="$color">
            {event.theme}
          </Text>
        ) : null}

        {/* Speakers for study weekends */}
        {event.type === 'study-weekend' && event.speakers && event.speakers.length > 0 ? (
          <Text fontSize="$4" color="$gray11">
            Speaker{event.speakers.length > 1 ? 's' : ''}:{' '}
            {event.speakers
              .map((s) => {
                const title = s.title || ''
                const firstName = s.firstName || ''
                const lastName = s.lastName || ''
                return `${title} ${firstName} ${lastName}`.trim()
              })
              .filter((name) => name.length > 0)
              .join(', ') || 'TBA'}
          </Text>
        ) : null}

        {/* Names for other event types */}
        {event.type === 'wedding' && event.couple ? (
          <Text fontSize="$4" color="$gray11">
            {(() => {
              const bride =
                `${event.couple.bride?.firstName || ''} ${event.couple.bride?.lastName || ''}`.trim()
              const groom =
                `${event.couple.groom?.firstName || ''} ${event.couple.groom?.lastName || ''}`.trim()
              
              if (!bride && !groom) return 'Wedding Couple'
              if (!bride) return groom
              if (!groom) return bride
              return `${bride} & ${groom}`
            })()}
          </Text>
        ) : null}

{/* Funeral info moved to announcement section above */}
      </YStack>

      {/* About the Deceased - photo on left, text on right (no header) */}
      {event.type === 'funeral' && ((event as any).aboutDeceased || (event as any).deceasedPhoto) ? (
        <YStack gap="$3" marginTop="$2">
          {(event as any).deceasedPhoto ? (
            // Layout with photo on left, text on right
            <XStack gap="$4" flexWrap="wrap">
              <Image
                source={{ uri: (event as any).deceasedPhoto.url }}
                width={180}
                height={220}
                borderRadius="$3"
                objectFit="cover"
              />
              {(event as any).aboutDeceased ? (
                <YStack flex={1} minWidth={250}>
                  <Text fontSize="$4" color="$gray11" lineHeight="$5" whiteSpace="pre-wrap">
                    {(event as any).aboutDeceased}
                  </Text>
                </YStack>
              ) : null}
            </XStack>
          ) : (event as any).aboutDeceased ? (
            // Just text, no photo
            <Text fontSize="$4" color="$gray11" lineHeight="$5" whiteSpace="pre-wrap">
              {(event as any).aboutDeceased}
            </Text>
          ) : null}
        </YStack>
      ) : null}

      {/* Funeral Service Location and Date - shown at bottom */}
      {event.type === 'funeral' ? (() => {
        const locations = (event as any).locations
        const serviceLocation = locations?.service
        const simpleLocation = (event as any).location
        const location = serviceLocation || simpleLocation

        // Get service date for display
        const serviceDateObj = event.serviceDate ? new Date(event.serviceDate) : null
        const serviceDate = serviceDateObj
          ? serviceDateObj.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })
          : null

        // Get service time if set
        const serviceTime = serviceDateObj && (serviceDateObj.getHours() !== 0 || serviceDateObj.getMinutes() !== 0)
          ? (() => {
              const hours = serviceDateObj.getHours()
              const minutes = serviceDateObj.getMinutes()
              const ampm = hours >= 12 ? 'pm' : 'am'
              const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
              return `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`
            })()
          : null

        // Get online meeting info
        const onlineMeeting = location?.onlineMeeting

        if (!location && !serviceDate) return null

        return (
          <YStack gap="$2" marginTop="$4">
            <Text fontSize="$5" fontWeight="600" color="$color">
              Service Details
            </Text>
            {serviceDate ? (
              <Text fontSize="$4" color="$gray11">
                {serviceDate}{serviceTime ? ` at ${serviceTime}` : ''}
              </Text>
            ) : null}
            {location ? (() => {
              // Handle string location (legacy)
              if (typeof location === 'string') {
                return (
                  <Text fontSize="$4" color="$gray11">
                    {location}
                  </Text>
                )
              }

              return location.name ? (
                <YStack gap="$1">
                  <Text fontSize="$4" fontWeight="500" color="$gray12">
                    {location.name}
                  </Text>
                  {location.address ? (
                    <Text fontSize="$4" color="$gray11">
                      {location.address}
                    </Text>
                  ) : null}
                  {(location.city || location.province || location.postalCode) ? (
                    <Text fontSize="$4" color="$gray11">
                      {[location.city, location.province, location.postalCode]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  ) : null}
                </YStack>
              ) : null
            })() : null}

            {/* Online Meeting Info (Zoom, etc.) */}
            {onlineMeeting ? (
              <YStack gap="$1" marginTop="$2">
                {onlineMeeting.platform ? (
                  <Text fontSize="$4" fontWeight="500" color="$gray12">
                    {onlineMeeting.platform}
                  </Text>
                ) : null}
                {onlineMeeting.link ? (
                  <Text
                    fontSize="$4"
                    color="$blue10"
                    textDecorationLine="underline"
                    cursor="pointer"
                    onPress={() => window.open(onlineMeeting.link, '_blank')}
                  >
                    {onlineMeeting.link}
                  </Text>
                ) : null}
                {onlineMeeting.meetingId ? (
                  <Text fontSize="$4" color="$gray11">
                    Meeting ID: {onlineMeeting.meetingId}
                  </Text>
                ) : null}
                {onlineMeeting.password ? (
                  <Text fontSize="$4" color="$gray11">
                    Password: {onlineMeeting.password}
                  </Text>
                ) : null}
                {onlineMeeting.dialInNumber ? (
                  <Text fontSize="$4" color="$gray11">
                    Dial-in: {onlineMeeting.dialInNumber}
                  </Text>
                ) : null}
              </YStack>
            ) : null}
          </YStack>
        )
      })() : null}

      {/* About the Candidate - with optional photo */}
      {event.type === 'baptism' && ((event as any).aboutCandidate || (event as any).candidatePhoto) ? (
        <YStack gap="$3" marginTop="$2">
          <Text fontSize="$5" fontWeight="600" color="$color">
            About the Candidate
          </Text>
          {(event as any).candidatePhoto ? (
            // Layout with photo on left, text on right
            <XStack gap="$4" flexWrap="wrap">
              <Image
                source={{ uri: (event as any).candidatePhoto.url }}
                width={180}
                height={220}
                borderRadius="$3"
                objectFit="cover"
              />
              {(event as any).aboutCandidate ? (
                <YStack flex={1} minWidth={250}>
                  <Text fontSize="$4" color="$gray11" lineHeight="$5" whiteSpace="pre-wrap">
                    {(event as any).aboutCandidate}
                  </Text>
                </YStack>
              ) : null}
            </XStack>
          ) : (event as any).aboutCandidate ? (
            // Just text, no photo
            <Text fontSize="$4" color="$gray11" lineHeight="$5" whiteSpace="pre-wrap">
              {(event as any).aboutCandidate}
            </Text>
          ) : null}
        </YStack>
      ) : null}

      {/* Schedule - Clean format by day */}
      {scheduleByDay ? (
        <YStack gap="$3">
          {Object.entries(scheduleByDay).map(([day, items]) => (
            <YStack key={day} gap="$2">
              <Text fontSize="$5" fontWeight="600" color="$color" marginTop="$2">
                {day}:
              </Text>
              <YStack gap="$1" paddingLeft="$4">
                {items.map((item, index) => {
                  // Format time properly - handle both time strings and ISO date strings
                  let displayTime = ''
                  const timeValue = item.time || item.startTime

                  if (timeValue) {
                    // Check if it looks like an ISO date string
                    if (timeValue.includes('T')) {
                      const date = new Date(timeValue)
                      const hours = date.getHours()
                      const minutes = date.getMinutes()
                      const ampm = hours >= 12 ? 'pm' : 'am'
                      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
                      displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`
                    } else if (timeValue.includes('-')) {
                      // It's a range like "7:30pm-9:00pm", take the first part
                      displayTime = timeValue.split('-')[0].trim()
                    } else {
                      // Use as-is
                      displayTime = timeValue
                    }
                  }

                  return (
                    <YStack key={index} gap="$1">
                      <Text fontSize="$4" color="$gray12">
                        {displayTime ? `${displayTime} ` : ''}
                        {item.activity || ''}
                        {item.title ? ` ${item.title}` : ''}
                      </Text>
                      {item.location && item.location !== event.location ? (
                        <YStack paddingLeft="$4">
                          <Text fontSize="$3" color="$gray11">
                            {typeof item.location === 'string' ? item.location : item.location.name}
                          </Text>
                          {typeof item.location === 'object' && item.location.address ? (
                            <Text fontSize="$3" color="$gray11">
                              {item.location.address}
                            </Text>
                          ) : null}
                        </YStack>
                      ) : null}
                    </YStack>
                  )
                })}
              </YStack>
            </YStack>
          ))}
        </YStack>
      ) : null}

      {/* Notes/Description */}
      {event.description ? (
        <YStack gap="$2" marginTop="$2">
          <Text fontSize="$5" fontWeight="600" color="$color">
            Notes
          </Text>
          <Text fontSize="$4" color="$gray11" lineHeight="$5">
            {event.description}
          </Text>
        </YStack>
      ) : null}

      {/* Registration Information */}
      {event.registration ? (() => {
        const reg = event.registration
        const hasRegistrationInfo =
          reg.required ||
          reg.deadline ||
          reg.registrationUrl ||
          reg.contactEmail ||
          reg.contactPhone ||
          reg.fee ||
          reg.paymentInstructions ||
          reg.notes

        if (!hasRegistrationInfo) return null

        return (
          <YStack gap="$2" marginTop="$2">
            <Text fontSize="$5" fontWeight="600" color="$color">
              Registration Information
            </Text>

            {reg.required && reg.required !== 'false' && reg.required !== false ? (
              <Text fontSize="$4" color="$red10" fontWeight="600">
                Registration Required
              </Text>
            ) : null}

            {reg.deadline ? (
              <Text fontSize="$4" color="$gray11">
                Deadline: {new Date(reg.deadline).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </Text>
            ) : null}

            {reg.registrationUrl ? (
              <XStack gap="$2" alignItems="center">
                <ExternalLink size={16} color="$blue10" />
                <Text
                  fontSize="$4"
                  color="$blue10"
                  textDecorationLine="underline"
                  cursor="pointer"
                  onPress={() => window.open(reg.registrationUrl, '_blank')}
                >
                  Register Online
                </Text>
              </XStack>
            ) : null}

            {(reg.contactEmail || reg.contactPhone) ? (
              <YStack gap="$1">
                {reg.contactEmail ? (
                  <Text fontSize="$4" color="$gray11">
                    Email: <Text color="$blue10" textDecorationLine="underline" onPress={() => window.open(`mailto:${reg.contactEmail}`, '_blank')} cursor="pointer">{reg.contactEmail}</Text>
                  </Text>
                ) : null}
                {reg.contactPhone ? (
                  <Text fontSize="$4" color="$gray11">
                    Phone: <Text color="$blue10" textDecorationLine="underline" onPress={() => window.open(`tel:${reg.contactPhone}`, '_blank')} cursor="pointer">{reg.contactPhone}</Text>
                  </Text>
                ) : null}
              </YStack>
            ) : null}

            {(reg.hasFee || reg.fee) ? (
              <YStack gap="$1">
                <Text fontSize="$4" color="$gray11" fontWeight="600">
                  Registration Fee: {typeof reg.fee === 'number' ? `$${reg.fee.toFixed(2)}` : reg.fee || 'TBA'}
                </Text>
                {reg.paymentInstructions ? (
                  <Text fontSize="$3" color="$gray10" fontStyle="italic">
                    {reg.paymentInstructions}
                  </Text>
                ) : null}
              </YStack>
            ) : null}

            {reg.notes ? (
              <Text fontSize="$3" color="$gray10" fontStyle="italic">
                {reg.notes}
              </Text>
            ) : null}
          </YStack>
        )
      })() : null}

      {/* Documents */}
      {event.documents && event.documents.length > 0 ? (
        <YStack gap="$2" marginTop="$2" alignItems="flex-start">
          {event.documents.map((doc) => {
            const isPDF = doc.originalName?.toLowerCase().endsWith('.pdf')

            const handleDownload = () => {
              if (doc.fileUrl) {
                // Open PDF in new tab - Chrome will show inline viewer with download options
                window.open(doc.fileUrl, '_blank')
              }
            }

            if (isPDF) {
              return (
                <Button
                  key={doc.id}
                  size="$4"
                  icon={Download}
                  backgroundColor="$primary"
                  color="$primaryForeground"
                  borderColor="$primary"
                  borderWidth={1}
                  width="auto"
                  alignSelf="flex-start"
                  pressStyle={{
                    backgroundColor: "$secondary",
                    opacity: 0.9
                  }}
                  hoverStyle={{
                    backgroundColor: "$secondary"
                  }}
                  onPress={handleDownload}
                >
                  Further Information
                </Button>
              )
            } else {
              return (
                <Text
                  key={doc.id}
                  fontSize="$4"
                  color="$blue10"
                  textDecorationLine="underline"
                  cursor="pointer"
                  onPress={handleDownload}
                >
                  Download {doc.originalName}
                </Text>
              )
            }
          })}
        </YStack>
      ) : null}
    </YStack>
  )
}
