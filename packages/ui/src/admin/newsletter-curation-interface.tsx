import React, { useState, useEffect, useCallback } from 'react'
import { 
  YStack, 
  XStack, 
  Card, 
  Text, 
  Button, 
  H1, 
  H2, 
  H3, 
  Separator,
  Switch,
  Select,
  ScrollView,
  Sheet,
  Input,
  TextArea,
  Spinner,
  useMedia
} from 'tamagui'
import { 
  Eye, 
  Edit3, 
  Send, 
  Save, 
  RefreshCw, 
  Settings, 
  Calendar,
  Mail,
  Globe,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  BookOpen
} from '@tamagui/lucide-icons'
import { ProgramTypes } from '@my/app/types'
import { LocationDetails } from '@my/app/types/events'
import { fetchUpcoming } from '@my/app/features/newsletter/fetch-upcoming'
import { fetchReadings } from '@my/app/features/newsletter/readings/fetch-readings'
import { ProgressiveEventForm } from '../events/progressive-event-form'
// Note: Email rendering is handled server-side via API calls

// Helper function to fetch cached readings
async function fetchCachedReadings() {
  try {
    const response = await fetch('/api/admin/newsletter/readings/cache')
    const data = await response.json()
    
    if (data.success) {
      console.log('Readings cache status:', data.metadata)
      return data.readings
    } else {
      console.warn('Failed to fetch cached readings, falling back to direct fetch')
      return await fetchReadings()
    }
  } catch (error) {
    console.error('Error fetching cached readings:', error)
    // Fallback to direct fetch
    return await fetchReadings()
  }
}

// Types for newsletter curation
interface NewsletterEvent {
  id: string
  title: string
  date: Date
  type: 'memorial' | 'bibleClass' | 'sundaySchool' | 'bibleSchool' | 'fraternal' | 'special' | 'news' | 'recurring'
  status: 'draft' | 'published' | 'featured' | 'archived'
  priority: 'high' | 'medium' | 'low'
  
  // Content format options
  emailFormat: 'summary' | 'full' | 'link_only'
  webFormat: 'full' | 'summary' | 'event_page_link'
  
  // Content versions
  emailContent?: string
  webContent?: string
  emailSummary?: string
  
  // Event page
  eventPageSlug?: string
  requiresEventPage: boolean
  
  // CTA buttons
  emailCTAs?: CallToActionButton[]
  
  // Recurring event configuration
  isRecurring?: boolean
  recurringConfig?: RecurringEventConfig
  
  // Raw event data
  eventData: any
}

// Recurring Events Configuration
interface RecurringEventConfig {
  // Basic schedule
  daysOfWeek: number[] // 0 = Sunday, 1 = Monday, etc.
  startTime: string // "19:00" format
  endTime: string // "20:30" format
  
  // Recurrence pattern
  frequency: 'weekly' | 'biweekly' | 'monthly' // Future expansion
  
  // Date boundaries
  startDate: Date // When this recurring event starts
  endDate?: Date // Optional end date
  
  // Pause/Cancel system
  exceptions: RecurringEventException[]
  
  // Additional details
  location?: string
  description?: string
  contactPerson?: string
}

interface RecurringEventException {
  id: string
  type: 'pause' | 'cancel' | 'reschedule'
  
  // Date range for the exception
  startDate: Date
  endDate?: Date // If null, applies to single instance only
  
  // Reason and notes
  reason?: string
  notes?: string
  
  // For rescheduled events
  rescheduleDate?: Date
  rescheduleTime?: string
  rescheduleLocation?: string
}

interface CallToActionButton {
  text: string
  url: string
  style: 'primary' | 'secondary' | 'outline'
}

interface NewsletterDraft {
  id: string
  date: Date
  status: 'draft' | 'scheduled' | 'sent'
  events: NewsletterEvent[]
  programData: ProgramTypes[] | null  // Regular services from existing newsletter
  readings: any[] | null              // Daily readings data
  lastSynchronized: Date
  contentVersion: number
}

