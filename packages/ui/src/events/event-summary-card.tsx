'use client'

import { Card, YStack, XStack, Text, H3, Square } from 'tamagui'
import { Calendar, MapPin, Users } from '@tamagui/lucide-icons'
import { Event } from '@my/app/types/events'
import { formatDate, formatLocation } from './event-utils'

interface EventSummaryCardProps {
  event: Partial<Event>
  onPress?: () => void
  variant?: 'default' | 'compact' | 'newsletter'
  /** User role passed from platform-specific auth (Next.js or Expo) */
  userRole?: string
  /** Whether user is member or higher, passed from platform-specific auth */
  isMemberOrHigher?: boolean
}

/**
 * Reusable Event Summary Card component
 * Used in: Event lists, Newsletter, Preview modal, Search results
 */
export function EventSummaryCard({
  event,
  onPress,
  variant = 'default',
  userRole,
  isMemberOrHigher = false
}: EventSummaryCardProps) {
  const isCompact = variant === 'compact'
  const isNewsletter = variant === 'newsletter'

  // Debug log in development
  if (process.env.NODE_ENV === 'development' && isNewsletter) {
    console.log(`📰 Newsletter card for "${event.title}": variant=${variant}, isNewsletter=${isNewsletter}`)
  }

  return (
    <Card
      elevate={!isNewsletter}
      bordered
      padding={isCompact ? "$3" : "$4"}
      borderRadius="$4"
      backgroundColor="$background"
    >
      <YStack gap={isCompact ? "$2" : "$3"}>
        {/* Title with optional theme - Move to top for newsletter */}
        <XStack gap="$2" alignItems="center">
          <H3 fontSize={isCompact ? "$5" : "$6"} fontWeight="700" color="$color">
            {event.title || 'Untitled Event'}{event.theme ? ` - ${event.theme}` : ''}
          </H3>
          {event.membersOnly && (
            <Users size={20} color="$green10" />
          )}
        </XStack>

        {/* Event Type Badge - Show only for non-newsletter views */}
        {!isNewsletter && (
          <XStack justifyContent="space-between" alignItems="center">
            <XStack gap="$2" alignItems="center">
              <Square
                size={isCompact ? "$0.5" : "$1"}
                backgroundColor={event.featured ? '$yellow10' : '$blue10'}
                borderRadius="$2"
                padding="$1"
              >
                <Text fontSize={isCompact ? "$1" : "$2"} color="white" fontWeight="600">
                  {event.type?.replace('-', ' ').toUpperCase() || 'EVENT'}
                </Text>
              </Square>
              {event.featured && !isCompact ? (
                <Text fontSize="$2" color="$yellow10" fontWeight="600">
                  FEATURED
                </Text>
              ) : null}
            </XStack>
            {event.status ? (
              <Text fontSize="$2" color="$gray10">
                {event.status}
              </Text>
            ) : null}
          </XStack>
        )}

        {/* Formatted Event Info */}
        <YStack gap="$1">
          {/* Date Range - Check all possible date fields */}
          {(() => {
            let dateText = null
            
            // For study weekends - check dateRange first, then startDate/endDate
            if (event.type === 'study-weekend' && event.dateRange) {
              const startDate = new Date(event.dateRange.start)
              const endDate = new Date(event.dateRange.end)
              const startStr = startDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })
              
              if (endDate.getTime() !== startDate.getTime()) {
                const endStr = endDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })
                dateText = `${startStr} to ${endStr} ${startDate.getFullYear()}`
              } else {
                dateText = `${startStr} ${startDate.getFullYear()}`
              }
            } 
            // For weddings
            else if (event.type === 'wedding' && event.ceremonyDate) {
              const date = new Date(event.ceremonyDate)
              dateText = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })
            }
            // For baptisms
            else if (event.type === 'baptism' && event.baptismDate) {
              const date = new Date(event.baptismDate)
              dateText = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })
            }
            // For funerals
            else if (event.type === 'funeral' && event.serviceDate) {
              const date = new Date(event.serviceDate)
              dateText = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })
            }
            // For recurring events
            else if (event.type === 'recurring' && (event as any).recurringConfig) {
              const config = (event as any).recurringConfig
              const startDate = config.startDate || config.dateRange?.start
              const endDate = config.endDate || config.dateRange?.end
              
              if (startDate) {
                const start = new Date(startDate)
                const startStr = start.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })
                
                // Get frequency info
                const frequency = config.frequency
                const daysOfWeek = config.daysOfWeek || []
                
                let frequencyText = 'recurring'
                if (frequency === 'weekly' && daysOfWeek.length > 0) {
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  const selectedDays = daysOfWeek.map((d: number) => dayNames[d]).join(', ')
                  frequencyText = `every ${selectedDays}`
                } else if (frequency === 'biweekly' && daysOfWeek.length > 0) {
                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                  const selectedDays = daysOfWeek.map((d: number) => dayNames[d]).join(', ')
                  frequencyText = `bi-weekly ${selectedDays}`
                } else if (frequency === 'monthly') {
                  frequencyText = 'monthly'
                } else if ((frequency as any) === 'custom') {
                  frequencyText = 'custom dates'
                }
                
                if (endDate) {
                  const end = new Date(endDate)
                  const endStr = end.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })
                  dateText = `${startStr} to ${endStr} ${start.getFullYear()} (${frequencyText})`
                } else {
                  dateText = `${startStr} ${start.getFullYear()} (${frequencyText})`
                }
              }
            }
            // Fallback to startDate/endDate for general events and others
            else if ((event as any).startDate) {
              const startDate = new Date((event as any).startDate)
              const endDate = (event as any).endDate ? new Date((event as any).endDate) : null

              // Check if it's a one-day event
              const isSameDay = !endDate || (
                startDate.getDate() === endDate.getDate() &&
                startDate.getMonth() === endDate.getMonth() &&
                startDate.getFullYear() === endDate.getFullYear()
              )

              if (isSameDay) {
                // One-day event: Show date + time (e.g., "Oct 29, 2025 8:00pm")
                const hasTime = startDate.getHours() !== 0 || startDate.getMinutes() !== 0

                if (hasTime) {
                  const hours = startDate.getHours()
                  const minutes = startDate.getMinutes()
                  const ampm = hours >= 12 ? 'pm' : 'am'
                  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
                  const timeStr = `${displayHours}:${minutes.toString().padStart(2, '0')}${ampm}`

                  dateText = startDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  }) + ` ${timeStr}`
                } else {
                  dateText = startDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                }
              } else {
                // Multi-day event: Show date range only (e.g., "Oct 29 - Nov 2")
                const startStr = startDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })
                const endStr = endDate!.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                })
                dateText = `${startStr} - ${endStr}`
              }
            }
            
            return dateText && (
              <Text fontSize="$4" color="$gray11">
                {dateText}
              </Text>
            )
          })()}

          {/* Speaker(s) - for study weekends */}
          {event.type === 'study-weekend' && event.speakers && event.speakers.length > 0 && (() => {
            const speakerNames = event.speakers
              .map(speaker => `${speaker.firstName || ''} ${speaker.lastName || ''}`.trim())
              .filter(Boolean)
              .join(', ')
            return speakerNames && (
              <Text fontSize="$4" color="$gray11">
                Speaker{event.speakers.length > 1 ? 's' : ''}: {speakerNames}
              </Text>
            )
          })()}

          {/* Names for other event types */}
          {event.type === 'wedding' && event.couple && (() => {
            const bride = `${event.couple.bride?.firstName || ''} ${event.couple.bride?.lastName || ''}`.trim()
            const groom = `${event.couple.groom?.firstName || ''} ${event.couple.groom?.lastName || ''}`.trim()
            const coupleText = bride && groom ? `${bride} & ${groom}` : bride || groom
            return coupleText && (
              <Text fontSize="$4" color="$gray11">
                {coupleText}
              </Text>
            )
          })()}

          {event.type === 'baptism' && event.candidate && (() => {
            const candidateName = `${event.candidate.firstName || ''} ${event.candidate.lastName || ''}`.trim()
            return candidateName && (
              <Text fontSize="$4" color="$gray11">
                {candidateName}
              </Text>
            )
          })()}

          {event.type === 'funeral' && event.deceased && (() => {
            const deceasedName = `${event.deceased.firstName || ''} ${event.deceased.lastName || ''}`.trim()
            return deceasedName && (
              <Text fontSize="$4" color="$gray11">
                {deceasedName}
              </Text>
            )
          })()}

          {/* Location - for general events and others */}
          {(event.type === 'general' || event.type === 'study-weekend') && (event as any).location && (() => {
            const location = (event as any).location

            // Handle string location (legacy)
            if (typeof location === 'string') {
              return (
                <Text fontSize="$4" color="$gray11">
                  Location: {location}
                </Text>
              )
            }

            // Handle object location with mode
            const mode = location.mode || 'in-person'
            const locationName = location.name
            const platform = location.onlineMeeting?.platform

            if (mode === 'in-person' && locationName) {
              return (
                <Text fontSize="$4" color="$gray11">
                  Location: {locationName}
                </Text>
              )
            } else if (mode === 'online' && platform) {
              return (
                <Text fontSize="$4" color="$gray11">
                  Hosted on {platform}
                </Text>
              )
            } else if (mode === 'hybrid' && (locationName || platform)) {
              const parts = []
              if (locationName) parts.push(`Location: ${locationName}`)
              if (platform) parts.push(`on ${platform}`)
              return (
                <Text fontSize="$4" color="$gray11">
                  {parts.join(' & ')}
                </Text>
              )
            }

            return null
          })()}

          {/* Hosting Ecclesia */}
          {(event as any).hostingEcclesia && (() => {
            const hostingEcclesia = (event as any).hostingEcclesia
            const ecclesiaText = typeof hostingEcclesia === 'string'
              ? hostingEcclesia
              : hostingEcclesia.name || formatLocation(hostingEcclesia)
            return ecclesiaText && (
              <Text fontSize="$4" color="$gray11">
                Host: {ecclesiaText}
              </Text>
            )
          })()}
        </YStack>

        {/* Description Preview */}
        {event.description && !isCompact ? (
          <Text 
            fontSize="$3" 
            color="$gray11" 
            numberOfLines={isNewsletter ? 3 : 2}
          >
            {event.description}
          </Text>
        ) : null}

        {/* Action Link */}
        {onPress ? (
          <XStack>
            {event.membersOnly && !userRole ? (
              // Not signed in
              <Text fontSize="$3" color="$gray11">
                Please Sign in to View
              </Text>
            ) : event.membersOnly && !isMemberOrHigher ? (
              // Signed in but not a member/admin/owner (guest only)
              <Text fontSize="$3" color="$gray11">
                For Toronto East Ecclesia members only
              </Text>
            ) : (
              // Normal access (no restriction OR user is member/admin/owner)
              <Text
                fontSize="$3"
                color="$blue10"
                fontWeight="600"
                onPress={onPress}
                cursor="pointer"
                textDecorationLine="none"
                hoverStyle={{ textDecorationLine: "underline" }}
              >
                {isNewsletter ? 'View Details →' : 'Learn More →'}
              </Text>
            )}
          </XStack>
        ) : null}
      </YStack>
    </Card>
  )
}