import { YStack, XStack, Text, H2, H4, Separator, Square, Card, Button } from 'tamagui'
import { Download } from '@tamagui/lucide-icons'
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
}

/**
 * Reusable Event Detail View component
 * Used in: Event detail pages, Preview modal, Admin views
 */
export function EventDetailView({ event, showAdminInfo = false }: EventDetailViewProps) {
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
      if ((event as any).endDate && (event as any).endDate !== (event as any).startDate) {
        const end = new Date((event as any).endDate)

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
      }
      return start.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
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

  return (
    <YStack gap="$4">
      {/* Clean Header */}
      <YStack gap="$2">
        <H2 fontSize="$8" fontWeight="700" color="$color">
          {event.title || 'Untitled Event'}
        </H2>
        {dateRange ? (
          <Text fontSize="$5" color="$gray11">
            {dateRange}
          </Text>
        ) : null}
      </YStack>

      <Separator />

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

        {event.type === 'baptism' && event.candidate ? (
          <Text fontSize="$4" color="$gray11">
            Candidate:{' '}
            {(() => {
              const firstName = event.candidate.firstName || ''
              const lastName = event.candidate.lastName || ''
              const fullName = `${firstName} ${lastName}`.trim()
              return fullName || 'TBA'
            })()}
          </Text>
        ) : null}

        {event.type === 'funeral' && event.deceased ? (
          <Text fontSize="$4" color="$gray11">
            Memorial for:{' '}
            {(() => {
              const firstName = event.deceased.firstName || ''
              const lastName = event.deceased.lastName || ''
              const fullName = `${firstName} ${lastName}`.trim()
              return fullName || 'Beloved Brother/Sister'
            })()}
          </Text>
        ) : null}
      </YStack>

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
                  Download Flyer
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