export function NewsletterCurationInterface() {
  // State management
  const [newsletter, setNewsletter] = useState<NewsletterDraft | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailPreview, setEmailPreview] = useState<string>('')
  const [webPreview, setWebPreview] = useState<string>('')
  const [sectionPositions, setSectionPositions] = useState<any[]>([])
  const [validationResults, setValidationResults] = useState<any[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [showRecurringEventForm, setShowRecurringEventForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<NewsletterEvent | null>(null)
  const [programData, setProgramData] = useState<ProgramTypes[] | null>(null)
  const [readings, setReadings] = useState<any[] | null>(null)
  const [hoveredSection, setHoveredSection] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const media = useMedia()

  // Load newsletter draft
  useEffect(() => {
    loadNewsletterDraft()
  }, [])

  const loadNewsletterDraft = async () => {
    try {
      setLoading(true)
      
      // Fetch continuous program data and cached readings in parallel
      const [programResponse, readingsResponse] = await Promise.all([
        fetchUpcoming({}),
        fetchCachedReadings()
      ])
      
      setProgramData(programResponse)
      setReadings(readingsResponse)
      
      // Get current Thursday's newsletter or create new one
      const response = await fetch('/api/admin/newsletter/draft')
      const data = await response.json()
      
      if (data.success) {
        // Merge with continuous data
        const newsletterWithData = {
          ...data.newsletter,
          programData: programResponse,
          readings: readingsResponse
        }
        setNewsletter(newsletterWithData)
        await generatePreviews(newsletterWithData)
      } else {
        // Create new newsletter draft with continuous data
        await createNewDraft(programResponse, readingsResponse)
      }
    } catch (error) {
      console.error('Error loading newsletter draft:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNewDraft = async (programData?: ProgramTypes[] | null, readingsData?: any[] | null) => {
    try {
      const response = await fetch('/api/admin/newsletter/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: getNextThursday(),
          autoGenerate: true,
          programData: programData,
          readings: readingsData
        })
      })
      
      const data = await response.json()
      if (data.success) {
        const newsletterWithData = {
          ...data.newsletter,
          programData: programData || null,
          readings: readingsData || null
        }
        setNewsletter(newsletterWithData)
        await generatePreviews(newsletterWithData)
      }
    } catch (error) {
      console.error('Error creating newsletter draft:', error)
    }
  }

  const generatePreviews = async (newsletterData: NewsletterDraft) => {
    try {
      // Generate newsletter with current week data via new API
      const response = await fetch('/api/newsletter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setEmailPreview(data.html)
        setSectionPositions(data.sections)
        
        // Also update our newsletter data with the current week information
        console.log('📅 Current week data received:', data.data)
        
        // For web preview, use the same HTML but could be styled differently
        setWebPreview(data.html)
      } else {
        const errorText = await response.text()
        console.error('Newsletter generation failed:', errorText)
        setEmailPreview('<div class="error">Error generating newsletter preview. Please try again.</div>')
        setWebPreview('<div class="error">Error generating newsletter preview. Please try again.</div>')
      }
      
    } catch (error) {
      console.error('Error generating previews:', error)
      setEmailPreview('<div class="error">Network error generating newsletter preview.</div>')
      setWebPreview('<div class="error">Network error generating newsletter preview.</div>')
    }
  }

  const updateEventFormat = useCallback((eventId: string, field: string, value: any) => {
    if (!newsletter) return
    
    const updatedNewsletter = {
      ...newsletter,
      events: newsletter.events.map(event => 
        event.id === eventId 
          ? { ...event, [field]: value }
          : event
      ),
      contentVersion: newsletter.contentVersion + 1
    }
    
    setNewsletter(updatedNewsletter)
    generatePreviews(updatedNewsletter)
  }, [newsletter])

  const validateSynchronization = async () => {
    if (!newsletter) return
    
    const results = []
    
    // Check for consistency between email and web content
    for (const event of newsletter.events) {
      if (event.emailFormat === 'summary' && !event.emailSummary) {
        results.push({
          type: 'warning',
          eventId: event.id,
          message: 'Email summary missing for summary format'
        })
      }
      
      if (event.requiresEventPage && !event.eventPageSlug) {
        results.push({
          type: 'error',
          eventId: event.id,
          message: 'Event page required but slug missing'
        })
      }
      
      if (event.emailCTAs && event.emailCTAs.length > 0) {
        for (const cta of event.emailCTAs) {
          if (!cta.url || !cta.text) {
            results.push({
              type: 'error',
              eventId: event.id,
              message: 'Incomplete CTA button configuration'
            })
          }
        }
      }
    }
    
    // Check content length limits
    if (emailPreview.length > 100 * 1024) { // 100KB limit
      results.push({
        type: 'error',
        message: 'Email content exceeds 100KB limit (Gmail clipping risk)'
      })
    }
    
    setValidationResults(results)
  }

  const scheduleNewsletter = async () => {
    if (!newsletter) return
    
    try {
      const response = await fetch('/api/admin/newsletter/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsletterId: newsletter.id,
          scheduledFor: getNextThursdayEvening()
        })
      })
      
      const data = await response.json()
      if (data.success) {
        alert('Newsletter scheduled for Thursday 7 PM!')
        setNewsletter(prev => prev ? { ...prev, status: 'scheduled' } : null)
      }
    } catch (error) {
      console.error('Error scheduling newsletter:', error)
    }
  }

  const saveRecurringEvent = (recurringEvent: Partial<NewsletterEvent>) => {
    if (!newsletter) return
    
    // Add the recurring event to the newsletter
    const updatedNewsletter = {
      ...newsletter,
      events: [...newsletter.events, recurringEvent as NewsletterEvent],
      contentVersion: newsletter.contentVersion + 1
    }
    
    setNewsletter(updatedNewsletter)
    generatePreviews(updatedNewsletter)
    setShowRecurringEventForm(false)
    setSelectedEvent(null)
  }

  if (loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" space="$4">
        <Spinner size="large" />
        <Text>Loading newsletter curation interface...</Text>
      </YStack>
    )
  }

  if (!newsletter) {
    return (
      <YStack padding="$4" space="$4" alignItems="center">
        <H2>No Newsletter Draft Found</H2>
        <Button onPress={createNewDraft} icon={Plus}>
          Create New Newsletter Draft
        </Button>
      </YStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      {/* Header */}
      <CurationHeader 
        newsletter={newsletter}
        onSchedule={scheduleNewsletter}
        onValidate={validateSynchronization}
        validationResults={validationResults}
      />
      
      {/* Main Content - New Two Panel Layout */}
      <XStack flex={1}>
        {/* Left Panel - Content Library */}
        <YStack 
          width={400} 
          backgroundColor="$gray1" 
          borderRightWidth={1} 
          borderColor="$borderColor"
          padding="$4"
          space="$4"
        >
          <YStack space="$3">
            <Text fontSize="$6" fontWeight="bold" color="$blue10">
              Content Library
            </Text>
            <Text fontSize="$3" color="$gray11">
              Available content that can be added to your newsletter
            </Text>
          </YStack>

          <ContentLibraryPanel
            programData={programData}
            onAddRecurring={() => setShowRecurringEventForm(true)}
            onAddCustomEvent={() => setShowEventForm(true)}
          />
        </YStack>

        {/* Right Panel - Full Preview with Email HTML */}
        <YStack flex={1} backgroundColor="$background">
          <YStack padding="$4" space="$3" borderBottomWidth={1} borderColor="$borderColor">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize="$6" fontWeight="bold" color="$green10">
                  Newsletter Preview
                </Text>
                <Text fontSize="$3" color="$gray11">
                  Live preview - hover to see details, click to edit, drag to reorder
                </Text>
              </YStack>
              <XStack space="$2">
                <Button 
                  size="$3" 
                  variant="outlined"
                  icon={Mail}
                  backgroundColor="$blue1"
                  borderColor="$blue8"
                >
                  Email View
                </Button>
                <Button 
                  size="$3" 
                  variant="ghost"
                  icon={Globe}
                >
                  Web View  
                </Button>
              </XStack>
            </XStack>
          </YStack>

          <ScrollView flex={1}>
            {/* Email HTML Preview */}
            {emailPreview ? (
              <YStack padding="$4">
                <Card 
                  padding="$0" 
                  borderWidth={1} 
                  borderColor="$borderColor"
                  backgroundColor="white"
                  minHeight={600}
                >
                  <iframe
                    srcDoc={emailPreview}
                    style={{ 
                      width: '100%', 
                      height: '800px', 
                      border: 'none',
                      backgroundColor: 'white'
                    }}
                    title="Newsletter Email Preview"
                  />
                </Card>

                {/* Interactive Section Overlays */}
                <InteractiveSectionOverlays
                  newsletter={newsletter}
                  programData={programData}
                  readings={readings}
                  sectionPositions={sectionPositions}
                  hoveredSection={hoveredSection}
                  selectedSection={selectedSection}
                  onSectionHover={setHoveredSection}
                  onSectionSelect={setSelectedSection}
                  onSectionEdit={(sectionId) => {
                    console.log('Edit section:', sectionId)
                  }}
                  onSectionDelete={(sectionId) => {
                    console.log('Delete section:', sectionId)
                  }}
                  onSectionReorder={(sections) => {
                    console.log('Reorder sections:', sections)
                  }}
                />
              </YStack>
            ) : (
              <YStack flex={1} alignItems="center" justifyContent="center" padding="$8">
                <Spinner size="large" />
                <Text marginTop="$4" color="$gray11">
                  Generating newsletter preview...
                </Text>
              </YStack>
            )}
          </ScrollView>
        </YStack>
      </XStack>

      {/* Event Page Creation Sheet */}
      <Sheet 
        modal 
        open={showEventForm} 
        onOpenChange={setShowEventForm}
        snapPointsMode="fit"
      >
        <Sheet.Frame padding="$4">
          <Sheet.Handle />
          <EventPageForm
            event={selectedEvent}
            onSave={(eventPage) => {
              // Handle event page creation
              setShowEventForm(false)
            }}
            onCancel={() => setShowEventForm(false)}
          />
        </Sheet.Frame>
      </Sheet>

      {/* Recurring Event Creation Sheet */}
      <Sheet 
        modal 
        open={showRecurringEventForm} 
        onOpenChange={setShowRecurringEventForm}
        snapPointsMode="fit"
      >
        <Sheet.Frame maxHeight="90%" padding="$0">
          <Sheet.Handle />
          <ProgressiveEventForm
            selectedType="recurring"
            skipTypeSelection={true}
            onSave={saveRecurringEvent}
            onCancel={() => setShowRecurringEventForm(false)}
            compact={true}
          />
        </Sheet.Frame>
      </Sheet>
    </YStack>
  )
}

