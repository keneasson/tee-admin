'use client'

import { YStack, XStack, Text, H2, H4, Separator, Card, Image } from 'tamagui'
import { MarkdownLiteText } from '../markdown-lite-text'
import { Button } from '../Button'
import { Download, ExternalLink, Lock, MapPin } from '@tamagui/lucide-icons'
import { Event, EventSection, getPlatformDisplayName } from '@my/app/types/events'
import {
  formatDateInTimezone,
  formatTimeInTimezone,
  formatTimeRange as formatTimezoneTimeRange,
  formatTimeRangeWithDualTimezone,
  formatTimeWithDualTimezone,
  getUserTimezone,
  isDateOnly,
  formatDateOnly,
  DEFAULT_TIMEZONE,
  getTimezoneCityName,
} from '@my/app/utils/timezone'
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

  // Get event timezone (default to Toronto for all event types)
  const eventTimezone = (event as any).eventTimezone || DEFAULT_TIMEZONE
  const userTimezone = getUserTimezone()
  const showDualTimezone = eventTimezone !== userTimezone

  // Helper to format a date with timezone support
  const formatDateWithTimezone = (dateVal: Date | string, includeTime = false) => {
    const dateStr = typeof dateVal === 'string' ? dateVal : dateVal.toISOString()

    // Check if date-only (no time component)
    if (isDateOnly(dateStr)) {
      return formatDateOnly(dateStr)
    }

    const dateFormatted = formatDateInTimezone(dateStr, eventTimezone, { weekday: undefined })

    if (!includeTime) return dateFormatted

    // Include time with optional dual timezone
    const timeFormatted = showDualTimezone
      ? formatTimeWithDualTimezone(dateStr, eventTimezone, userTimezone)
      : formatTimeInTimezone(dateStr, eventTimezone)

    return `${dateFormatted} at ${timeFormatted}`
  }

  // Format date for display
  const getFormattedDateRange = () => {
    // Check event-type specific date fields first
    if (event.type === 'study-weekend' && event.dateRange) {
      const start = new Date(event.dateRange.start)
      const end = new Date(event.dateRange.end)

      const isSameDay = start.getDate() === end.getDate() &&
        start.getMonth() === end.getMonth() &&
        start.getFullYear() === end.getFullYear()

      const fmt = (d: Date, opts?: Intl.DateTimeFormatOptions) =>
        d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', ...opts })

      if (isSameDay) {
        // "Friday April 3, 2026"
        return fmt(start)
      }
      // "Friday April 3 to Sunday April 5, 2026"
      const startFmt = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      const endFmt = fmt(end)
      return `${startFmt} to ${endFmt}`
    } else if (event.type === 'wedding' && event.ceremonyDate) {
      const dateStr = typeof event.ceremonyDate === 'string' ? event.ceremonyDate : event.ceremonyDate.toISOString()
      return formatDateWithTimezone(dateStr, !isDateOnly(dateStr))
    } else if (event.type === 'baptism' && event.baptismDate) {
      const dateStr = typeof event.baptismDate === 'string' ? event.baptismDate : event.baptismDate.toISOString()
      return formatDateWithTimezone(dateStr, !isDateOnly(dateStr))
    } else if (event.type === 'funeral' && event.serviceDate) {
      // Funeral dates handled separately in the funeral arrangements section
      const dateStr = typeof event.serviceDate === 'string' ? event.serviceDate : event.serviceDate.toISOString()
      return formatDateInTimezone(dateStr, eventTimezone, { weekday: undefined })
    } else if (event.type === 'recurring' && (event as any).recurringConfig) {
      const config = (event as any).recurringConfig
      const startDate = config.startDate || config.dateRange?.start
      const endDate = config.endDate || config.dateRange?.end

      if (startDate) {
        const startStr = typeof startDate === 'string' ? startDate : startDate.toISOString()

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
        } else if (frequency === 'custom') {
          frequencyText = 'Custom Recurring Event'
        }

        if (endDate) {
          const endStr = typeof endDate === 'string' ? endDate : endDate.toISOString()
          const startFormatted = formatDateInTimezone(startStr, eventTimezone, { weekday: undefined })
          const endFormatted = formatDateInTimezone(endStr, eventTimezone, { weekday: undefined })
          return `${startFormatted} to ${endFormatted} (${frequencyText})`
        } else {
          const startFormatted = formatDateInTimezone(startStr, eventTimezone, { weekday: undefined })
          return `Starting ${startFormatted} (${frequencyText})`
        }
      }
    } else if ((event as any).startDate) {
      if ((event as any).hideDates) {
        return null
      }
      const startStr = typeof (event as any).startDate === 'string' ? (event as any).startDate : (event as any).startDate.toISOString()
      const endStr = (event as any).endDate
        ? (typeof (event as any).endDate === 'string' ? (event as any).endDate : (event as any).endDate.toISOString())
        : null
      const start = new Date((event as any).startDate)
      const end = (event as any).endDate ? new Date((event as any).endDate) : null

      // Check if it's a one-day event
      const isSameDay = !end || (
        start.getDate() === end.getDate() &&
        start.getMonth() === end.getMonth() &&
        start.getFullYear() === end.getFullYear()
      )

      if (isSameDay) {
        // One-day event: Show date + time if time is present
        const hasTime = !isDateOnly(startStr)

        if (hasTime) {
          const dateFormatted = formatDateInTimezone(startStr, eventTimezone, { weekday: undefined })
          const timeFormatted = showDualTimezone
            ? formatTimeWithDualTimezone(startStr, eventTimezone, userTimezone)
            : formatTimeInTimezone(startStr, eventTimezone)
          return `${dateFormatted} at ${timeFormatted}`
        } else {
          return formatDateOnly(startStr)
        }
      } else {
        // Multi-day event
        const hasSchedule = event.schedule && event.schedule.length > 0
        const startHasTime = !isDateOnly(startStr)
        const endHasTime = endStr && !isDateOnly(endStr)

        if (!hasSchedule && (startHasTime || endHasTime)) {
          // Show full date + time range if times specified and no schedule
          const startDateFormatted = formatDateInTimezone(startStr, eventTimezone, { weekday: undefined })
          const startTimeFormatted = formatTimeInTimezone(startStr, eventTimezone)
          const endDateFormatted = formatDateInTimezone(endStr!, eventTimezone, { weekday: undefined })
          const endTimeFormatted = formatTimeInTimezone(endStr!, eventTimezone)

          const result = `${startDateFormatted} ${startTimeFormatted} to ${endDateFormatted} ${endTimeFormatted}`
          return showDualTimezone
            ? `${result} (${getTimezoneCityName(eventTimezone)} time)`
            : result
        } else {
          // Show date range only (schedule will show times, or no times specified)
          const startFmt = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
          const endFmt = end!.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          return `${startFmt} to ${endFmt}`
        }
      }
    }
    return null
  }

  // Group schedule items by day - extract date from datetime if available
  const getScheduleByDay = () => {
    if (!event.schedule || event.schedule.length === 0) return null

    const dayGroups: { [key: string]: NonNullable<typeof event.schedule> } = {}

    event.schedule.forEach((item) => {
      let dayKey = item.day || 'Schedule'

      // If no explicit day but we have a datetime, extract the day from it
      const timeValue = item.time || (item.startTime ? String(item.startTime) : undefined)
      if (timeValue && typeof timeValue === 'string' && timeValue.includes('T') && !item.day) {
        const date = new Date(timeValue)
        // Format as "Saturday March 7" for grouping
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
        const monthName = date.toLocaleDateString('en-US', { month: 'long' })
        const dayOfMonth = date.getDate()
        dayKey = `${dayName} ${monthName} ${dayOfMonth}`
      }

      if (!dayGroups[dayKey]) {
        dayGroups[dayKey] = []
      }
      dayGroups[dayKey].push(item)
    })

    // Sort the groups by date (earliest first)
    const sortedEntries = Object.entries(dayGroups).sort((a, b) => {
      // Try to extract a date from the first item in each group
      const getFirstDate = (items: NonNullable<typeof event.schedule>) => {
        const timeValue = items[0]?.time || (items[0]?.startTime ? String(items[0]?.startTime) : undefined)
        if (timeValue && typeof timeValue === 'string' && timeValue.includes('T')) {
          return new Date(timeValue).getTime()
        }
        return 0
      }
      return getFirstDate(a[1]) - getFirstDate(b[1])
    })

    return Object.fromEntries(sortedEntries)
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
              {/* Rings image + Congrats at the top, inline */}
              <XStack alignItems="center" gap="$4">
                <img
                  src="https://tee-admin-files.s3.ca-central-1.amazonaws.com/uploads/email-assets/engagement-rings.jpg"
                  alt="Engagement rings"
                  style={{ width: '60px', height: '60px', objectFit: 'contain' }}
                />
                <Text fontSize="$6" color="$color" fontWeight="700">
                  Congratulations!
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

      {/* Theme and Speaker Info - shown first for study-weekend events */}
      {event.type === 'study-weekend' ? (
        <YStack gap="$2">
          {event.theme ? (
            <Text fontSize="$5" fontWeight="600" color="$color">
              {event.theme}
            </Text>
          ) : null}

          {/* Speakers for study weekends */}
          {event.speakers && event.speakers.length > 0 ? (
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
        </YStack>
      ) : null}

      {/* Location - for events that have location data (non-funeral).
          Weddings save the venue on ceremonyLocation (the editor leaves
          location empty), so resolve that first with location as a legacy
          fallback. */}
      {(event.type === 'general' || event.type === 'study-weekend' || event.type === 'baptism' || event.type === 'wedding') &&
      (event.type === 'wedding' ? ((event as any).ceremonyLocation || (event as any).location) : (event as any).location) ? (
        <YStack gap="$3">
          {(() => {
            const location =
              event.type === 'wedding'
                ? (event as any).ceremonyLocation || (event as any).location
                : (event as any).location
            const isStudyWeekend = event.type === 'study-weekend'

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
            // For study-weekend, online is rendered separately at the bottom
            const showOnline = !isStudyWeekend && (mode === 'online' || mode === 'hybrid')

            return (
              <>
                {/* In-Person Location */}
                {showInPerson && (location.name || location.placeName || location.address) ? (
                  <YStack gap="$2">
                    <Text fontSize="$5" fontWeight="600" color="$color">
                      Location
                    </Text>
                    {(location.name || location.placeName) ? (
                      <Text fontSize="$4" fontWeight="500" color="$gray12">
                        {location.name || location.placeName}
                      </Text>
                    ) : null}
                    {location.address ? (
                      <XStack gap="$2" alignItems="center">
                        {location.mapsUrl ? (
                          <Text
                            cursor="pointer"
                            hoverStyle={{ opacity: 0.7 }}
                            onPress={() => {
                              if (typeof window !== 'undefined') {
                                window.open(location.mapsUrl, '_blank')
                              }
                            }}
                          >
                            <MapPin size={16} color="$blue10" />
                          </Text>
                        ) : null}
                        <Text fontSize="$4" color="$gray11">
                          {location.address}
                        </Text>
                      </XStack>
                    ) : null}
                    {(event as any).hostingEcclesia ? (
                      <Text fontSize="$4" color="$gray11">
                        Hosted by: {typeof (event as any).hostingEcclesia === 'string'
                          ? (event as any).hostingEcclesia
                          : (event as any).hostingEcclesia.name}
                      </Text>
                    ) : null}
                    {/* For study-weekend, parking is rendered separately after schedule */}
                    {!isStudyWeekend && location.parkingInfo ? (
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

                {/* Online Meeting - not shown here for study-weekend (rendered at bottom instead) */}
                {showOnline && location.onlineMeeting ? (
                  <YStack gap="$2">
                    <Text fontSize="$5" fontWeight="600" color="$color">
                      {mode === 'hybrid' ? 'Online Access' : 'Meeting Details'}
                    </Text>
                    {location.onlineMeeting.platform ? (
                      <Text fontSize="$4" color="$gray11">
                        Platform: {getPlatformDisplayName(location.onlineMeeting.platform)}
                      </Text>
                    ) : null}
                    {location.onlineMeeting.link ? (
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <ExternalLink size={16} color="$blue10" />
                        <Text
                          fontSize="$4"
                          color="$blue10"
                          textDecorationLine="underline"
                          cursor="pointer"
                          onPress={() => window.open(location.onlineMeeting.link, '_blank')}
                        >
                          {location.onlineMeeting.link}
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

      {/* Theme and Speaker Info - for non-study-weekend events */}
      {event.type !== 'study-weekend' ? (
        <YStack gap="$2">
          {event.theme ? (
            <Text fontSize="$5" fontWeight="600" color="$color">
              {event.theme}
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
        </YStack>
      ) : null}

      {/* About the Deceased - photo on left, text on right (no header) */}
      {event.type === 'funeral' && ((event as any).aboutDeceased || (event as any).deceasedPhoto) ? (
        <YStack gap="$3" marginTop="$2">
          {(event as any).deceasedPhoto ? (
            // Layout with photo on left, text on right
            <XStack gap="$4" flexWrap="wrap">
              <img
                src={(event as any).deceasedPhoto.url}
                alt="Photo of deceased"
                style={{
                  width: '150px',
                  maxWidth: '150px',
                  height: 'auto',
                  borderRadius: '8px',
                  objectFit: 'cover'
                }}
              />
              {(event as any).aboutDeceased ? (
                <YStack flex={1} minWidth={250}>
                  <MarkdownLiteText text={(event as any).aboutDeceased} fontSize="$4" color="$gray11" lineHeight="$5" />
                </YStack>
              ) : null}
            </XStack>
          ) : (event as any).aboutDeceased ? (
            // Just text, no photo
            <MarkdownLiteText text={(event as any).aboutDeceased} fontSize="$4" color="$gray11" lineHeight="$5" />
          ) : null}
        </YStack>
      ) : null}

      {/* Funeral Arrangements - Visitation, Service, and Graveside */}
      {event.type === 'funeral' ? (() => {
        const locations = (event as any).locations
        const serviceLocation = locations?.service
        const visitationLocation = locations?.visitation || locations?.viewing // Support both new and old field names
        const gravesideLocation = locations?.graveside
        const simpleLocation = (event as any).location
        const primaryLocation = serviceLocation || simpleLocation

        // Timezone variables already defined at component level

        // Visitation dates
        const visitationDate = (event as any).visitationDate || (event as any).viewingDate // Support both field names
        const visitationEndDate = (event as any).visitationEndDate
        const visitationSameLocation = (event as any).visitationSameLocation ?? true

        // Graveside
        const hasGravesideService = (event as any).hasGravesideService
        const gravesideDate = (event as any).gravesideDate

        // Helper to render a location block
        const renderLocation = (loc: any) => {
          if (!loc) return null
          if (typeof loc === 'string') {
            return <Text fontSize="$4" color="$gray11">{loc}</Text>
          }
          if (!loc.name) return null
          return (
            <YStack gap="$1">
              <Text fontSize="$4" fontWeight="500" color="$gray12">{loc.name}</Text>
              {loc.address ? <Text fontSize="$4" color="$gray11">{loc.address}</Text> : null}
              {(loc.city || loc.province || loc.postalCode) ? (
                <Text fontSize="$4" color="$gray11">
                  {[loc.city, loc.province, loc.postalCode].filter(Boolean).join(', ')}
                </Text>
              ) : null}
            </YStack>
          )
        }

        // Helper to format date with optional time
        const formatEventDateTime = (dateVal: any, showTime = true) => {
          if (!dateVal) return null
          const dateStr = typeof dateVal === 'string' ? dateVal : dateVal.toISOString()

          // Check if date-only (no time component)
          if (isDateOnly(dateStr)) {
            return formatDateOnly(dateStr)
          }

          const dateFormatted = formatDateInTimezone(dateStr, eventTimezone, { weekday: undefined })
          if (!showTime) return dateFormatted

          const timeFormatted = showDualTimezone
            ? formatTimeWithDualTimezone(dateStr, eventTimezone, userTimezone)
            : `${formatTimeInTimezone(dateStr, eventTimezone)} (${getTimezoneCityName(eventTimezone)} time)`

          return `${dateFormatted} at ${timeFormatted}`
        }

        // Helper to format time range (for visitation)
        const formatVisitationTimeRange = () => {
          if (!visitationDate) return null
          const startStr = typeof visitationDate === 'string' ? visitationDate : visitationDate.toISOString()

          // If date-only, just show the date
          if (isDateOnly(startStr)) {
            return formatDateOnly(startStr)
          }

          const dateFormatted = formatDateInTimezone(startStr, eventTimezone, { weekday: undefined })

          if (visitationEndDate) {
            const endStr = typeof visitationEndDate === 'string' ? visitationEndDate : visitationEndDate.toISOString()
            const timeRange = showDualTimezone
              ? formatTimeRangeWithDualTimezone(startStr, endStr, eventTimezone, userTimezone)
              : `${formatTimezoneTimeRange(startStr, endStr, eventTimezone)} (${getTimezoneCityName(eventTimezone)} time)`
            return `${dateFormatted}, ${timeRange}`
          }

          // Single start time only
          const timeFormatted = showDualTimezone
            ? formatTimeWithDualTimezone(startStr, eventTimezone, userTimezone)
            : `${formatTimeInTimezone(startStr, eventTimezone)} (${getTimezoneCityName(eventTimezone)} time)`
          return `${dateFormatted} at ${timeFormatted}`
        }

        // Check if we have any content to display
        // Only count as "has content" if there's actual data (not just empty objects)
        const hasVisitation = visitationDate
        const hasValidLocation = primaryLocation?.name?.trim()
        const hasService = event.serviceDate || hasValidLocation
        const hasGraveside = hasGravesideService && gravesideDate

        if (!hasVisitation && !hasService && !hasGraveside) return null

        // Determine layout: same location vs different locations
        const useSameLocationLayout = visitationSameLocation && hasValidLocation

        return (
          <YStack gap="$4" marginTop="$4">
            <Text fontSize="$5" fontWeight="600" color="$color">
              Funeral Arrangements
            </Text>

            {/* Same Location Layout: Show location once, then list all times */}
            {useSameLocationLayout ? (
              <YStack gap="$3">
                {/* Location shown once */}
                {hasValidLocation ? renderLocation(primaryLocation) : null}

                {/* Visitation time */}
                {hasVisitation ? (
                  <YStack gap="$1">
                    <Text fontSize="$4" fontWeight="500" color="$gray12">Visitation</Text>
                    <Text fontSize="$4" color="$gray11">{formatVisitationTimeRange()}</Text>
                  </YStack>
                ) : null}

                {/* Service time */}
                {event.serviceDate ? (
                  <YStack gap="$1">
                    <Text fontSize="$4" fontWeight="500" color="$gray12">Service</Text>
                    <Text fontSize="$4" color="$gray11">{formatEventDateTime(event.serviceDate)}</Text>
                  </YStack>
                ) : null}

                {/* Graveside - separate location if provided */}
                {hasGraveside ? (
                  <YStack gap="$1">
                    <Text fontSize="$4" fontWeight="500" color="$gray12">Graveside Service</Text>
                    <Text fontSize="$4" color="$gray11">{formatEventDateTime(gravesideDate)}</Text>
                    {gravesideLocation ? renderLocation(gravesideLocation) : null}
                  </YStack>
                ) : null}
              </YStack>
            ) : (
              /* Different Locations Layout: Show each section with its own location */
              <YStack gap="$4">
                {/* Visitation section */}
                {hasVisitation ? (
                  <YStack gap="$2">
                    <Text fontSize="$4" fontWeight="600" color="$gray12">Visitation</Text>
                    {visitationLocation ? renderLocation(visitationLocation) : null}
                    <Text fontSize="$4" color="$gray11">{formatVisitationTimeRange()}</Text>
                  </YStack>
                ) : null}

                {/* Service section */}
                {hasService ? (
                  <YStack gap="$2">
                    <Text fontSize="$4" fontWeight="600" color="$gray12">Service</Text>
                    {hasValidLocation ? renderLocation(primaryLocation) : null}
                    {event.serviceDate ? (
                      <Text fontSize="$4" color="$gray11">{formatEventDateTime(event.serviceDate)}</Text>
                    ) : null}
                  </YStack>
                ) : null}

                {/* Graveside section */}
                {hasGraveside ? (
                  <YStack gap="$2">
                    <Text fontSize="$4" fontWeight="600" color="$gray12">Graveside Service</Text>
                    {gravesideLocation ? renderLocation(gravesideLocation) : null}
                    <Text fontSize="$4" color="$gray11">{formatEventDateTime(gravesideDate)}</Text>
                  </YStack>
                ) : null}
              </YStack>
            )}

            {/* Online Meeting Info (if any location has it) */}
            {primaryLocation?.onlineMeeting ? (
              <YStack gap="$1" marginTop="$2">
                {primaryLocation.onlineMeeting.platform ? (
                  <Text fontSize="$4" fontWeight="500" color="$gray12">
                    {getPlatformDisplayName(primaryLocation.onlineMeeting.platform)}
                  </Text>
                ) : null}
                {primaryLocation.onlineMeeting.link ? (
                  <Text
                    fontSize="$4"
                    color="$blue10"
                    textDecorationLine="underline"
                    cursor="pointer"
                    onPress={() => window.open(primaryLocation.onlineMeeting.link, '_blank')}
                  >
                    {primaryLocation.onlineMeeting.link}
                  </Text>
                ) : null}
                {primaryLocation.onlineMeeting.meetingId ? (
                  <Text fontSize="$4" color="$gray11">
                    Meeting ID: {primaryLocation.onlineMeeting.meetingId}
                  </Text>
                ) : null}
                {primaryLocation.onlineMeeting.password ? (
                  <Text fontSize="$4" color="$gray11">
                    Password: {primaryLocation.onlineMeeting.password}
                  </Text>
                ) : null}
                {primaryLocation.onlineMeeting.dialInNumber ? (
                  <Text fontSize="$4" color="$gray11">
                    Dial-in: {primaryLocation.onlineMeeting.dialInNumber}
                  </Text>
                ) : null}
              </YStack>
            ) : null}
          </YStack>
        )
      })() : null}

      {/* Online Obituary Link - for funerals */}
      {event.type === 'funeral' && (event as any).obituaryUrl ? (
        <YStack gap="$2" marginTop="$4">
          <Text fontSize="$5" fontWeight="600" color="$color">
            Obituary
          </Text>
          <Text
            fontSize="$4"
            color="$blue10"
            textDecorationLine="underline"
            cursor="pointer"
            onPress={() => window.open((event as any).obituaryUrl, '_blank')}
          >
            {(event as any).obituaryUrl}
          </Text>
        </YStack>
      ) : null}

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

      {/* Sections - Multi-location, multi-day event display */}
      {event.sections && event.sections.length > 0 ? (
        <YStack gap="$4">
          {event.sections.map((section: EventSection, sectionIndex: number) => {
            // Format section date
            let sectionDateStr = ''
            if (section.date) {
              const d = new Date(section.date)
              sectionDateStr = d.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })
            }

            // Build time range string
            const timeRange = [section.startTime, section.endTime]
              .filter(Boolean)
              .join(' - ')

            return (
              <YStack key={section.id || sectionIndex} gap="$2">
                {/* Section header */}
                <Text fontSize="$5" fontWeight="700" color="$red10">
                  {section.title}
                </Text>
                {sectionDateStr ? (
                  <Text fontSize="$4" color="$gray11">
                    {sectionDateStr}{timeRange ? `, ${timeRange}` : ''}
                  </Text>
                ) : null}
                {section.description ? (
                  <Text fontSize="$4" color="$gray11" fontStyle="italic">
                    {section.description}
                  </Text>
                ) : null}

                {/* Section location (if set) */}
                {(section.location?.name || section.location?.placeName || section.location?.address) ? (
                  <YStack gap="$1">
                    {(section.location.name || section.location.placeName) ? (
                      <Text fontSize="$4" fontWeight="500" color="$gray12">
                        {section.location.name || section.location.placeName}
                      </Text>
                    ) : null}
                    {section.location.address ? (
                      <XStack gap="$2" alignItems="center">
                        {section.location.mapsUrl ? (
                          <Text
                            cursor="pointer"
                            hoverStyle={{ opacity: 0.7 }}
                            onPress={() => {
                              if (typeof window !== 'undefined') {
                                window.open(section.location!.mapsUrl, '_blank')
                              }
                            }}
                          >
                            <MapPin size={16} color="$blue10" />
                          </Text>
                        ) : null}
                        <Text fontSize="$3" color="$gray11">
                          {section.location.address}
                        </Text>
                      </XStack>
                    ) : null}
                  </YStack>
                ) : null}

                {/* Section schedule items */}
                {section.items && section.items.length > 0 ? (
                  <YStack gap="$1" paddingLeft="$4">
                    {section.items.map((item, itemIndex) => {
                      let displayTime = ''
                      const timeValue = item.time || (item.startTime ? String(item.startTime) : undefined)
                      if (timeValue && typeof timeValue === 'string') {
                        if (timeValue.includes('T')) {
                          const date = new Date(timeValue)
                          const hours = date.getHours()
                          const minutes = date.getMinutes()
                          const ampm = hours >= 12 ? 'pm' : 'am'
                          const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
                          displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`
                        } else if (timeValue.includes('-')) {
                          displayTime = timeValue.split('-')[0].trim()
                        } else {
                          displayTime = timeValue
                        }
                      }

                      return (
                        <YStack key={itemIndex} gap="$1">
                          <Text fontSize="$4" color="$gray12">
                            {displayTime ? `${displayTime}  ` : ''}
                            {item.activity || ''}
                            {item.title ? ` ${item.title}` : ''}
                          </Text>
                          {item.location ? (
                            <YStack paddingLeft="$4">
                              <Text fontSize="$3" color="$gray11">
                                {typeof item.location === 'string' ? item.location : item.location.name}
                              </Text>
                            </YStack>
                          ) : null}
                        </YStack>
                      )
                    })}
                  </YStack>
                ) : null}

                {/* Separator between sections */}
                {sectionIndex < event.sections!.length - 1 ? (
                  <Separator marginVertical="$2" />
                ) : null}
              </YStack>
            )
          })}
        </YStack>
      ) : null}

      {/* Schedule - Clean format by day (flat schedule, used when no sections) */}
      {!(event.sections && event.sections.length > 0) && scheduleByDay ? (
        <YStack gap="$3">
          <Text fontSize="$5" fontWeight="600" color="$color">
            Schedule:
          </Text>
          {Object.entries(scheduleByDay).map(([dayLabel, items]) => {
            const showDayLabel = dayLabel !== 'Schedule'

            return (
              <YStack key={dayLabel} gap="$2">
                {showDayLabel ? (
                  <Text fontSize="$4" fontWeight="600" color="$red10">
                    {dayLabel}
                  </Text>
                ) : null}
                <YStack gap="$1" paddingLeft="$4">
                  {items.map((item, index) => {
                    let displayTime = ''
                    const timeValue = item.time || (item.startTime ? String(item.startTime) : undefined)

                    if (timeValue && typeof timeValue === 'string') {
                      if (timeValue.includes('T')) {
                        const date = new Date(timeValue)
                        const hours = date.getHours()
                        const minutes = date.getMinutes()
                        const ampm = hours >= 12 ? 'pm' : 'am'
                        const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
                        displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`
                      } else if (timeValue.includes('-')) {
                        displayTime = timeValue.split('-')[0].trim()
                      } else {
                        displayTime = timeValue
                      }
                    }

                    return (
                      <YStack key={index} gap="$1">
                        <Text fontSize="$4" color="$gray12">
                          {displayTime ? `${displayTime}  ` : ''}
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
            )
          })}
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

            {reg.required && reg.required !== 'false' ? (
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
              <YStack gap="$1">
                <Text fontSize="$4" color="$gray11" fontWeight="600">
                  Registration:
                </Text>
                <XStack gap="$2" alignItems="center" flexWrap="wrap">
                  <ExternalLink size={16} color="$blue10" />
                  <Text
                    fontSize="$4"
                    color="$blue10"
                    textDecorationLine="underline"
                    cursor="pointer"
                    onPress={() => window.open(reg.registrationUrl, '_blank')}
                  >
                    {reg.registrationUrl}
                  </Text>
                </XStack>
              </YStack>
            ) : null}

            {(reg.contactEmail || reg.contactPhone) ? (
              <YStack gap="$1">
                <Text fontSize="$4" color="$gray11" fontWeight="600">
                  For more information:
                </Text>
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

      {/* Parking Info - shown at bottom for study-weekend events */}
      {event.type === 'study-weekend' && (event as any).location && typeof (event as any).location !== 'string' && (event as any).location.parkingInfo ? (
        <YStack gap="$2" marginTop="$2">
          <Text fontSize="$3" color="$gray10" fontStyle="italic">
            Parking: {(event as any).location.parkingInfo}
          </Text>
        </YStack>
      ) : null}

      {/* Online Access - shown at bottom for study-weekend events */}
      {event.type === 'study-weekend' && (event as any).location && typeof (event as any).location !== 'string' ? (() => {
        const location = (event as any).location
        const mode = location.mode || 'in-person'
        const showOnline = mode === 'online' || mode === 'hybrid'

        if (!showOnline || !location.onlineMeeting) return null

        return (
          <YStack gap="$2" marginTop="$4">
            <Text fontSize="$5" fontWeight="600" color="$color">
              Online Info
            </Text>
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
        )
      })() : null}
    </YStack>
  )
}
