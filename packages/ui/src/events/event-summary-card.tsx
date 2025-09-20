import { Card, YStack, XStack, Text, H3, Square } from 'tamagui'
import { Calendar, MapPin, Users } from '@tamagui/lucide-icons'
import { Event } from '@my/app/types/events'
import { formatDate, formatLocation } from './event-utils'

interface EventSummaryCardProps {
  event: Partial<Event>
  onPress?: () => void
  variant?: 'default' | 'compact' | 'newsletter'
}

/**
 * Reusable Event Summary Card component
 * Used in: Event lists, Newsletter, Preview modal, Search results
 */
export function EventSummaryCard({ 
  event, 
  onPress,
  variant = 'default' 
}: EventSummaryCardProps) {
  const isCompact = variant === 'compact'
  const isNewsletter = variant === 'newsletter'

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
        <H3 fontSize={isCompact ? "$5" : "$6"} fontWeight="700" color="$color">
          {event.title || 'Untitled Event'}{event.theme ? ` - ${event.theme}` : ''}
        </H3>

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
            // Fallback to startDate/endDate for any event type
            else if ((event as any).startDate) {
              const startDate = new Date((event as any).startDate)
              const endDate = (event as any).endDate ? new Date((event as any).endDate) : null
              const startStr = startDate.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })
              
              if (endDate && endDate.getTime() !== startDate.getTime()) {
                const endStr = endDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })
                dateText = `${startStr} to ${endStr} ${startDate.getFullYear()}`
              } else {
                dateText = `${startStr} ${startDate.getFullYear()}`
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

          {/* Hosting Ecclesia Location */}
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
          </XStack>
        ) : null}
      </YStack>
    </Card>
  )
}