// Header component with controls
const CurationHeader: React.FC<{
  newsletter: NewsletterDraft
  onSchedule: () => void
  onValidate: () => void
  validationResults: any[]
}> = ({ newsletter, onSchedule, onValidate, validationResults }) => {
  const hasErrors = validationResults.some(r => r.type === 'error')
  const hasWarnings = validationResults.some(r => r.type === 'warning')

  return (
    <Card padding="$4" margin="$3" borderRadius="$4">
      <XStack justifyContent="space-between" alignItems="center">
        <YStack>
          <H1>Newsletter Curation</H1>
          <XStack space="$2" alignItems="center">
            <Text color="$gray11">
              {new Date(newsletter.date).toLocaleDateString('en-CA', {
                weekday: 'long',
                year: 'numeric', 
                month: 'long',
                day: 'numeric'
              })}
            </Text>
            <Text color="$gray9">•</Text>
            <Text color={
              newsletter.status === 'draft' ? '$orange10' :
              newsletter.status === 'scheduled' ? '$blue10' : '$green10'
            }>
              {newsletter.status.toUpperCase()}
            </Text>
          </XStack>
        </YStack>

        <XStack space="$2">
          <Button 
            size="$3" 
            variant="outlined" 
            onPress={onValidate}
            icon={hasErrors ? AlertCircle : CheckCircle}
            color={hasErrors ? '$red10' : hasWarnings ? '$orange10' : '$green10'}
          >
            Validate ({validationResults.length})
          </Button>
          
          <Button 
            size="$3" 
            variant="outlined" 
            icon={Eye}
          >
            Send Test
          </Button>
          
          <Button 
            size="$3" 
            backgroundColor="$blue10" 
            color="white"
            onPress={onSchedule}
            icon={Send}
            disabled={hasErrors}
          >
            Schedule for Thursday 7 PM
          </Button>
        </XStack>
      </XStack>
    </Card>
  )
}

