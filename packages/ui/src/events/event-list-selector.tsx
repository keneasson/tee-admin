import { Event, EventType } from '@my/app/types/events'
import {
  Pencil,
  Calendar,
  Church,
  Clock,
  User,
  MapPin,
  Eye,
  Plus,
  Mic,
} from '@tamagui/lucide-icons'
import { useState } from 'react'
import { Button, Card, Text, XStack, YStack, ScrollView, Circle, Input } from 'tamagui'

interface EventListSelectorProps {
  events: Event[]
  onSelect: (event: Event) => void
  onCreateNew: () => void
  isLoading?: boolean
}

function EventCard({ event, onSelect }: { event: Event; onSelect: (event: Event) => void }) {
  const getEventDateDisplay = (event: Event): string => {
    switch (event.type) {
      case 'study-weekend':
        if (event.dateRange) {
          const start = new Date(event.dateRange.start).toLocaleDateString()
          const end = new Date(event.dateRange.end).toLocaleDateString()
          return start === end ? start : `${start} - ${end}`
        }
        break
      case 'wedding':
        return event.ceremonyDate ? new Date(event.ceremonyDate).toLocaleDateString() : 'Date TBD'
      case 'baptism':
        return event.baptismDate ? new Date(event.baptismDate).toLocaleDateString() : 'Date TBD'
      case 'funeral':
        return event.serviceDate ? new Date(event.serviceDate).toLocaleDateString() : 'Date TBD'
      case 'general':
        return event.startDate ? new Date(event.startDate).toLocaleDateString() : 'Date TBD'
      case 'recurring':
        return event.recurringConfig?.startDate
          ? new Date(event.recurringConfig.startDate).toLocaleDateString() + ' (recurring)'
          : 'Date TBD'
    }
    return 'Date TBD'
  }

  const getEventSecondaryInfo = (event: Event): string => {
    switch (event.type) {
      case 'study-weekend':
        // Show both theme and speaker information
        const parts = []
        if (event.theme) parts.push(event.theme)
        if (event.speakers && event.speakers.length > 0) {
          const speakerNames = event.speakers
            .map((s) => `${s.firstName || ''} ${s.lastName || ''}`.trim())
            .filter(Boolean)
            .join(', ')
          if (speakerNames)
            parts.push(`Speaker${event.speakers.length > 1 ? 's' : ''}: ${speakerNames}`)
        }
        return parts.join(' • ')
      case 'wedding':
        if (event.couple) {
          const bride =
            `${event.couple.bride?.firstName || ''} ${event.couple.bride?.lastName || ''}`.trim()
          const groom =
            `${event.couple.groom?.firstName || ''} ${event.couple.groom?.lastName || ''}`.trim()
          return bride && groom ? `${bride} & ${groom}` : bride || groom || ''
        }
        break
      case 'baptism':
        if (event.candidate) {
          return `${event.candidate.firstName || ''} ${event.candidate.lastName || ''}`.trim()
        }
        break
      case 'funeral':
        if (event.deceased) {
          return `${event.deceased.firstName || ''} ${event.deceased.lastName || ''}`.trim()
        }
        break
    }
    return ''
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '$gray11'
      case 'published':
        return '$green11'
      case 'archived':
        return '$red11'
      default:
        return '$blue11'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '$gray8'
      case 'published':
        return '$green8'
      case 'archived':
        return '$red8'
      default:
        return '$blue8'
    }
  }

  const secondaryInfo = getEventSecondaryInfo(event)
  const dateDisplay = getEventDateDisplay(event)

  return (
    <Card
      padding="$4"
      borderWidth={1}
      borderColor="$borderColor"
      pressStyle={{ scale: 0.98, borderColor: '$blue8' }}
      hoverStyle={{ borderColor: '$blue6' }}
      onPress={() => onSelect(event)}
      cursor="pointer"
    >
      <YStack space="$3">
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1} space="$1">
            <XStack space="$2" alignItems="center">
              <Text fontSize="$5" fontWeight="600" flex={1}>
                {event.title || 'Untitled Event'}
              </Text>

              {/* Status badge */}
              <XStack
                paddingHorizontal="$2"
                paddingVertical="$1"
                backgroundColor={getStatusBadgeColor(event.status)}
                borderRadius="$2"
                alignItems="center"
              >
                <Text fontSize="$2" color={getStatusColor(event.status)} fontWeight="500">
                  {event.status}
                </Text>
              </XStack>
            </XStack>

            {/* Event type */}
            <Text fontSize="$3" color="$gray11" fontWeight="500">
              {event.type.replace('-', ' ').toUpperCase()}
            </Text>

            {/* Secondary info (names, theme, etc) */}
            {secondaryInfo && (
              <Text fontSize="$4" color="$color" marginTop="$1">
                {secondaryInfo}
              </Text>
            )}
          </YStack>

          {/* Action button */}
          <Button size="$3" variant="outlined" icon={Pencil}>
            Edit
          </Button>
        </XStack>

        <XStack space="$4" alignItems="center" flexWrap="wrap">
          <XStack space="$1" alignItems="center">
            <Calendar size="$1" color="$gray11" />
            <Text fontSize="$3" color="$gray11">
              {dateDisplay}
            </Text>
          </XStack>

          {(event.type === 'study-weekend' ||
            event.type === 'wedding' ||
            event.type === 'baptism' ||
            event.type === 'general') &&
            event.hostingEcclesia && (
              <XStack space="$1" alignItems="center">
                <Church size="$1" color="$gray11" />
                <Text fontSize="$3" color="$gray11">
                  {event.hostingEcclesia.name}
                  {event.hostingEcclesia.province && (
                    <Text color="$gray11"> {event.hostingEcclesia.province}</Text>
                  )}
                </Text>
              </XStack>
            )}

          {event.type === 'study-weekend' && event.speakers && event.speakers.length > 0 && (
            <XStack space="$1" alignItems="center">
              <Mic size="$1" color="$gray11" />
              <Text fontSize="$3" color="$gray11">
                {event.speakers.length} Speaker{event.speakers.length > 1 ? 's' : ''}
              </Text>
            </XStack>
          )}

          {(event as any).location?.name && (
            <XStack space="$1" alignItems="center">
              <MapPin size="$1" color="$gray11" />
              <Text fontSize="$3" color="$gray11">
                {(event as any).location.name}
              </Text>
            </XStack>
          )}
        </XStack>

        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$2" color="$gray11">
            Updated: {new Date(event.updatedAt).toLocaleDateString()}
          </Text>

          {event.published && (
            <XStack space="$1" alignItems="center">
              <Circle size="$0.5" backgroundColor="$green10" />
              <Text fontSize="$2" color="$green11" fontWeight="500">
                Published
              </Text>
            </XStack>
          )}
        </XStack>
      </YStack>
    </Card>
  )
}

