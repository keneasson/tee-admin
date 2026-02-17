import { Event, EventType, isEventActive } from '@my/app/types/events'
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
  Trash,
} from '@tamagui/lucide-icons'
import { useState, useEffect } from 'react'
import { Button, Card, Text, XStack, YStack, ScrollView, Circle, Input, Dialog, Sheet, AnimatePresence } from 'tamagui'
import { brandColors } from '@my/ui/src/branding/brand-colors'

interface EventListSelectorProps {
  events: Event[]
  onSelect: (event: Event) => void
  onCreateNew: () => void
  onPreview?: (event: Event) => void
  onDelete?: (event: Event) => void
  isLoading?: boolean
}

function EventCard({ event, onSelect, onPreview, onDelete, isDeleting }: { event: Event; onSelect: (event: Event) => void; onPreview?: (event: Event) => void; onDelete?: (event: Event) => void; isDeleting?: boolean }) {
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
        const startDate = event.recurringConfig?.startDate || event.recurringConfig?.dateRange?.start
        if (startDate) {
          const endDate = event.recurringConfig?.endDate || event.recurringConfig?.dateRange?.end
          const formattedStart = new Date(startDate).toLocaleDateString()
          
          // Get frequency info
          const frequency = event.recurringConfig?.frequency
          const daysOfWeek = event.recurringConfig?.daysOfWeek || []
          
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
          } else if (frequency === 'custom') {
            frequencyText = 'custom dates'
          }
          
          if (endDate) {
            const formattedEnd = new Date(endDate).toLocaleDateString()
            return `${formattedStart} - ${formattedEnd} (${frequencyText})`
          }
          return `${formattedStart} (${frequencyText})`
        }
        return 'Date TBD'
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

  // Use new active field with legacy fallback
  const active = isEventActive(event)

  const getStatusColor = () => {
    if (active) return '$green11'
    if (event.status === 'archived') return '$red11'
    return '$orange11' // Inactive/draft
  }

  const getStatusBadgeColor = () => {
    if (active) return '$green3'
    if (event.status === 'archived') return '$red3'
    return '$orange3' // Inactive/draft
  }

  const getStatusDisplayName = () => {
    if (active) return 'Active'
    if (event.status === 'archived') return 'Archived'
    return 'Inactive'
  }

  const secondaryInfo = getEventSecondaryInfo(event)
  const dateDisplay = getEventDateDisplay(event)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false)
    // Trigger the parent's delete handler which will set isDeleting
    onDelete?.(event)
  }

  return (
    <Card
      padding="$4"
      borderWidth={1}
      borderColor="$borderColor"
      animation="quick"
      opacity={isDeleting ? 0 : 1}
      height={isDeleting ? 0 : 'auto'}
      overflow="hidden"
      marginVertical={isDeleting ? 0 : '$2'}
      scale={isDeleting ? 0.95 : 1}
      enterStyle={{
        opacity: 0,
        height: 0,
        scale: 0.95,
      }}
      exitStyle={{
        opacity: 0,
        height: 0,
        scale: 0.95,
      }}
    >
      <YStack>
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1} space="$1">
            <Text fontSize="$5" fontWeight="600">
              {event.title || 'Untitled Event'}
            </Text>

            {/* Event type */}
            <Text fontSize="$3" color="$gray11" fontWeight="500">
              {event.type.replace('-', ' ').toUpperCase()}
            </Text>

            {/* Secondary info (names, theme, etc) */}
            {secondaryInfo ? <Text fontSize="$4" color="$color" marginTop="$1">
                {secondaryInfo}
              </Text> : null}
          </YStack>

          {/* Status badge and Action buttons aligned */}
          <XStack space="$2" alignItems="center">
            {/* Status badge */}
            <XStack
              paddingHorizontal="$2"
              paddingVertical="$1"
              backgroundColor={getStatusBadgeColor()}
              borderRadius="$2"
              alignItems="center"
            >
              <Text fontSize="$2" color={getStatusColor()} fontWeight="500">
                {getStatusDisplayName()}
              </Text>
            </XStack>
            
            {/* Action buttons */}
            {onPreview ? <Button
                size="$3"
                chromeless
                icon={Eye}
                borderWidth={2}
                borderColor="$textTertiary"
                onPress={() => onPreview(event)}
              >
                Preview
              </Button> : null}
            <Button 
              size="$3" 
              variant="outlined" 
              icon={Pencil}
              borderWidth={2}
              borderColor="$textTertiary"
              onPress={() => onSelect(event)}
            >
              Edit
            </Button>
            {onDelete ? <Button 
                size="$3" 
                icon={Trash}
                borderWidth={2}
                borderColor={brandColors.light.error}
                backgroundColor={brandColors.light.error}
                color="white"
                hoverStyle={{
                  backgroundColor: brandColors.light.error,
                  opacity: 0.9
                }}
                onPress={() => setShowDeleteConfirm(true)}
              >
                Delete
              </Button> : null}
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
          <XStack space="$4" alignItems="center" flexWrap="wrap" flex={1}>
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
            event.hostingEcclesia ? <XStack space="$1" alignItems="center">
                <Church size="$1" color="$gray11" />
                <Text fontSize="$3" color="$gray11">
                  {event.hostingEcclesia.name}
                  {event.hostingEcclesia.province ? `, ${event.hostingEcclesia.province}` : ''}
                </Text>
              </XStack> : null}

          {event.type === 'study-weekend' && event.speakers && event.speakers.length > 0 ? <XStack space="$1" alignItems="center">
              <Mic size="$1" color="$gray11" />
              <Text fontSize="$3" color="$gray11">
                {event.speakers.length} Speaker{event.speakers.length > 1 ? 's' : ''}
              </Text>
            </XStack> : null}

          {(event as any).location?.name ? <XStack space="$1" alignItems="center">
              <MapPin size="$1" color="$gray11" />
              <Text fontSize="$3" color="$gray11">
                {(event as any).location.name}
              </Text>
            </XStack> : null}
          </XStack>
        </XStack>

        <XStack justifyContent="space-between" alignItems="center" marginTop="$2">
          <Text fontSize="$2" color="$gray11">
            Created: {new Date(event.createdAt).toLocaleDateString()}
          </Text>

          {active ? <XStack space="$1" alignItems="center">
              <Circle size="$0.5" backgroundColor="$green10" />
              <Text fontSize="$2" color="$green11" fontWeight="500">
                Live
              </Text>
            </XStack> : null}
        </XStack>
      </YStack>
      
      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="quick"
            o={0.5}
            enterStyle={{ o: 0 }}
            exitStyle={{ o: 0 }}
          />
          <Dialog.Content
            key="content"
            bordered
            elevate
            animation="quick"
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            space
          >
            <Dialog.Title fontSize="$6" fontWeight="600">
              Confirm Deletion
            </Dialog.Title>
            <Dialog.Description fontSize="$4" color="$gray11">
              Are you sure you wish to delete the event "{event.title || 'Untitled Event'}", this cannot be undone
            </Dialog.Description>
            
            <XStack space="$3" justifyContent="flex-end" marginTop="$4">
              <Dialog.Close asChild>
                <Button 
                  variant="outlined"
                  borderWidth={2}
                  borderColor="$textTertiary"
                >
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                backgroundColor={brandColors.light.error}
                color="white"
                borderWidth={2}
                borderColor={brandColors.light.error}
                hoverStyle={{
                  backgroundColor: brandColors.light.error,
                  opacity: 0.9
                }}
                onPress={handleConfirmDelete}
              >
                Delete Event
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Card>
  )
}