// Event configuration panel with continuous program data
const EventConfigurationPanel: React.FC<{
  events: NewsletterEvent[]
  programData: ProgramTypes[] | null
  readings: any[] | null
  onEventUpdate: (eventId: string, field: string, value: any) => void
  onEventSelect: (event: NewsletterEvent) => void
  onCreateEventPage: () => void
}> = ({ events, programData, readings, onEventUpdate, onEventSelect, onCreateEventPage }) => {
  const media = useMedia()
  
  return (
    <ScrollView>
      <YStack padding="$3" space="$3">
        <H3>Newsletter Content</H3>
        
        {/* Regular Services Section */}
        {programData && (
          <Card padding="$3" borderRadius="$3" backgroundColor="$background">
            <YStack space="$2">
              <XStack alignItems="center" space="$2">
                <Calendar size="$1" color="$blue10" />
                <Text fontWeight="600" fontSize="$4" color="$blue10">
                  Regular Services
                </Text>
              </XStack>
              <Text fontSize="$3" color="$gray11">
                Continuous schedule items that appear in every newsletter
              </Text>
              {programData.map((event, index) => (
                <YStack key={index} padding="$2" backgroundColor="$gray2" borderRadius="$2">
                  <Text fontWeight="500" fontSize="$3">
                    {event.Key === 'memorial' ? 'Memorial Service' :
                     event.Key === 'bibleClass' ? 'Bible Class' :
                     event.Key === 'sundaySchool' ? 'Sunday School' : event.Key}
                  </Text>
                  <Text fontSize="$2" color="$gray11">
                    {new Date(event.Date).toLocaleDateString()}
                  </Text>
                </YStack>
              ))}
            </YStack>
          </Card>
        )}
        
        {/* Daily Readings Section */}
        {readings && (
          <DailyReadingsCard readings={readings} isMobile={media.sm} />
        )}
        
        {/* Custom Events Section */}
        <Card padding="$3" borderRadius="$3">
          <YStack space="$2">
            <XStack alignItems="center" justifyContent="space-between">
              <XStack alignItems="center" space="$2">
                <Plus size="$1" color="$green10" />
                <Text fontWeight="600" fontSize="$4" color="$green10">
                  Custom Events
                </Text>
              </XStack>
              <XStack space="$2">
                <Button size="$2" variant="outlined" icon={RefreshCw} onPress={() => setShowRecurringEventForm(true)}>
                  Add Recurring
                </Button>
                <Button size="$2" variant="outlined" icon={Plus}>
                  Add Event
                </Button>
              </XStack>
            </XStack>
            <Text fontSize="$3" color="$gray11">
              Additional events and announcements for this newsletter
            </Text>
          </YStack>
        </Card>
        
        {events.map((event) => (
          <EventConfigCard
            key={event.id}
            event={event}
            onUpdate={onEventUpdate}
            onSelect={onEventSelect}
            onCreateEventPage={onCreateEventPage}
          />
        ))}
      </YStack>
    </ScrollView>
  )
}

// Content Library Panel - Shows available content that can be added
const ContentLibraryPanel: React.FC<{
  programData: ProgramTypes[] | null
  onAddRecurring: () => void
  onAddCustomEvent: () => void
}> = ({ programData, onAddRecurring, onAddCustomEvent }) => {
  return (
    <YStack space="$4">
      {/* Available Content */}
      <YStack space="$3">
        <Text fontSize="$5" fontWeight="600" color="$gray12">
          Available Content
        </Text>
        
        {/* Upcoming Events from Program Data */}
        {programData && programData.length > 0 && (
          <YStack space="$2">
            <Text fontSize="$4" fontWeight="500" color="$blue10">
              Upcoming Events
            </Text>
            {programData.slice(0, 3).map((event, index) => (
              <Card 
                key={index}
                padding="$3" 
                backgroundColor="$blue1"
                borderColor="$blue6"
                borderWidth={1}
                pressStyle={{ backgroundColor: '$blue2' }}
                cursor="pointer"
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1}>
                    <Text fontSize="$3" fontWeight="500">
                      {event.Key === 'memorial' ? 'Memorial Service' : 
                       event.Key === 'sundaySchool' ? 'Sunday School' :
                       event.Key === 'bibleClass' ? 'Bible Class' : event.Key}
                    </Text>
                    <Text fontSize="$2" color="$gray11">
                      {event.Date}
                    </Text>
                  </YStack>
                  <Button size="$2" variant="outlined" color="$blue10">
                    Add
                  </Button>
                </XStack>
              </Card>
            ))}
          </YStack>
        )}

        {/* Create New Content */}
        <YStack space="$2">
          <Text fontSize="$4" fontWeight="500" color="$green10">
            Create New
          </Text>
          
          <Button 
            size="$3" 
            variant="outlined" 
            icon={RefreshCw}
            onPress={onAddRecurring}
            backgroundColor="$purple1"
            borderColor="$purple8"
            color="$purple11"
          >
            Add Recurring Event
          </Button>
          
          <Button 
            size="$3" 
            variant="outlined" 
            icon={Plus}
            onPress={onAddCustomEvent}
            backgroundColor="$green1"
            borderColor="$green8"
            color="$green11"
          >
            Add Custom Event
          </Button>
        </YStack>
      </YStack>
    </YStack>
  )
}