export function EventListSelector({
  events,
  onSelect,
  onCreateNew,
  isLoading = false,
}: EventListSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<EventType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'archived'>(
    'all'
  )

  // Filter events based on search and filters
  const filteredEvents = events.filter((event) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      const matchesTitle = event.title.toLowerCase().includes(searchLower)
      const matchesDescription = event.description?.toLowerCase().includes(searchLower)

      // Type-specific search
      let matchesSpecific = false
      if (event.type === 'baptism' && event.candidate) {
        matchesSpecific = `${event.candidate.firstName} ${event.candidate.lastName}`
          .toLowerCase()
          .includes(searchLower)
      } else if (event.type === 'wedding' && event.couple) {
        const bride = `${event.couple.bride?.firstName || ''} ${event.couple.bride?.lastName || ''}`
        const groom = `${event.couple.groom?.firstName || ''} ${event.couple.groom?.lastName || ''}`
        matchesSpecific =
          bride.toLowerCase().includes(searchLower) || groom.toLowerCase().includes(searchLower)
      } else if (event.type === 'funeral' && event.deceased) {
        matchesSpecific = `${event.deceased.firstName} ${event.deceased.lastName}`
          .toLowerCase()
          .includes(searchLower)
      } else if (event.type === 'study-weekend') {
        // Search in theme and speaker names
        if (event.theme && event.theme.toLowerCase().includes(searchLower)) {
          matchesSpecific = true
        } else if (event.speakers) {
          matchesSpecific = event.speakers.some((speaker) => {
            const speakerName = `${speaker.firstName || ''} ${speaker.lastName || ''}`.toLowerCase()
            return speakerName.includes(searchLower)
          })
        }
      }

      if (!matchesTitle && !matchesDescription && !matchesSpecific) {
        return false
      }
    }

    // Type filter
    if (filterType !== 'all' && event.type !== filterType) {
      return false
    }

    // Status filter
    if (filterStatus !== 'all' && event.status !== filterStatus) {
      return false
    }

    return true
  })

  // Group events by status for better organization
  const draftEvents = filteredEvents.filter((e) => e.status === 'draft')
  const publishedEvents = filteredEvents.filter((e) => e.status === 'published')
  const otherEvents = filteredEvents.filter((e) => e.status !== 'draft' && e.status !== 'published')

  return (
    <YStack space="$4">
      {/* Search and Filters */}
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <YStack space="$3">
          <Text fontSize="$5" fontWeight="600">
            Search & Filter
          </Text>

          <XStack space="$3" flexWrap="wrap">
            <YStack flex={1} minWidth="200">
              <Input
                placeholder="Search by title, names, theme, speakers..."
                value={searchTerm}
                onChangeText={setSearchTerm}
                size="$4"
              />
            </YStack>

            <Button
              variant={filterType === 'all' ? 'solid' : 'outlined'}
              onPress={() => setFilterType('all')}
              size="$3"
            >
              All Types
            </Button>
            <Button
              variant={filterType === 'study-weekend' ? 'solid' : 'outlined'}
              onPress={() => setFilterType('study-weekend')}
              size="$3"
            >
              Study Weekend
            </Button>
            <Button
              variant={filterType === 'baptism' ? 'solid' : 'outlined'}
              onPress={() => setFilterType('baptism')}
              size="$3"
            >
              Baptism
            </Button>
            <Button
              variant={filterType === 'wedding' ? 'solid' : 'outlined'}
              onPress={() => setFilterType('wedding')}
              size="$3"
            >
              Wedding
            </Button>
          </XStack>

          <XStack space="$2">
            <Button
              variant={filterStatus === 'all' ? 'solid' : 'outlined'}
              onPress={() => setFilterStatus('all')}
              size="$3"
            >
              All Status
            </Button>
            <Button
              variant={filterStatus === 'draft' ? 'solid' : 'outlined'}
              onPress={() => setFilterStatus('draft')}
              size="$3"
            >
              Drafts
            </Button>
            <Button
              variant={filterStatus === 'published' ? 'solid' : 'outlined'}
              onPress={() => setFilterStatus('published')}
              size="$3"
            >
              Published
            </Button>
          </XStack>
        </YStack>
      </Card>

      {/* Event List */}
      {isLoading ? (
        <Card padding="$8" borderWidth={1} borderColor="$borderColor">
          <Text textAlign="center" color="$gray11">
            Loading events...
          </Text>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card padding="$8" borderWidth={1} borderColor="$borderColor">
          <YStack space="$3" alignItems="center">
            <Text fontSize="$5" fontWeight="600">
              No events found
            </Text>
            <Text color="$gray11" textAlign="center">
              {searchTerm || filterType !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Use the "Create Event" tab above to get started'}
            </Text>
          </YStack>
        </Card>
      ) : (
        <YStack space="$4">
          {/* Draft Events Section */}
          {draftEvents.length > 0 && (
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Circle size="$1" backgroundColor="$gray8" />
                <Text fontSize="$5" fontWeight="600" color="$gray11">
                  Draft Events ({draftEvents.length})
                </Text>
              </XStack>
              <ScrollView maxHeight="400">
                <YStack space="$3">
                  {draftEvents.map((event) => (
                    <EventCard key={event.id} event={event} onSelect={onSelect} />
                  ))}
                </YStack>
              </ScrollView>
            </YStack>
          )}

          {/* Published Events Section */}
          {publishedEvents.length > 0 && (
            <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Circle size="$1" backgroundColor="$green8" />
                <Text fontSize="$5" fontWeight="600" color="$green11">
                  Published Events ({publishedEvents.length})
                </Text>
              </XStack>
              <ScrollView maxHeight="400">
                <YStack space="$3">
                  {publishedEvents.map((event) => (
                    <EventCard key={event.id} event={event} onSelect={onSelect} />
                  ))}
                </YStack>
              </ScrollView>
            </YStack>
          )}

          {/* Other Events Section */}
          {otherEvents.length > 0 && (
            <YStack space="$3">
              <Text fontSize="$5" fontWeight="600">
                Other Events ({otherEvents.length})
              </Text>
              <ScrollView maxHeight="400">
                <YStack space="$3">
                  {otherEvents.map((event) => (
                    <EventCard key={event.id} event={event} onSelect={onSelect} />
                  ))}
                </YStack>
              </ScrollView>
            </YStack>
          )}
        </YStack>
      )}
    </YStack>
  )
}