export function EventListSelector({
  events,
  onSelect,
  onCreateNew,
  onPreview,
  onDelete,
  isLoading = false,
}: EventListSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<EventType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'archived'>(
    'all'
  )
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)

  // Pagination - show 10 events at a time per section
  const EVENTS_PER_PAGE = 10
  const [draftVisible, setDraftVisible] = useState(EVENTS_PER_PAGE)
  const [publishedVisible, setPublishedVisible] = useState(EVENTS_PER_PAGE)
  const [otherVisible, setOtherVisible] = useState(EVENTS_PER_PAGE)

  // Reset pagination when filters change
  useEffect(() => {
    setDraftVisible(EVENTS_PER_PAGE)
    setPublishedVisible(EVENTS_PER_PAGE)
    setOtherVisible(EVENTS_PER_PAGE)
  }, [searchTerm, filterType, filterStatus])

  // Handle delete with animation
  const handleDelete = (event: Event) => {
    // Start the collapse animation
    setDeletingEventId(event.id)

    // Wait for animation to complete (400ms for "medium" animation), then actually delete
    setTimeout(() => {
      onDelete?.(event)
      setDeletingEventId(null)
    }, 400)
  }

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

  // Sort events by createdAt descending (newest first) - per user request
  const sortByDate = (a: Event, b: Event) => {
    const dateA = new Date(a.createdAt).getTime()
    const dateB = new Date(b.createdAt).getTime()
    return dateB - dateA // Descending order (newest first)
  }

  // Group events by active state for better organization, sorted by date descending (newest first)
  // Use isEventActive helper for backward compatibility with legacy status field
  const inactiveEvents = filteredEvents.filter((e) => !isEventActive(e) && e.status !== 'archived').sort(sortByDate)
  const activeEvents = filteredEvents.filter((e) => isEventActive(e)).sort(sortByDate)
  const archivedEvents = filteredEvents.filter((e) => e.status === 'archived').sort(sortByDate)

  // Paginated views - show only up to the visible count
  const visibleInactiveEvents = inactiveEvents.slice(0, draftVisible)
  const visibleActiveEvents = activeEvents.slice(0, publishedVisible)
  const visibleArchivedEvents = archivedEvents.slice(0, otherVisible)

  // Check if there are more events to load
  const hasMoreInactive = inactiveEvents.length > draftVisible
  const hasMoreActive = activeEvents.length > publishedVisible
  const hasMoreArchived = archivedEvents.length > otherVisible

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
              variant={filterType === 'all' ? undefined : 'outlined'}
              onPress={() => setFilterType('all')}
              size="$3"
            >
              All Types
            </Button>
            <Button
              variant={filterType === 'study-weekend' ? undefined : 'outlined'}
              onPress={() => setFilterType('study-weekend')}
              size="$3"
            >
              Study Weekend
            </Button>
            <Button
              variant={filterType === 'baptism' ? undefined : 'outlined'}
              onPress={() => setFilterType('baptism')}
              size="$3"
            >
              Baptism
            </Button>
            <Button
              variant={filterType === 'wedding' ? undefined : 'outlined'}
              onPress={() => setFilterType('wedding')}
              size="$3"
            >
              Wedding
            </Button>
          </XStack>

          <XStack space="$2">
            <Button
              variant={filterStatus === 'all' ? undefined : 'outlined'}
              onPress={() => setFilterStatus('all')}
              size="$3"
            >
              All Status
            </Button>
            <Button
              variant={filterStatus === 'published' ? undefined : 'outlined'}
              onPress={() => setFilterStatus('published')}
              size="$3"
            >
              Active
            </Button>
            <Button
              variant={filterStatus === 'draft' ? undefined : 'outlined'}
              onPress={() => setFilterStatus('draft')}
              size="$3"
            >
              Inactive
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
          {/* Active Events Section */}
          {activeEvents.length > 0 ? <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Circle size="$1" backgroundColor="$green8" />
                <Text fontSize="$5" fontWeight="600" color="$green11">
                  Active Events ({activeEvents.length})
                </Text>
              </XStack>
              <YStack space="$3">
                {visibleActiveEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={onSelect}
                    onPreview={onPreview}
                    onDelete={handleDelete}
                    isDeleting={deletingEventId === event.id}
                  />
                ))}
                {hasMoreActive ? (
                  <Button
                    variant="outlined"
                    onPress={() => setPublishedVisible((prev) => prev + EVENTS_PER_PAGE)}
                    alignSelf="center"
                  >
                    Load More ({activeEvents.length - publishedVisible} remaining)
                  </Button>
                ) : null}
              </YStack>
            </YStack> : null}

          {/* Inactive Events Section */}
          {inactiveEvents.length > 0 ? <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Circle size="$1" backgroundColor="$gray8" />
                <Text fontSize="$5" fontWeight="600" color="$gray11">
                  Inactive Events ({inactiveEvents.length})
                </Text>
              </XStack>
              <YStack space="$3">
                {visibleInactiveEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={onSelect}
                    onPreview={onPreview}
                    onDelete={handleDelete}
                    isDeleting={deletingEventId === event.id}
                  />
                ))}
                {hasMoreInactive ? (
                  <Button
                    variant="outlined"
                    onPress={() => setDraftVisible((prev) => prev + EVENTS_PER_PAGE)}
                    alignSelf="center"
                  >
                    Load More ({inactiveEvents.length - draftVisible} remaining)
                  </Button>
                ) : null}
              </YStack>
            </YStack> : null}

          {/* Archived Events Section */}
          {archivedEvents.length > 0 ? <YStack space="$3">
              <XStack space="$2" alignItems="center">
                <Circle size="$1" backgroundColor="$red8" />
                <Text fontSize="$5" fontWeight="600" color="$red11">
                  Archived Events ({archivedEvents.length})
                </Text>
              </XStack>
              <YStack space="$3">
                {visibleArchivedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={onSelect}
                    onPreview={onPreview}
                    onDelete={handleDelete}
                    isDeleting={deletingEventId === event.id}
                  />
                ))}
                {hasMoreArchived ? (
                  <Button
                    variant="outlined"
                    onPress={() => setOtherVisible((prev) => prev + EVENTS_PER_PAGE)}
                    alignSelf="center"
                  >
                    Load More ({archivedEvents.length - otherVisible} remaining)
                  </Button>
                ) : null}
              </YStack>
            </YStack> : null}
        </YStack>
      )}
    </YStack>
  )
}