// Interactive Section Overlays - Shows draggable sections over the email preview
const InteractiveSectionOverlays: React.FC<{
  newsletter: NewsletterDraft
  programData: ProgramTypes[] | null
  readings: any[] | null
  sectionPositions: any[]
  hoveredSection: string | null
  selectedSection: string | null
  onSectionHover: (sectionId: string | null) => void
  onSectionSelect: (sectionId: string | null) => void
  onSectionEdit: (sectionId: string) => void
  onSectionDelete: (sectionId: string) => void
  onSectionReorder: (sections: string[]) => void
}> = ({
  newsletter,
  programData,
  readings,
  sectionPositions,
  hoveredSection,
  selectedSection,
  onSectionHover,
  onSectionSelect,
  onSectionEdit,
  onSectionDelete,
  onSectionReorder
}) => {
  // Use dynamic section positions instead of hardcoded ones
  const [sectionOrder, setSectionOrder] = useState(
    sectionPositions.map(pos => pos.id)
  )

  const handleDragEnd = (result: any) => {
    if (!result.destination) return
    
    const newOrder = Array.from(sectionOrder)
    const [reorderedItem] = newOrder.splice(result.source.index, 1)
    newOrder.splice(result.destination.index, 0, reorderedItem)
    
    setSectionOrder(newOrder)
    onSectionReorder(newOrder)
  }

  return (
    <YStack 
      position="absolute" 
      top={0} 
      left={0} 
      right={0} 
      pointerEvents="none"
      paddingTop="$20" // Offset for email header
    >
      {/* Draggable Section Markers */}
      {sectionOrder.map((sectionId, index) => {
        const position = sectionPositions.find(pos => pos.id === sectionId)
        if (!position) return null
        
        return (
          <DraggableSectionMarker
            key={sectionId}
            sectionId={sectionId}
            index={index}
            position={position.position}
            isHovered={hoveredSection === sectionId}
            isSelected={selectedSection === sectionId}
            onHover={() => onSectionHover(sectionId)}
            onSelect={() => onSectionSelect(sectionId)}
            onEdit={() => onSectionEdit(sectionId)}
            onDelete={() => onSectionDelete(sectionId)}
            getSectionData={(id) => {
              if (id === 'daily-readings') {
                return {
                  title: 'Daily Readings',
                  description: `Scripture readings for ${getWeekRange()}`,
                  data: readings?.slice(0, 3).map(r => `${r.date}: ${r.reading1}, ${r.reading2}, ${r.reading3}`).join(' | ') || 'Loading readings...'
                }
              }
              if (id === 'sunday-school') {
                const event = programData?.find(p => p.Key === 'sundaySchool')
                return {
                  title: 'Sunday School',
                  description: 'Next Sunday service details',
                  data: event ? `${event.Date} - Refreshments: ${event.Refreshments || 'TBA'}` : 'No data available'
                }
              }
              if (id === 'memorial') {
                const event = programData?.find(p => p.Key === 'memorial')
                return {
                  title: 'Memorial Service', 
                  description: 'Weekly memorial service',
                  data: event ? `${event.Date} - Preside: ${event.Preside}, Exhort: ${event.Exhort}` : 'No data available'
                }
              }
              if (id === 'bible-class-current') {
                const event = programData?.find(p => p.Key === 'bibleClass')
                return {
                  title: 'Bible Class (This Week)',
                  description: 'Wednesday Bible study', 
                  data: event ? `${event.Date} - Speaker: ${event.Speaker || 'TBA'}` : 'No data available'
                }
              }
              if (id === 'bible-class-next') {
                return {
                  title: 'Bible Class (Next Week)',
                  description: 'Next Wednesday Bible study',
                  data: 'Next week\'s Bible class details'
                }
              }
              if (id.startsWith('custom-event-')) {
                const eventId = id.replace('custom-event-', '')
                const event = newsletter.events.find(e => e.id === eventId)
                return {
                  title: event?.title || 'Custom Event',
                  description: `Custom event: ${event?.type || 'Unknown'}`,
                  data: event ? `${event.date ? new Date(event.date).toLocaleDateString() : 'Date TBA'} - ${event.title}` : 'No data available'
                }
              }
              return { title: 'Unknown', description: '', data: '' }
            }}
          />
        )
      })}
    </YStack>
  )
}

