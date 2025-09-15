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
      pressStyle={onPress ? { scale: 0.98, opacity: 0.8 } : undefined}
      onPress={onPress}
      animation="quick"
    >
      <YStack gap={isCompact ? "$2" : "$3"}>
        {/* Event Type Badge */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Square
              size={isCompact ? "$0.5" : "$1"}
              backgroundColor={event.featured ? '$yellow10' : '$blue10'}
              borderRadius="$2"
              padding="$1"
            >
              <Text fontSize={isCompact ? "$1" : "$2"} color="white" fontWeight="600">
                {event.type?.replace('-', ' ').toUpperCase()}
              </Text>
            </Square>
            {event.featured && !isCompact && (
              <Text fontSize="$2" color="$yellow10" fontWeight="600">
                FEATURED
              </Text>
            )}
          </XStack>
          {!isNewsletter && (
            <Text fontSize="$2" color="$gray10">
              {event.status || 'DRAFT'}
            </Text>
          )}
        </XStack>

        {/* Title with optional theme */}
        <H3 fontSize={isCompact ? "$5" : "$6"} fontWeight="700" color="$color">
          {event.title || 'Untitled Event'}
          {event.theme && ` - ${event.theme}`}
        </H3>

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
            // Fallback to startDate/endDate for any event type
            else if (event.startDate) {
              const startDate = new Date(event.startDate)
              const endDate = event.endDate ? new Date(event.endDate) : null
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
          {event.type === 'study-weekend' && event.speakers && event.speakers.length > 0 && (
            <Text fontSize="$4" color="$gray11">
              Speaker{event.speakers.length > 1 ? 's' : ''}: {
                event.speakers
                  .map(speaker => `${speaker.firstName || ''} ${speaker.lastName || ''}`.trim())
                  .filter(Boolean)
                  .join(', ')
              }
            </Text>
          )}

          {/* Names for other event types */}
          {event.type === 'wedding' && event.couple && (
            <Text fontSize="$4" color="$gray11">
              {(() => {
                const bride = `${event.couple.bride?.firstName || ''} ${event.couple.bride?.lastName || ''}`.trim()
                const groom = `${event.couple.groom?.firstName || ''} ${event.couple.groom?.lastName || ''}`.trim()
                return bride && groom ? `${bride} & ${groom}` : bride || groom || ''
              })()}
            </Text>
          )}

          {event.type === 'baptism' && event.candidate && (
            <Text fontSize="$4" color="$gray11">
              {`${event.candidate.firstName || ''} ${event.candidate.lastName || ''}`.trim()}
            </Text>
          )}

          {event.type === 'funeral' && event.deceased && (
            <Text fontSize="$4" color="$gray11">
              {`${event.deceased.firstName || ''} ${event.deceased.lastName || ''}`.trim()}
            </Text>
          )}

          {/* Hosting Ecclesia Location */}
          {event.hostingEcclesia && (
            <Text fontSize="$4" color="$gray11">
              {typeof event.hostingEcclesia === 'string' 
                ? event.hostingEcclesia 
                : event.hostingEcclesia.name || formatLocation(event.hostingEcclesia)}
            </Text>
          )}
        </YStack>

        {/* Description Preview */}
        {event.description && !isCompact && (
          <Text 
            fontSize="$3" 
            color="$gray11" 
            numberOfLines={isNewsletter ? 3 : 2}
          >
            {event.description}
          </Text>
        )}

        {/* Action Link */}
        {onPress && (
          <XStack>
            <Text fontSize="$3" color="$blue10" fontWeight="600">
              {isNewsletter ? 'View Details →' : 'Learn More →'}
            </Text>
          </XStack>
        )}
      </YStack>
    </Card>
  )
}