// Individual draggable section marker that overlays the email preview
const DraggableSectionMarker: React.FC<{
  sectionId: string
  index: number
  position: { top: number; height: number }
  isHovered: boolean
  isSelected: boolean
  onHover: () => void
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  getSectionData: (id: string) => { title: string; description: string; data: string }
}> = ({
  sectionId,
  index,
  position,
  isHovered,
  isSelected,
  onHover,
  onSelect,
  onEdit,
  onDelete,
  getSectionData
}) => {
  const sectionData = getSectionData(sectionId)
  const topOffset = position.top // Use actual position from API

  return (
    <YStack
      position="absolute"
      top={topOffset}
      left="$4"
      right="$4"
      height={140}
      pointerEvents="auto"
      onMouseEnter={onHover}
      onMouseLeave={() => {}}
      onPress={onSelect}
      cursor="pointer"
    >
      {/* Invisible overlay for interaction */}
      <YStack
        flex={1}
        backgroundColor={isHovered ? 'rgba(59, 130, 246, 0.1)' : 'transparent'}
        borderWidth={isSelected ? 2 : isHovered ? 1 : 0}
        borderColor={isSelected ? '$blue8' : '$blue6'}
        borderRadius="$2"
        borderStyle="dashed"
        position="relative"
      >
        {/* Hover Tooltip */}
        {isHovered && (
          <YStack
            position="absolute"
            top={-60}
            left="$2"
            backgroundColor="$gray12"
            padding="$3"
            borderRadius="$3"
            zIndex={50}
            maxWidth={300}
            minWidth={200}
          >
            <Text fontSize="$3" color="white" fontWeight="600">
              {sectionData.title}
            </Text>
            <Text fontSize="$2" color="$gray10" marginBottom="$1">
              {sectionData.description}
            </Text>
            <Text fontSize="$2" color="$gray9" numberOfLines={2}>
              📊 Live Data: {sectionData.data}
            </Text>
          </YStack>
        )}

        {/* Action Buttons */}
        {isSelected && (
          <XStack
            position="absolute"
            top="$2"
            right="$2"
            space="$2"
            zIndex={60}
          >
            <Button
              size="$2"
              variant="outlined"
              icon={Edit3}
              onPress={onEdit}
              backgroundColor="$blue1"
              borderColor="$blue8"
            />
            <Button
              size="$2"
              variant="outlined"
              icon={Trash2}
              onPress={onDelete}
              backgroundColor="$red1"
              borderColor="$red8"
            />
            <Button
              size="$2"
              variant="outlined"
              icon={Settings}
              backgroundColor="$gray1"
              borderColor="$gray8"
            />
          </XStack>
        )}

        {/* Drag Handle */}
        {(isHovered || isSelected) && (
          <YStack
            position="absolute"
            left={-30}
            top="50%"
            transform="translateY(-50%)"
            backgroundColor="$blue8"
            padding="$2"
            borderRadius="$2"
            cursor="grab"
          >
            <Text fontSize="$1" color="white">⋮⋮</Text>
          </YStack>
        )}
      </YStack>
    </YStack>
  )
}

// Individual Newsletter Section with hover/click interactions
const NewsletterSection: React.FC<{
  id: string
  title: string
  description: string
  isHovered: boolean
  isSelected: boolean
  onHover: () => void
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  children: React.ReactNode
}> = ({
  id,
  title,
  description,
  isHovered,
  isSelected,
  onHover,
  onSelect,
  onEdit,
  onDelete,
  children
}) => {
  return (
    <Card
      padding="$0"
      borderWidth={isSelected ? 2 : 1}
      borderColor={isSelected ? '$blue8' : isHovered ? '$gray8' : '$borderColor'}
      backgroundColor={isHovered ? '$gray1' : '$background'}
      onMouseEnter={onHover}
      onMouseLeave={() => {}}
      onPress={onSelect}
      cursor="pointer"
      position="relative"
    >
      {/* Hover Tooltip */}
      {isHovered && (
        <YStack
          position="absolute"
          top="$2"
          right="$2"
          backgroundColor="$gray12"
          padding="$2"
          borderRadius="$2"
          zIndex={10}
          maxWidth={200}
        >
          <Text fontSize="$2" color="white" fontWeight="600">
            {title}
          </Text>
          <Text fontSize="$1" color="$gray10">
            {description}
          </Text>
        </YStack>
      )}

      {/* Action Buttons */}
      {isSelected && (
        <XStack
          position="absolute"
          top="$3"
          right="$3"
          space="$2"
          zIndex={20}
        >
          <Button
            size="$2"
            variant="outlined"
            icon={Edit3}
            onPress={onEdit}
            backgroundColor="$blue1"
            borderColor="$blue8"
          />
          <Button
            size="$2"
            variant="outlined"
            icon={Trash2}
            onPress={onDelete}
            backgroundColor="$red1"
            borderColor="$red8"
          />
          <Button
            size="$2"
            variant="outlined"
            icon={Settings}
            backgroundColor="$gray1"
            borderColor="$gray8"
          />
        </XStack>
      )}

      <YStack padding="$4">
        {children}
      </YStack>
    </Card>
  )
}

// Daily Readings Card Component for Mobile-Friendly Display
const DailyReadingsCard: React.FC<{
  readings: any[]
  isMobile: boolean
}> = ({ readings, isMobile }) => {
  return (
    <Card padding="$3" borderRadius="$3" backgroundColor="$background">
      <YStack space="$2">
        <XStack alignItems="center" space="$2">
          <BookOpen size="$1" color="$purple10" />
          <Text fontWeight="600" fontSize="$4" color="$purple10">
            Daily Bible Reading Planner
          </Text>
        </XStack>
        <Text fontSize="$3" color="$gray11">
          Weekly reading schedule for newsletter distribution
        </Text>
        
        <YStack space="$2">
          {readings.map((dailyReading, index) => {
            return Object.entries(dailyReading).map(([date, readingArray]) => {
              const passages = readingArray as string[]
              
              // Parse date to get day name and formatted date
              // Handle various date formats that might come from the readings API
              let parsedDate: Date
              const currentYear = new Date().getFullYear()
              
              // Try parsing the date string - it might be in format like "July 30" or "2025-07-30" or other formats
              if (date.includes(',')) {
                // Format like "July 30, 2025"
                parsedDate = new Date(date)
              } else if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // ISO format like "2025-07-30"
                parsedDate = new Date(date)
              } else if (date.match(/^[A-Za-z]+ \d{1,2}$/)) {
                // Format like "July 30" - add current year
                parsedDate = new Date(`${date}, ${currentYear}`)
              } else {
                // Try direct parsing and fallback to current year if needed
                parsedDate = new Date(date)
                if (isNaN(parsedDate.getTime())) {
                  parsedDate = new Date(`${date}, ${currentYear}`)
                }
              }
              
              // If still invalid, fallback to a default
              if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date()
              }
              
              const dayName = parsedDate.toLocaleDateString('en-US', { weekday: 'long' })
              const monthDay = parsedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
              
              return (
                <Card 
                  key={`${index}-${date}`}
                  padding="$3" 
                  borderRadius="$2" 
                  backgroundColor="$purple2"
                  borderWidth={1}
                  borderColor="$purple6"
                >
                  {isMobile ? (
                    // Mobile: Vertical stacked layout with day name and date on separate rows
                    <YStack space="$2">
                      <YStack space="$1">
                        <Text fontWeight="600" fontSize="$3" color="$purple12">
                          {dayName}
                        </Text>
                        <Text fontWeight="500" fontSize="$2" color="$purple11">
                          {monthDay}
                        </Text>
                      </YStack>
                      <YStack space="$1" paddingLeft="$2">
                        {passages.map((passage, passageIndex) => (
                          <Text 
                            key={passageIndex}
                            fontSize="$2" 
                            color="$purple11"
                            fontFamily="$mono"
                          >
                            • {passage}
                          </Text>
                        ))}
                      </YStack>
                    </YStack>
                  ) : (
                    // Desktop: Horizontal layout with full date
                    <XStack space="$3" alignItems="flex-start">
                      <YStack minWidth="$10">
                        <Text 
                          fontWeight="600" 
                          fontSize="$3" 
                          color="$purple12"
                        >
                          {dayName}
                        </Text>
                        <Text 
                          fontWeight="500" 
                          fontSize="$2" 
                          color="$purple11"
                        >
                          {monthDay}
                        </Text>
                      </YStack>
                      <YStack flex={1} space="$1">
                        {passages.map((passage, passageIndex) => (
                          <Text 
                            key={passageIndex}
                            fontSize="$2" 
                            color="$purple11"
                            fontFamily="$mono"
                          >
                            {passage}
                          </Text>
                        ))}
                      </YStack>
                    </XStack>
                  )}
                </Card>
              )
            })
          })}
        </YStack>
      </YStack>
    </Card>
  )
}

// Individual event configuration card
const EventConfigCard: React.FC<{
  event: NewsletterEvent
  onUpdate: (eventId: string, field: string, value: any) => void
  onSelect: (event: NewsletterEvent) => void
  onCreateEventPage: () => void
}> = ({ event, onUpdate, onSelect, onCreateEventPage }) => {
  return (
    <Card padding="$3" borderRadius="$3">
      <YStack space="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontWeight="600" fontSize="$4">{event.title}</Text>
          <Text fontSize="$2" color="$gray11">
            {new Date(event.date).toLocaleDateString()}
          </Text>
        </XStack>
        
        {/* Email Format Selection */}
        <YStack space="$1">
          <Text fontSize="$3" fontWeight="500">Email Format</Text>
          <Select 
            value={event.emailFormat} 
            onValueChange={(value) => onUpdate(event.id, 'emailFormat', value)}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="summary">Summary + Link</Select.Item>
              <Select.Item value="full">Full Content</Select.Item>
              <Select.Item value="link_only">Link Only</Select.Item>
            </Select.Content>
          </Select>
        </YStack>

        {/* Web Format Selection */}
        <YStack space="$1">
          <Text fontSize="$3" fontWeight="500">Web Format</Text>
          <Select 
            value={event.webFormat} 
            onValueChange={(value) => onUpdate(event.id, 'webFormat', value)}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="full">Full Content</Select.Item>
              <Select.Item value="summary">Summary</Select.Item>
              <Select.Item value="event_page_link">Event Page Link</Select.Item>
            </Select.Content>
          </Select>
        </YStack>

        {/* Event Page Toggle */}
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$3">Requires Event Page</Text>
          <Switch 
            checked={event.requiresEventPage}
            onCheckedChange={(checked) => onUpdate(event.id, 'requiresEventPage', checked)}
          />
        </XStack>

        {/* Event Page Creation */}
        {event.requiresEventPage && !event.eventPageSlug && (
          <Button 
            size="$2" 
            variant="outlined" 
            onPress={() => {
              onSelect(event)
              onCreateEventPage()
            }}
            icon={Plus}
          >
            Create Event Page
          </Button>
        )}

        {/* CTA Buttons Configuration */}
        {event.emailFormat !== 'full' && (
          <YStack space="$1">
            <Text fontSize="$3" fontWeight="500">Email CTAs</Text>
            <XStack space="$1">
              <Button size="$2" variant="outlined" icon={Plus}>
                Add CTA
              </Button>
              {event.emailCTAs && event.emailCTAs.length > 0 && (
                <Button size="$2" variant="ghost" icon={Edit3}>
                  Edit ({event.emailCTAs.length})
                </Button>
              )}
            </XStack>
          </YStack>
        )}
      </YStack>
    </Card>
  )
}

// Preview panel component
const PreviewPanel: React.FC<{
  mode: 'side-by-side' | 'email' | 'web'
  emailPreview: string
  webPreview: string
}> = ({ mode, emailPreview, webPreview }) => {
  return (
    <YStack flex={1} padding="$3">
      {mode === 'side-by-side' ? (
        <XStack flex={1} space="$3">
          <YStack flex={1}>
            <H3>Email Preview</H3>
            <Card flex={1} padding="$2">
              <iframe 
                srcDoc={emailPreview}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </Card>
          </YStack>
          <YStack flex={1}>
            <H3>Web Preview</H3>
            <Card flex={1} padding="$2">
              <iframe 
                srcDoc={webPreview}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </Card>
          </YStack>
        </XStack>
      ) : mode === 'email' ? (
        <YStack flex={1}>
          <H3>Email Preview</H3>
          <Card flex={1} padding="$2">
            <iframe 
              srcDoc={emailPreview}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </Card>
        </YStack>
      ) : (
        <YStack flex={1}>
          <H3>Web Preview</H3>
          <Card flex={1} padding="$2">
            <iframe 
              srcDoc={webPreview}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </Card>
        </YStack>
      )}
    </YStack>
  )
}


// Exception Card Component
const ExceptionCard: React.FC<{
  exception: RecurringEventException
  onUpdate: (updates: Partial<RecurringEventException>) => void
  onRemove: () => void
}> = ({ exception, onUpdate, onRemove }) => {
  return (
    <Card padding="$3" borderWidth={1} borderColor="$red6" backgroundColor="$red1">
      <YStack space="$2">
        <XStack justifyContent="space-between" alignItems="center">
          <Select 
            value={exception.type} 
            onValueChange={(value) => onUpdate({ type: value as any })}
          >
            <Select.Trigger width="$8">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="pause">Pause</Select.Item>
              <Select.Item value="cancel">Cancel</Select.Item>
              <Select.Item value="reschedule">Reschedule</Select.Item>
            </Select.Content>
          </Select>
          
          <Button size="$2" variant="ghost" onPress={onRemove} icon={Trash2} color="$red10" />
        </XStack>

        <XStack space="$2">
          <YStack flex={1} space="$1">
            <Text fontSize="$2" fontWeight="500">Start Date</Text>
            <Input 
              value={exception.startDate.toISOString().split('T')[0]}
              onChangeText={(value) => onUpdate({ startDate: new Date(value) })}
              fontSize="$2"
            />
          </YStack>
          <YStack flex={1} space="$1">
            <Text fontSize="$2" fontWeight="500">End Date (Optional)</Text>
            <Input 
              value={exception.endDate?.toISOString().split('T')[0] || ''}
              onChangeText={(value) => onUpdate({ endDate: value ? new Date(value) : undefined })}
              placeholder="Single date only"
              fontSize="$2"
            />
          </YStack>
        </XStack>

        <YStack space="$1">
          <Text fontSize="$2" fontWeight="500">Reason</Text>
          <Input 
            value={exception.reason || ''}
            onChangeText={(value) => onUpdate({ reason: value })}
            placeholder="e.g., Summer break, Holiday"
            fontSize="$2"
          />
        </YStack>
      </YStack>
    </Card>
  )
}

// Event page creation form
const EventPageForm: React.FC<{
  event: NewsletterEvent | null
  onSave: (eventPage: any) => void
  onCancel: () => void
}> = ({ event, onSave, onCancel }) => {
  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')

  useEffect(() => {
    if (event?.title) {
      // Auto-generate slug from title
      const generatedSlug = event.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim()
      setSlug(generatedSlug)
    }
  }, [event])

  return (
    <YStack space="$4">
      <H2>Create Event Page</H2>
      
      <YStack space="$2">
        <Text fontWeight="500">Page Title</Text>
        <Input 
          value={title}
          onChangeText={setTitle}
          placeholder="Enter page title"
        />
      </YStack>

      <YStack space="$2">
        <Text fontWeight="500">URL Slug</Text>
        <Input 
          value={slug}
          onChangeText={setSlug}
          placeholder="url-friendly-slug"
        />
        <Text fontSize="$2" color="$gray11">
          Full URL: /event/{slug}
        </Text>
      </YStack>

      <YStack space="$2">
        <Text fontWeight="500">Description</Text>
        <TextArea 
          value={description}
          onChangeText={setDescription}
          placeholder="Enter event description"
          minHeight={100}
        />
      </YStack>

      <XStack space="$2" justifyContent="flex-end">
        <Button variant="outlined" onPress={onCancel}>
          Cancel
        </Button>
        <Button 
          backgroundColor="$blue10" 
          color="white"
          onPress={() => onSave({ title, slug, description })}
          disabled={!title || !slug}
        >
          Create Page
        </Button>
      </XStack>
    </YStack>
  )
}

// Helper functions
function getNextThursday(): Date {
  const now = new Date()
  const daysUntilThursday = (4 - now.getDay() + 7) % 7 || 7
  const nextThursday = new Date(now)
  nextThursday.setDate(now.getDate() + daysUntilThursday)
  return nextThursday
}

function getNextThursdayEvening(): Date {
  const thursday = getNextThursday()
  thursday.setHours(19, 0, 0, 0) // 7 PM
  return thursday
}

function getWeekRange(): string {
  const thursday = getNextThursday()
  const wednesday = new Date(thursday)
  wednesday.setDate(thursday.getDate() + 6)
  
  const thursdayStr = thursday.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric' 
  })
  const wednesdayStr = wednesday.toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric' 
  })
  
  return `${thursdayStr} - ${wednesdayStr}`
}