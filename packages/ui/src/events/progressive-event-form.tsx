import { Event, EventType, EventStatus, EventSharingScope } from '@my/app/types/events'
import { EventValidator } from '@my/app/utils/event-validation'
import { TIMEZONE_OPTIONS } from '@my/app/utils/timezone'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  MapPin,
  Plus,
  Save,
  Settings,
  User,
  CheckCircle,
  Layers,
} from '@tamagui/lucide-icons'
import { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Card, Circle, Input, Separator, Text, XStack, YStack, AlertDialog } from 'tamagui'
import { Button } from '../Button'
import { CheckboxWithCheck } from '../form/checkbox-with-check'
import { EcclesiaSearchInput } from '../form/ecclesia-search-input'
import { EventDatePicker } from '../form/event-date-picker'
import { EventDateRangePicker } from '../form/event-date-range-picker'
import { EventFormInput } from '../form/event-form-input'
import { EventFormSelect } from '../form/event-form-select'
import { ImageUpload } from '../form/image-upload'
import { OptimizedTextarea } from '../form/optimized-textarea'
import { TimeSelector } from '../form/time-selector'
import { MultiDateSelector } from '../form/multi-date-selector'
import {
  LocationSection,
  MultipleLocationsSection,
  RegistrationSection,
  ScheduleSection,
  SpeakerSection,
} from './event-form-sections'
import { DocumentsSection } from './form-sections/documents-section'
import { SectionsEditor } from './sections-editor'
import { EventTypeSelector } from './event-type-selector'
import { EventValidationSummary } from './event-status-indicator'

interface ProgressiveEventFormProps {
  initialData?: Partial<Event>
  onSave: (data: any) => Promise<void>
  onAutoSave?: (data: any) => Promise<any> // Auto-save callback for drafts
  onPreview?: (data: any) => void
  isLoading?: boolean
  skipTypeSelection?: boolean // Allow skipping type selection for edit mode
  selectedType?: EventType // Pre-select event type
  compact?: boolean // Streamlined UI for newsletter context
  onCancel?: () => void // Cancel callback
  showSharingScope?: boolean // Show sharing scope dropdown (multi-tenant, admin/owner only)
}

interface ComponentButton {
  id: string
  label: string
  icon: any
  description: string
  component: React.ReactNode
  required?: boolean
}

// Consolidated Collapsible Component with integrated sticky header
interface CollapsibleComponentProps {
  title: string
  children: React.ReactNode
  onRemove: () => void
  defaultExpanded?: boolean
  // Props for the integrated add button
  onAdd?: () => void
  addButtonText?: string
  icon?: React.ComponentType<any>
  iconColor?: string
}

function CollapsibleComponent({
  title,
  children,
  onRemove,
  defaultExpanded = true,
  onAdd,
  addButtonText = 'Add Item',
  icon: Icon,
  iconColor = '$blue10',
}: CollapsibleComponentProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleRemoveClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false)
    onRemove()
  }

  return (
    <YStack borderWidth={1} borderColor="$borderColor" borderRadius="$4" overflow="visible">
      {/* Consolidated sticky header with all functionality */}
      <XStack
        style={{ position: 'sticky', top: 0, zIndex: 15 }}
        backgroundColor="$borderContrast"
        padding="$3"
        borderBottomWidth={isExpanded ? 2 : 0}
        borderBottomColor="$borderColor"
        gap="$2"
        alignItems="center"
        justifyContent="space-between"
        shadowColor="$shadowColor"
        shadowOffset={{ width: 0, height: 2 }}
        shadowOpacity={0.1}
        shadowRadius={4}
        elevation={2}
        borderTopLeftRadius="$4"
        borderTopRightRadius="$4"
      >
        {/* Left side: collapse button + icon + title */}
        <XStack gap="$2" alignItems="center" flex={1}>
          <Button
            size="$2"
            chromeless
            onPress={() => setIsExpanded(!isExpanded)}
            icon={isExpanded ? <ChevronUp size="$1" /> : <ChevronDown size="$1" />}
            padding="$2"
            borderRadius="$2"
          />
          {Icon ? <Icon size="$1" color={iconColor} /> : null}
          <Text fontSize="$4" fontWeight="600" flex={1}>
            {title}
          </Text>
        </XStack>

        {/* Right side: Add button + Remove button */}
        <XStack gap="$2" alignItems="center">
          {onAdd && isExpanded ? <Button size="$3" theme="blue" icon={Plus} onPress={onAdd}>
              {addButtonText}
            </Button> : null}
          <Button size="$3" theme="red" onPress={handleRemoveClick} opacity={isExpanded ? 1 : 0.7}>
            Remove
          </Button>
        </XStack>
      </XStack>

      {/* Content area */}
      {isExpanded ? <YStack padding="$3" backgroundColor="$borderContrast">
          {children}
        </YStack> : null}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay
            key="overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <AlertDialog.Content
            bordered
            elevate
            key="content"
            animation="quick"
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            x={0}
            scale={1}
            opacity={1}
            y={0}
            maxWidth={500}
          >
            <YStack space="$3">
              <AlertDialog.Title>Remove {title}?</AlertDialog.Title>
              <AlertDialog.Description>
                Are you sure you want to remove this entire {title.toLowerCase()} section? This
                action cannot be undone.
              </AlertDialog.Description>

              <XStack space="$3" justifyContent="flex-end">
                <AlertDialog.Cancel asChild>
                  <Button variant="outlined">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button theme="red" onPress={handleConfirmDelete}>
                    Remove Section
                  </Button>
                </AlertDialog.Action>
              </XStack>
            </YStack>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog>
    </YStack>
  )
}

// Event activation control — unified publishDate-based lifecycle
function EventActivationSection({
  formData,
  currentSelectedType,
  publishDate,
  onActivate,
  onDeactivate,
  onSchedule,
}: {
  formData: any
  currentSelectedType?: EventType
  publishDate?: Date | null
  onActivate: () => void
  onDeactivate: () => void
  onSchedule: (date: Date) => void
}) {
  if (!currentSelectedType) return null

  const eventData = {
    ...formData,
    type: currentSelectedType,
    publishDate,
  }

  const isActive = publishDate ? new Date(publishDate).getTime() <= Date.now() : false
  const isScheduled = publishDate ? new Date(publishDate).getTime() > Date.now() : false
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduleInput, setScheduleInput] = useState('')

  return (
    <YStack gap="$3">
      <XStack alignItems="center" justifyContent="space-between" paddingHorizontal="$2" flexWrap="wrap" gap="$2">
        {isActive ? (
          <XStack alignItems="center" gap="$3">
            <Text fontSize="$4" fontWeight="600" color="$green10">
              Active
            </Text>
            <Button size="$3" theme="red" variant="outlined" onPress={onDeactivate}>
              Deactivate
            </Button>
          </XStack>
        ) : isScheduled ? (
          <XStack alignItems="center" gap="$3" flexWrap="wrap">
            <Text fontSize="$4" fontWeight="600" color="$blue10">
              Scheduled — {new Date(publishDate!).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
            <Button size="$3" theme="green" onPress={onActivate}>
              Activate Now
            </Button>
            <Button size="$3" theme="red" variant="outlined" onPress={onDeactivate}>
              Cancel
            </Button>
          </XStack>
        ) : (
          <XStack alignItems="center" gap="$3" flexWrap="wrap">
            <Text fontSize="$4" fontWeight="600" color="$gray10">
              Inactive
            </Text>
            <Button size="$3" theme="green" onPress={onActivate}>
              Activate Now
            </Button>
            <Button size="$3" variant="outlined" onPress={() => setShowScheduler(!showScheduler)}>
              {showScheduler ? 'Cancel Schedule' : 'Schedule'}
            </Button>
          </XStack>
        )}
      </XStack>

      {showScheduler && !isActive && !isScheduled ? (
        <XStack gap="$2" alignItems="center" paddingHorizontal="$2">
          <Input
            flex={1}
            placeholder="YYYY-MM-DD"
            value={scheduleInput}
            onChangeText={setScheduleInput}
          />
          <Button
            size="$3"
            theme="blue"
            disabled={!scheduleInput.trim()}
            onPress={() => {
              const d = new Date(scheduleInput.trim())
              if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
                onSchedule(d)
                setShowScheduler(false)
                setScheduleInput('')
              }
            }}
          >
            Set Date
          </Button>
        </XStack>
      ) : null}

      <EventValidationSummary event={eventData} showWarnings />
    </YStack>
  )
}

// Breadcrumb component
function StepBreadcrumb({
  currentStep,
  currentSelectedType,
  skipTypeSelection = false,
  autoSaveStatus,
  lastSaved,
  autoSaveRetryCount,
  maxAutoSaveRetries,
  isDirty,
}: {
  currentStep: 'type' | 'basic' | 'components' | 'review'
  currentSelectedType?: EventType
  skipTypeSelection?: boolean
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error'
  lastSaved?: Date | null
  autoSaveRetryCount?: number
  maxAutoSaveRetries?: number
  isDirty?: boolean
}) {
  const allSteps = [
    { key: 'type', label: 'Event Type', number: 1 },
    { key: 'basic', label: 'Basic Details', number: 2 },
    { key: 'components', label: 'Optional Fields', number: 3 },
    { key: 'review', label: 'Review & Save', number: 4 },
  ]

  // Filter out type step if we're skipping it
  const steps = skipTypeSelection
    ? allSteps
        .filter((step) => step.key !== 'type')
        .map((step, index) => ({ ...step, number: index + 1 }))
    : allSteps

  const getCurrentStepIndex = () => steps.findIndex((s) => s.key === currentStep)
  const currentIndex = getCurrentStepIndex()

  return (
    <Card padding="$3" backgroundColor="$gray1" marginBottom="$4">
      <XStack space="$3" alignItems="center" justifyContent="center">
        {steps.map((step, index) => (
          <XStack key={step.key} alignItems="center" space="$2">
            {/* Step indicator */}
            <XStack alignItems="center" space="$2">
              {index < currentIndex ? (
                // Completed step
                <Circle
                  size="$2"
                  backgroundColor="$green10"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Check size="$0.5" color="white" />
                </Circle>
              ) : index === currentIndex ? (
                // Current step
                <Circle
                  size="$2"
                  backgroundColor="$blue10"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="white" fontSize="$2" fontWeight="bold">
                    {step.number}
                  </Text>
                </Circle>
              ) : (
                // Future step
                <Circle
                  size="$2"
                  backgroundColor="$gray8"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text color="$gray11" fontSize="$2" fontWeight="bold">
                    {step.number}
                  </Text>
                </Circle>
              )}

              <Text
                fontSize="$3"
                fontWeight={index === currentIndex ? '600' : '400'}
                color={index <= currentIndex ? '$color' : '$gray11'}
              >
                {step.label}
              </Text>
            </XStack>

            {/* Connector line */}
            {index < steps.length - 1 ? <XStack
                width="$3"
                height={1}
                backgroundColor={index < currentIndex ? '$green10' : '$gray8'}
                marginHorizontal="$2"
              /> : null}
          </XStack>
        ))}
      </XStack>

      {currentSelectedType ? <Text fontSize="$2" color="$gray11" textAlign="center" marginTop="$2">
          {`Creating ${currentSelectedType.replace('-', ' ')} event`}
        </Text> : null}

      {/* Unsaved changes and save status indicator */}
      <XStack justifyContent="center" alignItems="center" space="$2" marginTop="$2" minHeight="$2">
        {/* Show unsaved changes indicator when dirty and not saving */}
        {isDirty && autoSaveStatus === 'idle' ? <>
            <Circle size="$0.5" backgroundColor="$orange10" />
            <Text fontSize="$2" color="$orange11" fontWeight="500">
              Unsaved changes
            </Text>
          </> : null}
        {autoSaveStatus === 'saving' ? <>
            <Circle size="$0.5" backgroundColor="$blue10" animation="quick" />
            <Text fontSize="$2" color="$blue11">
              Saving...
            </Text>
          </> : null}
        {autoSaveStatus === 'saved' ? <>
            <CheckCircle size="$1" color="$green10" />
            <Text fontSize="$2" color="$green11">
              Saved {lastSaved ? `at ${lastSaved.toLocaleTimeString()}` : ''}
            </Text>
          </> : null}
        {autoSaveStatus === 'error' ? <>
            <Circle size="$0.5" backgroundColor="$red10" />
            <Text fontSize="$2" color="$red11">
              {autoSaveRetryCount && maxAutoSaveRetries && autoSaveRetryCount >= maxAutoSaveRetries
                ? 'Auto-save failed (max retries)'
                : `Auto-save failed${autoSaveRetryCount && maxAutoSaveRetries ? ` (retry ${autoSaveRetryCount}/${maxAutoSaveRetries})` : ''}`}
            </Text>
          </> : null}
      </XStack>
    </Card>
  )
}

// Compact summary component
function StepSummary({
  step,
  currentSelectedType,
  formData,
  activeComponents,
}: {
  step: 'basic' | 'components' | 'review'
  currentSelectedType?: EventType
  formData: any
  activeComponents: string[]
}) {
  if (step === 'basic') return null // No previous data to show

  return (
    <Card
      padding="$3"
      backgroundColor="$blue1"
      marginBottom="$4"
      borderWidth={1}
      borderColor="$blue5"
    >
      <YStack space="$2">
        <Text fontSize="$4" fontWeight="600" color="$blue11">
          Previous Details
        </Text>
        {step === 'components' ? (
          <XStack space="$4" flexWrap="wrap">
            <XStack space="$2" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$blue11">
                Type:
              </Text>
              <Text fontSize="$3" color="$blue11">
                {currentSelectedType?.replace('-', ' ')}
              </Text>
            </XStack>
            <XStack space="$2" alignItems="center">
              <Text fontSize="$3" fontWeight="600" color="$blue11">
                Title:
              </Text>
              <Text fontSize="$3" color="$blue11">
                {formData.title || 'Untitled'}
              </Text>
            </XStack>
            {currentSelectedType === 'baptism' && formData.candidate ? (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Candidate:
                </Text>
                <Text
                  fontSize="$3"
                  color="$blue11"
                >{`${formData.candidate.firstName} ${formData.candidate.lastName}`}</Text>
              </XStack>
            ) : null}
            {currentSelectedType === 'study-weekend' && formData.theme ? (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Theme:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {formData.theme}
                </Text>
              </XStack>
            ) : null}
            {currentSelectedType === 'wedding' && formData.couple ? (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Couple:
                </Text>
                <Text
                  fontSize="$3"
                  color="$blue11"
                >
                  {(() => {
                    const brideName = formData.couple.bride?.firstName || ''
                    const groomName = formData.couple.groom?.firstName || ''
                    if (!brideName && !groomName) return 'Wedding Couple'
                    if (!brideName) return groomName
                    if (!groomName) return brideName
                    return `${brideName} & ${groomName}`
                  })()}
                </Text>
              </XStack>
            ) : null}
            {currentSelectedType === 'engagement' && (formData.engagementProposed || formData.engagementTo) ? (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Engaged:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {formData.engagementProposed || '?'} & {formData.engagementTo || '?'}
                </Text>
              </XStack>
            ) : null}
          </XStack>
        ) : null}
        {step === 'review' ? (
          <YStack space="$1">
            <XStack space="$4" flexWrap="wrap">
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Type:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {currentSelectedType?.replace('-', ' ')}
                </Text>
              </XStack>
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Title:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {formData.title || 'Untitled'}
                </Text>
              </XStack>
            </XStack>
            {activeComponents.length > 0 ? (
              <XStack space="$2" alignItems="center">
                <Text fontSize="$3" fontWeight="600" color="$blue11">
                  Optional fields added:
                </Text>
                <Text fontSize="$3" color="$blue11">
                  {activeComponents.length}
                </Text>
              </XStack>
            ) : null}
          </YStack>
        ) : null}
      </YStack>
    </Card>
  )
}

export function ProgressiveEventForm({
  initialData,
  onSave,
  onAutoSave,
  onPreview,
  isLoading = false,
  skipTypeSelection = false,
  selectedType,
  onCancel,
  showSharingScope = false,
}: ProgressiveEventFormProps) {
  const [selectedTypeState, setSelectedType] = useState<EventType | undefined>(
    selectedType || initialData?.type
  )
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [autoSaveRetryCount, setAutoSaveRetryCount] = useState(0)
  const [persistentEventId, setPersistentEventId] = useState<string | undefined>(initialData?.id)
  const maxAutoSaveRetries = 3

  // Use prop selectedType if provided, otherwise use state
  const currentSelectedType = selectedType || selectedTypeState

  // Check if a location object has meaningful content (not just empty defaults)
  const hasLocationContent = (loc: any): boolean => {
    if (!loc) return false
    return !!(loc.name || loc.address || loc.city || loc.directions || loc.onlineMeeting?.link)
  }

  // Function to detect which components should be active based on existing data
  const getInitialActiveComponents = (): string[] => {
    if (!initialData) return []

    const active: string[] = []

    // Always check for description
    if (initialData.description) {
      active.push('description')
    }

    // Check for documents
    if (initialData.documents && initialData.documents.length > 0) {
      active.push('documents')
    }

    // Type-specific components
    if (currentSelectedType === 'study-weekend') {
      if (initialData.hostingEcclesia) active.push('hosting')
      if (hasLocationContent(initialData.location)) active.push('location')
      if (initialData.speakers && initialData.speakers.length > 0) active.push('speakers')
      if (initialData.schedule && initialData.schedule.length > 0) active.push('schedule')
      if (initialData.sections && initialData.sections.length > 0) active.push('sections')
      if (initialData.registration) active.push('registration')
    }

    if (currentSelectedType === 'baptism') {
      if (hasLocationContent(initialData.location)) active.push('location')
      if (initialData.candidate) active.push('candidate')
      if (initialData.sponsors && initialData.sponsors.length > 0) active.push('sponsors')
    }

    if (currentSelectedType === 'wedding') {
      if (initialData.ceremonyLocation) active.push('ceremony-location')
      if (initialData.reception) active.push('reception')
      if (initialData.weddingParty && initialData.weddingParty.length > 0)
        active.push('wedding-party')
    }

    if (currentSelectedType === 'funeral') {
      // Check for any location data - component ID is 'locations', not 'service-location'
      const funeralLocations = initialData.locations as any
      if (funeralLocations?.service || funeralLocations?.viewing || funeralLocations?.visitation || funeralLocations?.burial || funeralLocations?.graveside) {
        active.push('locations')
      }
      if (initialData.speakers && initialData.speakers.length > 0) active.push('speakers')
    }

    if (currentSelectedType === 'general') {
      if (hasLocationContent(initialData.location)) active.push('location')
      if (initialData.locations && Array.isArray(initialData.locations) && initialData.locations.length > 0) active.push('locations')
      if (initialData.speakers && initialData.speakers.length > 0) active.push('speakers')
      if (initialData.schedule && initialData.schedule.length > 0) active.push('schedule')
      if (initialData.sections && initialData.sections.length > 0) active.push('sections')
      if (initialData.registration) active.push('registration')
    }

    if (currentSelectedType === 'recurring') {
      if (hasLocationContent(initialData.location)) active.push('location')
    }

    return active
  }

  const [activeComponents, setActiveComponents] = useState<string[]>(getInitialActiveComponents())
  // Publish date state — source of truth for active/inactive/scheduled
  // null = inactive, past/now = active, future = scheduled
  const [eventPublishDate, setEventPublishDate] = useState<Date | null>(
    initialData?.publishDate ? new Date(initialData.publishDate) : null
  )
  // Start at 'basic' step if we're skipping type selection (edit mode) and have a type
  const [step, setStep] = useState<'type' | 'basic' | 'components' | 'review'>(
    skipTypeSelection && initialData?.type ? 'basic' : 'type'
  )

  // Normalize hostingEcclesia: ensure it's always an object { name, ... } not a plain string
  const normalizeHostingEcclesia = (val: any): { name: string; [k: string]: any } => {
    if (!val) return { name: HOME_ECCLESIA.canonicalName }
    if (typeof val === 'string') return { name: val }
    if (val.name) return val
    return { name: HOME_ECCLESIA.canonicalName }
  }

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isDirty, dirtyFields },
    reset,
  } = useForm({
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      publishDate: initialData?.publishDate || undefined, // Only set explicitly — never auto-reset
      membersOnly: initialData?.membersOnly || false,
      sharingScope: initialData?.sharingScope || 'own',
      // Type-specific defaults
      ...(currentSelectedType === 'study-weekend' && {
        dateRange: initialData?.dateRange || {
          start: new Date(),
          end: new Date(new Date().getTime() + 2 * 60 * 60 * 1000), // 2 hours later
          hidesTimes: false,
        },
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        hostingEcclesia: normalizeHostingEcclesia(initialData?.hostingEcclesia),
        location: initialData?.location || {
          mode: 'in-person', // Default to in-person
          name: '',
          address: '',
          city: '',
          province: '',
          country: 'Canada',
          postalCode: '',
          directions: '',
          parkingInfo: '',
          onlineMeeting: {
            link: '',
            platform: '',
            meetingId: '',
            password: '',
            dialInNumber: '',
            additionalInfo: ''
          }
        },
        theme: initialData?.theme || '',
        speakers: initialData?.speakers || [],
        schedule: initialData?.schedule || [],
        sections: initialData?.sections || [],
        registration: initialData?.registration || null,
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'funeral' && {
        serviceDate: initialData?.serviceDate || new Date(),
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        // Visitation (formerly viewing) - support both old and new field names
        visitationDate: initialData?.visitationDate || initialData?.viewingDate,
        visitationEndDate: initialData?.visitationEndDate,
        visitationSameLocation: initialData?.visitationSameLocation ?? true,
        // Graveside service
        hasGravesideService: initialData?.hasGravesideService ?? false,
        gravesideDate: initialData?.gravesideDate,
        deceased: initialData?.deceased || {
          title: '',
          firstName: '',
          lastName: '',
        },
        aboutDeceased: initialData?.aboutDeceased || '',
        deceasedPhoto: initialData?.deceasedPhoto || undefined,
        obituaryUrl: initialData?.obituaryUrl || '',
        locations: initialData?.locations || {
          service: {
            name: '',
            address: '',
            city: '',
            province: '',
          },
        },
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'wedding' && {
        ceremonyDate: initialData?.ceremonyDate || new Date(),
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        hostingEcclesia: normalizeHostingEcclesia(initialData?.hostingEcclesia),
        ceremonyLocation: initialData?.ceremonyLocation || {
          name: '',
          address: '',
          city: '',
          province: '',
        },
        couple: initialData?.couple || {
          bride: { firstName: '', lastName: '' },
          groom: { firstName: '', lastName: '' },
        },
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'engagement' && {
        engagementDate: initialData?.engagementDate || new Date(),
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        engagementProposed: initialData?.engagementProposed || '',
        engagementTo: initialData?.engagementTo || '',
        engagementAnnouncement: initialData?.engagementAnnouncement || '',
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'baptism' && {
        baptismDate: initialData?.baptismDate || new Date(),
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        candidate: initialData?.candidate || {
          firstName: '',
          lastName: '',
          testimony: '',
          baptismStatement: '',
        },
        aboutCandidate: initialData?.aboutCandidate || '',
        candidatePhoto: initialData?.candidatePhoto || undefined,
        hostingEcclesia: normalizeHostingEcclesia(initialData?.hostingEcclesia),
        location: initialData?.location || {
          name: '',
          address: '',
          city: '',
          province: '',
        },
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'general' && {
        startDate: initialData?.startDate,
        endDate: initialData?.endDate,
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        location: initialData?.location,
        speakers: initialData?.speakers || [],
        schedule: initialData?.schedule || [],
        sections: initialData?.sections || [],
        registration: initialData?.registration,
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'recurring' && {
        recurringConfig: initialData?.recurringConfig || {
          daysOfWeek: [],
          startTime: '7:00 PM',
          endTime: '8:30 PM',
          frequency: 'weekly',
          dateRange: {
            start: new Date(),
            end: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year later
            hidesTimes: true,
          },
          customDates: [],
          exceptions: [],
          location: '',
          description: '',
          contactPerson: '',
        },
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        location: initialData?.location || {
          name: '',
          address: '',
          city: '',
          province: '',
          country: 'Canada',
          postalCode: '',
          directions: '',
          parkingInfo: '',
        },
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'election-cycle' && {
        electionStartDate: initialData?.electionStartDate || new Date(),
        electionEndDate: initialData?.electionEndDate || new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days later
        eventTimezone: initialData?.eventTimezone || 'America/Toronto',
        documents: initialData?.documents || [],
      }),
    },
  })

  const getAvailableComponents = (): ComponentButton[] => {
    const baseComponents: ComponentButton[] = [
      {
        id: 'description',
        label: 'Event Description',
        icon: FileText,
        description: 'Detailed description of the event',
        component: (
          <OptimizedTextarea
            control={control}
            name="description"
            label="Event Description"
            placeholder="Provide a detailed description of the event"
            rows={6}
            maxLength={2000}
          />
        ),
      },
      {
        id: 'documents',
        label: 'Documents & Files',
        icon: FileText,
        description: 'Upload PDFs, images, and other files',
        component: (
          <DocumentsSection
            control={control}
            documents={watch('documents') || []}
            onChange={(documents) => setValue('documents', documents, { shouldDirty: true })}
          />
        ),
      },
    ]

    if (currentSelectedType === 'study-weekend') {
      return [
        {
          id: 'hosting',
          label: 'Hosting Ecclesia',
          icon: User,
          description: 'Which ecclesia is hosting the event',
          component: (
            <YStack padding="$3" gap="$3">
              <EcclesiaSearchInput
                control={control}
                name="hostingEcclesia"
                label="Hosting Ecclesia"
                placeholder="Search for hosting ecclesia..."
              />
            </YStack>
          ),
        },
        {
          id: 'location',
          label: 'Location Details',
          icon: MapPin,
          description: 'Event venue information',
          component: (
            <LocationSection
              control={control}
              setValue={setValue}
              namePrefix="location"
              title="Event Location"
              showAtTheHallOption={true}
              hostingEcclesiaFieldName="hostingEcclesia"
            />
          ),
        },
        {
          id: 'speakers',
          label: 'Speakers',
          icon: User,
          description: 'Add speakers and their information',
          component: <SpeakerSection control={control} namePrefix="speakers" />,
        },
        {
          id: 'schedule',
          label: 'Schedule',
          icon: Calendar,
          description: 'Detailed event schedule',
          component: <ScheduleSection control={control} namePrefix="schedule" />,
        },
        {
          id: 'sections',
          label: 'Sections (Multi-Location)',
          icon: Layers,
          description: 'Organize event into sections with different locations and days',
          component: <SectionsEditor control={control} namePrefix="sections" setValue={setValue as any} />,
        },
        {
          id: 'registration',
          label: 'Registration',
          icon: Settings,
          description: 'Registration requirements and fees',
          component: <RegistrationSection control={control} namePrefix="registration" />,
        },
        ...baseComponents,
      ]
    }

    if (currentSelectedType === 'funeral') {
      return [
        {
          id: 'locations',
          label: 'Service Locations',
          icon: MapPin,
          description: 'Service, visitation, and graveside locations',
          required: true,
          component: (
            <YStack space="$4">
              <LocationSection
                control={control}
                setValue={setValue}
                namePrefix="locations.service"
                title="Service Location"
                required
                showAtTheHallOption={true}
                hostingEcclesiaFieldName="hostingEcclesia"
              />
              {/* Only show visitation location if NOT same as service */}
              {!watch('visitationSameLocation') ? (
                <LocationSection
                  control={control}
                  setValue={setValue}
                  namePrefix="locations.visitation"
                  title="Visitation Location"
                />
              ) : null}
              {/* Only show graveside location if graveside service is enabled */}
              {watch('hasGravesideService') ? (
                <LocationSection
                  control={control}
                  setValue={setValue}
                  namePrefix="locations.graveside"
                  title="Graveside Location"
                />
              ) : null}
            </YStack>
          ),
        },
        {
          id: 'speakers',
          label: 'Service Speakers',
          icon: User,
          description: 'Speakers for the service',
          component: (
            <SpeakerSection
              control={control}
              namePrefix="serviceDetails.speakers"
              title="Service Speakers"
            />
          ),
        },
        ...baseComponents,
      ]
    }

    if (currentSelectedType === 'wedding') {
      return [
        {
          id: 'hosting',
          label: 'Hosting Ecclesia',
          icon: User,
          description: 'Which ecclesia is hosting this event',
          component: (
            <Card padding="$4" borderWidth={1} borderColor="$borderColor">
              <YStack space="$3">
                <XStack space="$2" alignItems="center">
                  <User size="$1" color="$green10" />
                  <Text fontSize="$5" fontWeight="600">
                    Hosting Ecclesia
                  </Text>
                </XStack>
                <EcclesiaSearchInput
                  control={control}
                  name="hostingEcclesia"
                  label="Hosting Ecclesia"
                  placeholder="Search for hosting ecclesia..."
                />
              </YStack>
            </Card>
          ),
        },
        {
          id: 'location',
          label: 'Ceremony Location',
          icon: MapPin,
          description: 'Wedding ceremony venue (may be different from hosting ecclesia)',
          required: true,
          component: (
            <LocationSection
              control={control}
              setValue={setValue}
              namePrefix="ceremonyLocation"
              title="Ceremony Location"
              required
              showAtTheHallOption={true}
              hostingEcclesiaFieldName="hostingEcclesia"
            />
          ),
        },
        {
          id: 'reception',
          label: 'Reception Details',
          icon: Calendar,
          description: 'Reception venue and details',
          component: (
            <YStack space="$4">
              <LocationSection
                control={control}
                setValue={setValue}
                namePrefix="reception.location"
                title="Reception Location"
              />
              <EventDatePicker
                control={control}
                name={"reception.date" as any}
                label="Reception Date"
                includeTime
                onDateChange={handleFieldChange}
              />
              <EventFormInput
                control={control}
                name={"reception.details" as any}
                label="Reception Details"
                placeholder="Additional reception information"
                multiline
              />
            </YStack>
          ),
        },
        {
          id: 'speakers',
          label: 'Service Speakers',
          icon: User,
          description: 'Speakers for the ceremony',
          component: (
            <SpeakerSection
              control={control}
              namePrefix="serviceDetails.speakers"
              title="Ceremony Speakers"
            />
          ),
        },
        ...baseComponents,
      ]
    }

    if (currentSelectedType === 'baptism') {
      return [
        {
          id: 'location',
          label: 'Event Location',
          icon: MapPin,
          description: 'Where the baptism will take place',
          required: true,
          component: (
            <LocationSection
              control={control}
              setValue={setValue}
              namePrefix="location"
              title="Event Location"
              required
              showAtTheHallOption={true}
              hostingEcclesiaFieldName="hostingEcclesia"
            />
          ),
        },
        {
          id: 'testimony',
          label: 'Candidate Testimony',
          icon: FileText,
          description: 'Candidate testimony and baptism statement',
          component: (
            <Card padding="$4" borderWidth={1} borderColor="$borderColor">
              <YStack space="$4">
                <XStack space="$2" alignItems="center">
                  <FileText size="$1" color="$blue10" />
                  <Text fontSize="$5" fontWeight="600">
                    Candidate Testimony
                  </Text>
                </XStack>
                <YStack space="$3">
                  <EventFormInput
                    control={control}
                    name="candidate.testimony"
                    label="Personal Testimony"
                    placeholder="Candidate's personal testimony"
                    multiline
                  />
                  <EventFormInput
                    control={control}
                    name="candidate.baptismStatement"
                    label="Baptism Statement"
                    placeholder="Statement of faith for baptism"
                    multiline
                  />
                </YStack>
              </YStack>
            </Card>
          ),
        },
        {
          id: 'speakers',
          label: 'Service Speakers',
          icon: User,
          description: 'Speakers for the baptism service',
          component: (
            <SpeakerSection
              control={control}
              namePrefix="serviceDetails.witnessingSpeakers"
              title="Witnessing Speakers"
            />
          ),
        },
        ...baseComponents,
      ]
    }

    if (currentSelectedType === 'general') {
      return [
        {
          id: 'location',
          label: 'Location Details',
          icon: MapPin,
          description: 'Event venue information',
          component: (
            <LocationSection
              control={control}
              setValue={setValue}
              namePrefix="location"
              title="Event Location"
              showAtTheHallOption={true}
              hostingEcclesiaFieldName="hostingEcclesia"
            />
          ),
        },
        {
          id: 'locations',
          label: 'Multiple Locations',
          icon: MapPin,
          description: 'Multiple venues for different parts of the event',
          component: (
            <MultipleLocationsSection
              control={control}
              namePrefix="locations"
              title="Event Locations"
            />
          ),
        },
        {
          id: 'speakers',
          label: 'Speakers',
          icon: User,
          description: 'Event speakers and presenters',
          component: <SpeakerSection control={control} namePrefix="speakers" />,
        },
        {
          id: 'schedule',
          label: 'Schedule',
          icon: Calendar,
          description: 'Event schedule and timeline',
          component: <ScheduleSection control={control} namePrefix="schedule" />,
        },
        {
          id: 'sections',
          label: 'Sections (Multi-Location)',
          icon: Layers,
          description: 'Organize event into sections with different locations and days',
          component: <SectionsEditor control={control} namePrefix="sections" setValue={setValue as any} />,
        },
        {
          id: 'registration',
          label: 'Registration',
          icon: Settings,
          description: 'Registration and attendance details',
          component: <RegistrationSection control={control} namePrefix="registration" />,
        },
        ...baseComponents,
      ]
    }

    if (currentSelectedType === 'recurring') {
      return [
        {
          id: 'location',
          label: 'Location Details',
          icon: MapPin,
          description: 'Where the recurring event takes place',
          component: (
            <LocationSection
              control={control}
              setValue={setValue}
              namePrefix="location"
              title="Event Location"
              required={false}
              showAtTheHallOption={true}
              hostingEcclesiaFieldName="hostingEcclesia"
            />
          ),
        },
        ...baseComponents,
      ]
    }

    if (currentSelectedType === 'election-cycle') {
      // Election cycle only needs description and documents
      return baseComponents
    }

    if (currentSelectedType === 'engagement') {
      // Engagement only needs description and documents
      return baseComponents
    }

    return baseComponents
  }

  const availableComponents = getAvailableComponents()

  // Auto-activate required components (e.g., baptism location)
  const requiredComponentIds = availableComponents.filter((c) => c.required).map((c) => c.id)
  useEffect(() => {
    const missing = requiredComponentIds.filter((id) => !activeComponents.includes(id))
    if (missing.length > 0) {
      setActiveComponents((prev) => [...new Set([...prev, ...missing])])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSelectedType])

  const activeComponentsData = availableComponents.filter((c) => activeComponents.includes(c.id))

  const handleTypeSelection = (type: EventType) => {
    setSelectedType(type)
    setStep('basic')
  }

  const addComponent = (componentId: string) => {
    if (!activeComponents.includes(componentId)) {
      setActiveComponents([...activeComponents, componentId])
    }
  }

  const removeComponent = (componentId: string) => {
    // Don't allow removing required components
    const comp = availableComponents.find((c) => c.id === componentId)
    if (comp?.required) return

    setActiveComponents(activeComponents.filter((id) => id !== componentId))

    // Clear form data for removed component so it doesn't persist on save/reload
    const fieldsToClear: Record<string, any> = {
      location: { location: undefined },
      locations: { locations: undefined },
      sections: { sections: undefined },
      hosting: { hostingEcclesia: undefined },
      speakers: { speakers: [] },
      schedule: { schedule: [] },
      registration: { registration: undefined },
    }
    const fields = fieldsToClear[componentId]
    if (fields) {
      for (const [field, value] of Object.entries(fields)) {
        setValue(field as any, value)
      }
    }
  }

  // Strip fields for optional components that aren't active
  // This prevents form defaults from being saved when the user hasn't added the component
  // Only strip if the component actually exists for this event type — fields rendered
  // in the basic info step (not as toggleable components) must never be stripped.
  const stripInactiveComponentFields = (data: any) => {
    const optionalFieldMap: Record<string, string[]> = {
      hosting: ['hostingEcclesia'],
      location: ['location'],
      locations: ['locations'],
      sections: ['sections'],
    }
    const availableIds = new Set(availableComponents.map((c) => c.id))
    const cleaned = { ...data }
    for (const [componentId, fields] of Object.entries(optionalFieldMap)) {
      // Only strip if this component exists as a toggleable section for the current type
      // AND the user hasn't activated it. If there's no such component, the field
      // lives in the basic info step and must be preserved.
      if (availableIds.has(componentId) && !activeComponents.includes(componentId)) {
        for (const field of fields) {
          delete cleaned[field]
        }
      }
    }
    return cleaned
  }

  const onSubmit = async (data: any) => {
    const cleanedData = stripInactiveComponentFields(data)

    // Check if event passes validation for legacy status field
    const validation = EventValidator.canPublish({ ...cleanedData, type: currentSelectedType } as Partial<Event>)
    const status: EventStatus = validation.isValid ? 'ready' : 'draft'

    const eventData = {
      ...cleanedData,
      type: currentSelectedType,
      id: persistentEventId,
      publishDate: eventPublishDate || undefined,
      active: eventPublishDate ? new Date(eventPublishDate).getTime() <= Date.now() : false, // @deprecated — derived from publishDate
      status, // Legacy: kept for backward compatibility
    }
    await onSave(eventData)
  }

  const currentFormData = watch()

  // Initialize recurringConfig when type changes to recurring
  useEffect(() => {
    if (currentSelectedType === 'recurring') {
      const currentConfig = getValues('recurringConfig')
      if (!currentConfig || !currentConfig.frequency) {
        setValue('recurringConfig', {
          daysOfWeek: [] as number[],
          startTime: '19:00',
          endTime: '20:30',
          frequency: 'weekly' as const,
          dateRange: {
            start: new Date(),
            end: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year later
            hidesTimes: false,
          } as { start: Date; end: Date; hidesTimes: boolean },
          exceptions: [],
          location: '',
          description: '',
          contactPerson: '',
          ...currentConfig // Preserve any existing values
        } as any)
      }
    }
  }, [currentSelectedType, setValue, getValues])

  // Manual save draft function
  const handleManualSave = async () => {
    if (!onAutoSave || !currentSelectedType) return

    try {
      setAutoSaveStatus('saving')
      const eventData = {
        ...stripInactiveComponentFields(currentFormData),
        type: currentSelectedType,
        id: persistentEventId,
        publishDate: eventPublishDate || undefined,
      active: eventPublishDate ? new Date(eventPublishDate).getTime() <= Date.now() : false, // @deprecated — derived from publishDate
      }
      const savedEvent = await onAutoSave(eventData)

      // Capture the ID from the first save for subsequent saves
      if (!persistentEventId && savedEvent?.id) {
        setPersistentEventId(savedEvent.id)
      }

      setAutoSaveStatus('saved')
      setLastSaved(new Date())
      setAutoSaveRetryCount(0)

      // Reset dirty state after successful save
      reset(currentFormData, { keepValues: true })

      // Reset to idle after showing saved status briefly
      setTimeout(() => setAutoSaveStatus('idle'), 3000)

      return true // Success
    } catch (error) {
      console.error('Manual save failed:', error)
      setAutoSaveStatus('error')
      setTimeout(() => setAutoSaveStatus('idle'), 5000)
      return false // Failure
    }
  }

  // Save and navigate function
  const handleSaveAndContinue = async (nextStep: 'basic' | 'components' | 'review') => {
    if (isDirty) {
      const success = await handleManualSave()
      if (!success) return // Don't navigate if save failed
    }
    setStep(nextStep)
  }

  // Helper for triggering saves on important field changes
  const handleFieldChange = async () => {
    // Save after short delay to allow form state to update
    setTimeout(() => {
      if (isDirty) {
        handleManualSave()
      }
    }, 100)
  }

  // Debounced auto-save functionality with retry limits (currently disabled)
  const debouncedAutoSave = useCallback(
    (() => {
      let timeoutId: ReturnType<typeof setTimeout>
      return (data: any) => {
        if (!onAutoSave) return

        // Don't attempt auto-save if we're in error state and have exceeded retry limit
        if (autoSaveStatus === 'error' && autoSaveRetryCount >= maxAutoSaveRetries) {
          return
        }

        // Don't auto-save if already saving
        if (autoSaveStatus === 'saving') {
          return
        }

        clearTimeout(timeoutId)
        timeoutId = setTimeout(async () => {
          if (!currentSelectedType) return // Don't auto-save without a type

          try {
            setAutoSaveStatus('saving')
            const eventData = {
              ...stripInactiveComponentFields(data),
              type: currentSelectedType,
              id: persistentEventId, // Use persistent ID for all saves
              publishDate: eventPublishDate || undefined,
      active: eventPublishDate ? new Date(eventPublishDate).getTime() <= Date.now() : false, // @deprecated — derived from publishDate
            }
            const savedEvent = await onAutoSave(eventData)

            // Capture the ID from the first save for subsequent saves
            if (!persistentEventId && savedEvent?.id) {
              setPersistentEventId(savedEvent.id)
            }
            setAutoSaveStatus('saved')
            setLastSaved(new Date())
            // Reset retry count on successful save
            setAutoSaveRetryCount(0)

            // Reset to idle after showing saved status briefly
            setTimeout(() => setAutoSaveStatus('idle'), 3000)
          } catch (error) {
            console.error('Auto-save failed:', error)
            setAutoSaveRetryCount((prev) => prev + 1)
            setAutoSaveStatus('error')

            // If we haven't exceeded retry limit, try again with incremental backoff
            if (autoSaveRetryCount < maxAutoSaveRetries - 1) {
              // Incremental delays: 0.5s, 1s, 3s, 6s, 20s...
              const delays = [500, 1000, 3000, 6000, 20000]
              const backoffDelay = delays[autoSaveRetryCount] || 30000
              setTimeout(() => setAutoSaveStatus('idle'), backoffDelay)
            } else {
              // Max retries reached, stay in error state longer
              setTimeout(() => setAutoSaveStatus('idle'), 10000) // 10 seconds
            }
          }
        }, 5000) // 5 second debounce to reduce excessive triggers
      }
    })(),
    [
      onAutoSave,
      currentSelectedType,
      initialData?.id,
      autoSaveStatus,
      autoSaveRetryCount,
      maxAutoSaveRetries,
    ]
  )

  // DISABLED: Auto-save was too expensive and triggering before user changes
  // TODO: Implement smart widget-level change events instead
  // - Text inputs: onChange after user stops typing (debounced)
  // - Calendar widget: onChange only when dismissed/closed
  // - Dropdowns: onChange when selection made
  // - Checkboxes: onChange immediately

  // useEffect(() => {
  //   if (step !== 'type' && currentSelectedType) {
  //     const hasMinimalData = currentFormData.title?.trim() ||
  //       currentFormData.theme?.trim() ||
  //       currentFormData.candidate?.firstName?.trim() ||
  //       currentFormData.couple?.bride?.firstName?.trim() ||
  //       currentFormData.deceased?.firstName?.trim()
  //
  //     if (hasMinimalData) {
  //       debouncedAutoSave(currentFormData)
  //     }
  //   }
  // }, [currentFormData, step, currentSelectedType, debouncedAutoSave])

  // Step 1: Type Selection
  if (step === 'type') {
    return (
      <YStack space="$4">
        <StepBreadcrumb
          currentStep="type"
          currentSelectedType={currentSelectedType}
          skipTypeSelection={skipTypeSelection}
          autoSaveStatus={autoSaveStatus}
          lastSaved={lastSaved}
          autoSaveRetryCount={autoSaveRetryCount}
          maxAutoSaveRetries={maxAutoSaveRetries}
          isDirty={isDirty}
        />
        <EventTypeSelector
          value={currentSelectedType}
          onSelect={handleTypeSelection}
          disabled={isLoading}
        />
      </YStack>
    )
  }

  // Step 2: Basic Information
  if (step === 'basic') {
    return (
      <YStack space="$4">
        <StepBreadcrumb
          currentStep="basic"
          currentSelectedType={currentSelectedType}
          skipTypeSelection={skipTypeSelection}
          autoSaveStatus={autoSaveStatus}
          lastSaved={lastSaved}
          autoSaveRetryCount={autoSaveRetryCount}
          maxAutoSaveRetries={maxAutoSaveRetries}
          isDirty={isDirty}
        />
        <EventActivationSection
          formData={currentFormData}
          currentSelectedType={currentSelectedType}
          publishDate={eventPublishDate}
          onActivate={() => setEventPublishDate(new Date())}
          onDeactivate={() => setEventPublishDate(null)}
          onSchedule={(date) => setEventPublishDate(date)}
        />
        <StepSummary
          step="basic"
          currentSelectedType={currentSelectedType}
          formData={currentFormData}
          activeComponents={activeComponents}
        />
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <YStack space="$4">
            <Text fontSize="$6" fontWeight="bold">
              Basic Event Information
            </Text>

            <EventFormInput
              control={control}
              name="title"
              label="Event Title"
              placeholder="Enter event title"
              required
            />

            {currentSelectedType === 'study-weekend' ? <>
                <EventFormInput
                  control={control}
                  name="theme"
                  label="Theme"
                  placeholder="Event theme or topic"
                />

                <XStack space="$3" flexWrap="wrap">
                  <YStack flex={2} minWidth={200}>
                    <EventDateRangePicker
                      control={control}
                      name="dateRange"
                      label="Event Dates"
                      required
                      allowSingleDay={false}
                      allowHideTimes={true}
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={180}>
                    <EventFormSelect
                      control={control}
                      name="eventTimezone"
                      label="Timezone"
                      options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                    />
                  </YStack>
                </XStack>
              </> : null}

            {currentSelectedType === 'funeral' ? <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Deceased Information
                  </Text>
                  <XStack space="$3" flexWrap="wrap">
                    <YStack width={120}>
                      <EventFormSelect
                        control={control}
                        name="deceased.title"
                        label="Title"
                        options={[
                          { label: '(None)', value: '' },
                          { label: 'Brother', value: 'Brother' },
                          { label: 'Sister', value: 'Sister' },
                          { label: 'Mr.', value: 'Mr.' },
                          { label: 'Mrs.', value: 'Mrs.' },
                          { label: 'Ms.', value: 'Ms.' },
                        ]}
                      />
                    </YStack>
                    <YStack flex={1} minWidth={150}>
                      <EventFormInput
                        control={control}
                        name="deceased.firstName"
                        label="First Name"
                        required
                      />
                    </YStack>
                    <YStack flex={1} minWidth={150}>
                      <EventFormInput
                        control={control}
                        name="deceased.lastName"
                        label="Last Name"
                        required
                      />
                    </YStack>
                  </XStack>

                  {/* Date of Passing - internal tracking only */}
                  <YStack width={200} marginTop="$2">
                    <EventDatePicker
                      control={control}
                      name={"dateOfPassing" as any}
                      label="Date of Passing"
                    />
                  </YStack>
                </YStack>

                {/* Service Date + Timezone */}
                <XStack space="$3" flexWrap="wrap">
                  <YStack flex={2} minWidth={200}>
                    <EventDatePicker
                      control={control}
                      name="serviceDate"
                      label="Service Date/Time"
                      includeTime
                      required
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={180}>
                    <EventFormSelect
                      control={control}
                      name="eventTimezone"
                      label="Timezone"
                      options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                    />
                  </YStack>
                </XStack>

                {/* Visitation Section */}
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">Visitation</Text>
                  <XStack space="$3" flexWrap="wrap">
                    <YStack flex={1} minWidth={200}>
                      <EventDatePicker
                        control={control}
                        name="visitationDate"
                        label="Start Date/Time"
                        includeTime
                        onDateChange={(date) => {
                          if (date) {
                            const startDate = new Date(date)

                            // Auto-set end date to 1 hour after start if not already set or if before start
                            const currentEndDate = getValues('visitationEndDate')
                            const endDate = currentEndDate ? new Date(currentEndDate) : null
                            if (!endDate || endDate <= startDate) {
                              const newEndDate = new Date(startDate)
                              newEndDate.setHours(newEndDate.getHours() + 1)
                              setValue('visitationEndDate', newEndDate, { shouldDirty: true })
                            }

                            // Auto-set service date to day after visitation if not already set
                            const currentServiceDate = getValues('serviceDate')
                            if (!currentServiceDate) {
                              const newServiceDate = new Date(startDate)
                              newServiceDate.setDate(newServiceDate.getDate() + 1)
                              // Default service time to 11:00 AM (common funeral time)
                              newServiceDate.setHours(11, 0, 0, 0)
                              setValue('serviceDate', newServiceDate, { shouldDirty: true })
                            }
                          }
                          handleFieldChange()
                        }}
                      />
                    </YStack>
                    <YStack flex={1} minWidth={200}>
                      <EventDatePicker
                        control={control}
                        name="visitationEndDate"
                        label="End Date/Time"
                        includeTime
                        onDateChange={handleFieldChange}
                      />
                    </YStack>
                  </XStack>
                  <CheckboxWithCheck
                    control={control}
                    name="visitationSameLocation"
                    label="Same location as funeral service"
                  />
                </YStack>

                {/* Graveside Service Section */}
                <YStack space="$3">
                  <CheckboxWithCheck
                    control={control}
                    name="hasGravesideService"
                    label="Graveside service"
                  />
                  {watch('hasGravesideService') ? (
                    <YStack paddingLeft="$4">
                      <EventDatePicker
                        control={control}
                        name="gravesideDate"
                        label="Graveside Date/Time"
                        includeTime
                        onDateChange={handleFieldChange}
                      />
                    </YStack>
                  ) : null}
                </YStack>

                {/* Deceased Photo Upload */}
                <YStack marginTop="$4">
                  <ImageUpload
                    value={watch('deceasedPhoto')}
                    onChange={(photo) => setValue('deceasedPhoto', photo, { shouldDirty: true })}
                    label="Photo of the Deceased (Optional)"
                    placeholder="If you have an image of the deceased, upload here"
                  />
                </YStack>

                {/* About the Deceased */}
                <YStack space="$3" marginTop="$5">
                  <Text fontSize="$5" fontWeight="600">
                    About the Deceased
                  </Text>
                  <Text fontSize="$3" color="$gray11">
                    Share a brief biography or tribute. You can include links by typing the full URL.
                  </Text>
                  <OptimizedTextarea
                    control={control}
                    name="aboutDeceased"
                    label=""
                    placeholder="Share memories, tributes, or a biography of the deceased..."
                    rows={6}
                    maxLength={5000}
                  />
                </YStack>

                {/* Online Obituary Link */}
                <YStack space="$3" marginTop="$5">
                  <Text fontSize="$5" fontWeight="600">
                    Online Obituary (Optional)
                  </Text>
                  <Text fontSize="$3" color="$gray11">
                    Link to the official online obituary.
                  </Text>
                  <EventFormInput
                    control={control}
                    name="obituaryUrl"
                    label=""
                    placeholder="https://..."
                  />
                </YStack>
              </> : null}

            {currentSelectedType === 'wedding' ? <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Couple Information
                  </Text>
                  <XStack space="$3">
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="couple.bride.firstName"
                        label="Bride First Name"
                        required
                      />
                    </YStack>
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="couple.bride.lastName"
                        label="Bride Last Name"
                        required
                      />
                    </YStack>
                  </XStack>
                  <XStack space="$3">
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="couple.groom.firstName"
                        label="Groom First Name"
                        required
                      />
                    </YStack>
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="couple.groom.lastName"
                        label="Groom Last Name"
                        required
                      />
                    </YStack>
                  </XStack>
                </YStack>

                <XStack space="$3" flexWrap="wrap">
                  <YStack flex={2} minWidth={200}>
                    <EventDatePicker
                      control={control}
                      name="ceremonyDate"
                      label="Ceremony Date"
                      includeTime
                      allowHideTimes
                      required
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={180}>
                    <EventFormSelect
                      control={control}
                      name="eventTimezone"
                      label="Timezone"
                      options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                    />
                  </YStack>
                </XStack>
              </> : null}

            {currentSelectedType === 'engagement' ? <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Engagement Information
                  </Text>

                  <XStack space="$3" flexWrap="wrap">
                    <YStack flex={2} minWidth={200}>
                      <EventDatePicker
                        control={control}
                        name="engagementDate"
                        label="Date of Engagement"
                        required
                        onDateChange={handleFieldChange}
                      />
                    </YStack>
                    <YStack flex={1} minWidth={180}>
                      <EventFormSelect
                        control={control}
                        name="eventTimezone"
                        label="Timezone"
                        options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                      />
                    </YStack>
                  </XStack>

                  <XStack space="$3">
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="engagementProposed"
                        label="Proposed"
                        placeholder="e.g., Brother Gord Easson"
                        required
                      />
                    </YStack>
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="engagementTo"
                        label="To"
                        placeholder="e.g., Sister Jane Smith"
                        required
                      />
                    </YStack>
                  </XStack>

                  {/* Live Preview */}
                  {(watch('engagementProposed') || watch('engagementTo')) ? (
                    <Card padding="$3" backgroundColor="$yellow2" borderWidth={1} borderColor="$yellow6">
                      <YStack space="$1">
                        <Text fontSize="$3" fontWeight="600" color="$yellow11">
                          Preview:
                        </Text>
                        <Text fontSize="$4" color="$yellow11">
                          {watch('engagementProposed') || '[Proposed]'} is engaged to {watch('engagementTo') || '[To]'},{' '}
                          {watch('engagementDate')
                            ? new Date(watch('engagementDate') as string | Date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : '[Date]'}.
                        </Text>
                      </YStack>
                    </Card>
                  ) : null}

                  <OptimizedTextarea
                    control={control}
                    name="engagementAnnouncement"
                    label="Announcement"
                    placeholder="Write the announcement for this engagement..."
                    rows={4}
                    maxLength={2000}
                  />
                </YStack>
              </> : null}

            {currentSelectedType === 'baptism' ? <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Candidate Information
                  </Text>
                  <XStack space="$3">
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="candidate.firstName"
                        label="Candidate First Name"
                        required
                      />
                    </YStack>
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="candidate.lastName"
                        label="Candidate Last Name"
                        required
                      />
                    </YStack>
                  </XStack>
                </YStack>

                <XStack space="$3" flexWrap="wrap">
                  <YStack flex={2} minWidth={200}>
                    <EventDatePicker
                      control={control}
                      name="baptismDate"
                      label="Baptism Date & Time"
                      includeTime
                      required
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={180}>
                    <EventFormSelect
                      control={control}
                      name="eventTimezone"
                      label="Timezone"
                      options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                    />
                  </YStack>
                </XStack>

                <EcclesiaSearchInput
                  control={control}
                  name="hostingEcclesia"
                  label="Hosting Ecclesia"
                  placeholder="Search for hosting ecclesia..."
                />

                {/* Candidate Photo Upload */}
                <ImageUpload
                  value={watch('candidatePhoto')}
                  onChange={(photo) => setValue('candidatePhoto', photo, { shouldDirty: true })}
                  label="Photo of the Candidate (Optional)"
                  placeholder="If you have a photo of the candidate, upload here"
                />

                {/* About the Candidate */}
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    About the Candidate
                  </Text>
                  <Text fontSize="$3" color="$gray11">
                    Share a brief biography or testimony. You can include links by typing the full URL.
                  </Text>
                  <OptimizedTextarea
                    control={control}
                    name="aboutCandidate"
                    label=""
                    placeholder="Share the candidate's journey to baptism, their background, or a brief testimony..."
                    rows={6}
                    maxLength={5000}
                  />
                </YStack>
              </> : null}

            {currentSelectedType === 'general' ? <YStack space="$3">
                <XStack space="$3" flexWrap="wrap">
                  <YStack flex={1} minWidth={150}>
                    <EventDatePicker
                      control={control}
                      name="startDate"
                      label="Start Date"
                      includeTime
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={150}>
                    <EventDatePicker
                      control={control}
                      name="endDate"
                      label="End Date"
                      includeTime
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={180}>
                    <EventFormSelect
                      control={control}
                      name="eventTimezone"
                      label="Timezone"
                      options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                    />
                  </YStack>
                </XStack>
              </YStack> : null}

            {currentSelectedType === 'recurring' ? <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Recurring Schedule
                  </Text>
                  <Text fontSize="$3" color="$gray11">
                    Configure when and how often this event occurs.
                  </Text>
                </YStack>

                {/* Recurrence Frequency */}
                <YStack space="$2">
                  <EventFormSelect
                    control={control}
                    name="recurringConfig.frequency"
                    label="Repeat"
                    placeholder="How often does this event occur?"
                    required
                    options={[
                      { label: 'Weekly', value: 'weekly' },
                      { label: 'Bi-weekly', value: 'biweekly' },
                      { label: 'Monthly', value: 'monthly' },
                      { label: 'Select specific dates', value: 'custom' },
                    ]}
                  />
                </YStack>

                {/* Days of Week - Show only for weekly/biweekly */}
                {(watch('recurringConfig.frequency') === 'weekly' || 
                  watch('recurringConfig.frequency') === 'biweekly') ? <YStack space="$2">
                    <Text fontSize="$4" fontWeight="600">
                      Repeat on these days:
                      <Text fontSize="$3" color="$red10">*</Text>
                    </Text>
                    <XStack flexWrap="wrap" gap="$2">
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => {
                        const daysOfWeek = watch('recurringConfig.daysOfWeek') || []
                        const isChecked = daysOfWeek.includes(index)
                        
                        return (
                          <Button
                            key={day}
                            size="$3"
                            borderWidth={2}
                            borderColor={isChecked ? '$primary' : '$textTertiary'}
                            backgroundColor={isChecked ? '$primary' : 'transparent'}
                            color={isChecked ? 'white' : '$color'}
                            hoverStyle={{
                              backgroundColor: isChecked ? '$primaryHover' : '$backgroundSecondary'
                            }}
                            onPress={() => {
                              const currentDays = watch('recurringConfig.daysOfWeek') || []
                              if (isChecked) {
                                setValue('recurringConfig.daysOfWeek', 
                                  currentDays.filter(d => d !== index),
                                  { shouldDirty: true }
                                )
                              } else {
                                setValue('recurringConfig.daysOfWeek', 
                                  [...currentDays, index].sort(),
                                  { shouldDirty: true }
                                )
                              }
                              handleFieldChange()
                            }}
                          >
                            {day.substring(0, 3)}
                          </Button>
                        )
                      })}
                    </XStack>
                  </YStack> : null}

                {/* Monthly Pattern Detection */}
                {watch('recurringConfig.frequency') === 'monthly' ? <YStack space="$2" padding="$3" backgroundColor="$backgroundSecondary" borderRadius="$4">
                    <Text fontSize="$4" fontWeight="600">Monthly Recurrence</Text>
                    <Text fontSize="$3" color="$gray11">
                      Event will occur on the same day each month as selected in the date range below.
                    </Text>
                  </YStack> : null}

                {/* Custom Date Selection */}
                {watch('recurringConfig.frequency') === 'custom' ? <YStack space="$2">
                    <MultiDateSelector
                      control={control}
                      name="recurringConfig.customDates"
                      label="Select Specific Dates"
                      required
                      onDateChange={handleFieldChange}
                    />
                  </YStack> : null}

                {/* Time Selection + Timezone */}
                <XStack space="$3" flexWrap="wrap">
                  <YStack flex={1} minWidth={120}>
                    <TimeSelector
                      control={control}
                      name="recurringConfig.startTime"
                      label="Start Time"
                      required
                    />
                  </YStack>
                  <YStack flex={1} minWidth={120}>
                    <TimeSelector
                      control={control}
                      name="recurringConfig.endTime"
                      label="End Time"
                      required
                    />
                  </YStack>
                  <YStack flex={1} minWidth={180}>
                    <EventFormSelect
                      control={control}
                      name="eventTimezone"
                      label="Timezone"
                      options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                    />
                  </YStack>
                </XStack>

                {/* Date Range - only for non-custom recurring events */}
                {watch('recurringConfig.frequency') !== 'custom' ? <EventDateRangePicker
                    control={control}
                    name="recurringConfig.dateRange"
                    label="Date Range"
                    onDateChange={handleFieldChange}
                    required
                    allowSingleDay={true}
                    hidesTimes={true}
                  /> : null}

                <EventFormInput
                  control={control}
                  name="recurringConfig.contactPerson"
                  label="Contact Person"
                  placeholder="e.g., Brother Smith"
                />

                {/* Recurrence Rules Summary */}
                {(() => {
                  const frequency = watch('recurringConfig.frequency')
                  const startTime = watch('recurringConfig.startTime')
                  const endTime = watch('recurringConfig.endTime')
                  const daysOfWeek = watch('recurringConfig.daysOfWeek') || []
                  const dateRange = watch('recurringConfig.dateRange')
                  const customDates = watch('recurringConfig.customDates') || []

                  if (!frequency) return null

                  // Helper function to ensure 12-hour format
                  const formatTime = (timeStr: string) => {
                    if (!timeStr) return ''
                    // If it's already in 12-hour format (contains AM/PM), return as is
                    if (timeStr.match(/\s*(AM|PM)$/i)) {
                      return timeStr
                    }
                    // Convert 24-hour to 12-hour if needed
                    const [hours, minutes] = timeStr.split(':')
                    const hour24 = parseInt(hours)
                    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
                    const period = hour24 >= 12 ? 'PM' : 'AM'
                    return `${hour12}:${minutes} ${period}`
                  }

                  let summaryText = ''
                  
                  if (frequency === 'custom' && customDates.length > 0) {
                    summaryText = `This event will occur on ${customDates.length} specific date${customDates.length > 1 ? 's' : ''}`
                    if (startTime && endTime) {
                      summaryText += ` from ${formatTime(startTime)} to ${formatTime(endTime)}`
                    }
                    summaryText += '.'
                  } else if (frequency === 'weekly' && daysOfWeek.length > 0) {
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                    const selectedDays = daysOfWeek.map(d => dayNames[d]).join(', ')
                    summaryText = `This event will occur every week on ${selectedDays}`
                    if (startTime && endTime) {
                      summaryText += ` from ${formatTime(startTime)} to ${formatTime(endTime)}`
                    }
                    if (dateRange?.start && dateRange?.end) {
                      const startDate = new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      const endDate = new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      summaryText += `, starting ${startDate} and ending ${endDate}`
                    }
                    summaryText += '.'
                  } else if (frequency === 'biweekly' && daysOfWeek.length > 0) {
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                    const selectedDays = daysOfWeek.map(d => dayNames[d]).join(', ')
                    summaryText = `This event will occur every two weeks on ${selectedDays}`
                    if (startTime && endTime) {
                      summaryText += ` from ${formatTime(startTime)} to ${formatTime(endTime)}`
                    }
                    if (dateRange?.start && dateRange?.end) {
                      const startDate = new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      const endDate = new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      summaryText += `, starting ${startDate} and ending ${endDate}`
                    }
                    summaryText += '.'
                  } else if (frequency === 'monthly' && dateRange?.start) {
                    const startDate = new Date(dateRange.start)
                    const dayOfMonth = startDate.getDate()
                    const weekOfMonth = Math.ceil(dayOfMonth / 7)
                    const dayName = startDate.toLocaleDateString('en-US', { weekday: 'long' })
                    
                    const ordinals = ['', 'first', 'second', 'third', 'fourth', 'fifth']
                    const ordinal = ordinals[weekOfMonth] || `${weekOfMonth}th`
                    
                    summaryText = `This event will occur on the ${ordinal} ${dayName} of every month`
                    if (startTime && endTime) {
                      summaryText += ` from ${formatTime(startTime)} to ${formatTime(endTime)}`
                    }
                    if (dateRange?.start && dateRange?.end) {
                      const startDateStr = new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      const endDateStr = new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      summaryText += `, starting ${startDateStr} and ending ${endDateStr}`
                    }
                    summaryText += '.'
                  }

                  return summaryText ? (
                    <YStack space="$2" padding="$3" backgroundColor="$blue1" borderRadius="$4" borderWidth={1} borderColor="$blue5">
                      <Text fontSize="$4" fontWeight="600" color="$blue11">
                        Recurrence Summary
                      </Text>
                      <Text fontSize="$3" color="$blue11">
                        {summaryText}
                      </Text>
                    </YStack>
                  ) : null
                })()}
              </> : null}

            {currentSelectedType === 'election-cycle' ? <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Election Voting Period
                  </Text>
                  <Text fontSize="$3" color="$gray11">
                    Set the start and end dates for the election voting window.
                  </Text>
                </YStack>

                <XStack space="$3" flexWrap="wrap">
                  <YStack flex={1} minWidth={150}>
                    <EventDatePicker
                      control={control}
                      name="electionStartDate"
                      label="Voting Opens"
                      required
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={150}>
                    <EventDatePicker
                      control={control}
                      name="electionEndDate"
                      label="Voting Closes"
                      required
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1} minWidth={180}>
                    <EventFormSelect
                      control={control}
                      name="eventTimezone"
                      label="Timezone"
                      options={TIMEZONE_OPTIONS.map(tz => ({ label: tz.label, value: tz.value }))}
                    />
                  </YStack>
                </XStack>
              </> : null}

            <YStack marginTop="$5">
              <CheckboxWithCheck
                control={control}
                name="membersOnly"
                label="Members Only - Restrict viewing to Toronto East Ecclesia members"
              />
            </YStack>

            {showSharingScope ? (
              <YStack marginTop="$3">
                <EventFormSelect
                  control={control}
                  name="sharingScope"
                  label="Event Sharing"
                  options={[
                    { value: 'own', label: 'Own Ecclesia Only' },
                    { value: 'region', label: 'Regional' },
                    { value: 'global', label: 'Global' },
                  ]}
                />
              </YStack>
            ) : null}

          </YStack>
        </Card>

        <XStack space="$3" justifyContent="space-between">
          <Button
            variant="outlined"
            onPress={handleManualSave}
            disabled={isLoading || autoSaveStatus === 'saving'}
            theme="green"
          >
            {autoSaveStatus === 'saving' ? 'Saving...' : 'Save'}
          </Button>

          <XStack space="$3">
            {!skipTypeSelection ? <Button variant="outlined" onPress={() => setStep('type')} disabled={isLoading}>
                Back
              </Button> : null}
            <Button onPress={() => handleSaveAndContinue('components')} disabled={isLoading}>
              Continue
            </Button>
          </XStack>
        </XStack>
      </YStack>
    )
  }

  // Step 3: Optional Components
  if (step === 'components') {
    return (
      <YStack space="$4">
        <StepBreadcrumb
          currentStep="components"
          currentSelectedType={currentSelectedType}
          skipTypeSelection={skipTypeSelection}
          autoSaveStatus={autoSaveStatus}
          lastSaved={lastSaved}
          autoSaveRetryCount={autoSaveRetryCount}
          maxAutoSaveRetries={maxAutoSaveRetries}
          isDirty={isDirty}
        />
        <EventActivationSection
          formData={currentFormData}
          currentSelectedType={currentSelectedType}
          publishDate={eventPublishDate}
          onActivate={() => setEventPublishDate(new Date())}
          onDeactivate={() => setEventPublishDate(null)}
          onSchedule={(date) => setEventPublishDate(date)}
        />
        <StepSummary
          step="components"
          currentSelectedType={currentSelectedType}
          formData={currentFormData}
          activeComponents={activeComponents}
        />
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <YStack space="$4">
            <Text fontSize="$6" fontWeight="bold">
              Event Components
            </Text>
            <Text color="$gray11" fontSize="$4">
              {activeComponents.length > 0
                ? 'Review and edit your event components below. You can collapse sections or add more components.'
                : 'Add optional components to enhance your event. You can add these now or come back later.'}
            </Text>

            <XStack space="$2" flexWrap="wrap">
              {availableComponents
                .filter((c) => !activeComponents.includes(c.id))
                .map((component) => {
                  const IconComponent = component.icon
                  return (
                    <Button
                      key={component.id}
                      size="$3"
                      variant="outlined"
                      onPress={() => addComponent(component.id)}
                      icon={<IconComponent size="$1" />}
                      marginBottom="$2"
                    >
                      {component.label}
                    </Button>
                  )
                })}
            </XStack>
          </YStack>
        </Card>

        <YStack gap="$3" padding="$3">
          {activeComponentsData.map((component) => {
            // Get add function and button text based on component type
            const getAddProps = () => {
              switch (component.id) {
                case 'speakers':
                  return {
                    onAdd: () => {
                      // Trigger the SpeakerSection's add function
                      const speakersField = getValues('speakers') || []
                      setValue('speakers', [
                        ...speakersField,
                        { firstName: '', lastName: '', ecclesia: '' },
                      ])
                    },
                    addButtonText: 'Add Speaker',
                    icon: User,
                    iconColor: '$green10',
                  }
                case 'schedule':
                  return {
                    onAdd: () => {
                      // Trigger the ScheduleSection's add function
                      const scheduleField = getValues('schedule') || []
                      setValue('schedule', [
                        ...scheduleField,
                        {
                          title: '',
                          startTime: new Date(),
                          endTime: null,
                          description: '',
                          type: 'talk',
                          notes: '',
                        },
                      ])
                    },
                    addButtonText: 'Add Item',
                    icon: Calendar,
                    iconColor: '$purple10',
                  }
                case 'locations':
                  return {
                    onAdd: () => {
                      // Trigger the MultipleLocationsSection's add function
                      const locationsField = (getValues('locations') || []) as any[]
                      setValue('locations', [
                        ...locationsField,
                        {
                          type: 'main',
                          name: '',
                          address: '',
                          city: '',
                          province: '',
                          country: 'Canada',
                          postalCode: '',
                          directions: '',
                          parkingInfo: '',
                        },
                      ])
                    },
                    addButtonText: 'Add Location',
                    icon: MapPin,
                    iconColor: '$blue10',
                  }
                default:
                  return {
                    icon: component.icon,
                    iconColor: '$gray10',
                  }
              }
            }

            const addProps = getAddProps()

            return (
              <CollapsibleComponent
                key={component.id}
                title={component.label}
                onRemove={() => removeComponent(component.id)}
                defaultExpanded={true}
                {...addProps}
              >
                {component.component}
              </CollapsibleComponent>
            )
          })}
        </YStack>

        <Separator />

        <XStack space="$3" justifyContent="flex-end">
          <Button variant="outlined" onPress={() => setStep('basic')} disabled={isLoading}>
            Back
          </Button>

          {onPreview ? <Button
              variant="outlined"
              icon={Eye}
              onPress={() => onPreview({ ...watch(), type: currentSelectedType })}
              disabled={isLoading}
            >
              Preview
            </Button> : null}

          <Button onPress={() => handleSaveAndContinue('review')} disabled={isLoading} theme="blue">
            Continue to Review
          </Button>
        </XStack>
      </YStack>
    )
  }

  // Step 4: Review & Save
  return (
    <YStack space="$4">
      <StepBreadcrumb
        currentStep="review"
        currentSelectedType={currentSelectedType}
        skipTypeSelection={skipTypeSelection}
        autoSaveStatus={autoSaveStatus}
        lastSaved={lastSaved}
        autoSaveRetryCount={autoSaveRetryCount}
        maxAutoSaveRetries={maxAutoSaveRetries}
        isDirty={isDirty}
      />
      <EventActivationSection
        formData={currentFormData}
        currentSelectedType={currentSelectedType}
        publishDate={eventPublishDate}
        onActivate={() => setEventPublishDate(new Date())}
        onDeactivate={() => setEventPublishDate(null)}
        onSchedule={(date) => setEventPublishDate(date)}
      />
      <StepSummary
        step="review"
        currentSelectedType={currentSelectedType}
        formData={currentFormData}
        activeComponents={activeComponents}
      />

      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <YStack space="$4">
          <Text fontSize="$6" fontWeight="bold">
            Review Event Details
          </Text>
          <Text color="$gray11" fontSize="$4">
            Please review your event details below. Once you save, the event will be created.
          </Text>

          <YStack space="$3">
            <Card padding="$3" backgroundColor="$gray1">
              <YStack space="$2">
                <Text fontSize="$5" fontWeight="600">
                  Event Overview
                </Text>
                <XStack space="$2" alignItems="center">
                  <Text fontWeight="600">Type:</Text>
                  <Text>{currentSelectedType?.replace('-', ' ')}</Text>
                </XStack>
                <XStack space="$2" alignItems="center">
                  <Text fontWeight="600">Title:</Text>
                  <Text>{currentFormData.title || 'Untitled Event'}</Text>
                </XStack>
                {currentFormData.description ? <XStack space="$2" alignItems="flex-start">
                    <Text fontWeight="600">Description:</Text>
                    <Text flex={1}>{currentFormData.description}</Text>
                  </XStack> : null}

                {/* Type-specific details */}
                {currentSelectedType === 'baptism' && currentFormData.candidate ? <>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Candidate:</Text>
                      <Text>
                        {(() => {
                          const firstName = currentFormData.candidate.firstName || ''
                          const lastName = currentFormData.candidate.lastName || ''
                          const fullName = `${firstName} ${lastName}`.trim()
                          return fullName || 'TBA'
                        })()}
                      </Text>
                    </XStack>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Date:</Text>
                      <Text>
                        {currentFormData.baptismDate
                          ? new Date(currentFormData.baptismDate).toLocaleString('en-CA', {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Not set'}
                      </Text>
                    </XStack>
                  </> : null}

                {currentSelectedType === 'study-weekend' ? <>
                    {currentFormData.theme ? (
                      <XStack space="$2" alignItems="center">
                        <Text fontWeight="600">Theme:</Text>
                        <Text>{currentFormData.theme}</Text>
                      </XStack>
                    ) : null}
                    {currentFormData.dateRange ? (
                      <XStack space="$2" alignItems="center">
                        <Text fontWeight="600">Dates:</Text>
                        <Text>{`${new Date(currentFormData.dateRange.start).toLocaleDateString()} - ${new Date(currentFormData.dateRange.end).toLocaleDateString()}`}</Text>
                      </XStack>
                    ) : null}
                  </> : null}

                {currentSelectedType === 'wedding' && currentFormData.couple ? <>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Couple:</Text>
                      <Text>
                        {(() => {
                          const brideFirst = currentFormData.couple.bride?.firstName || ''
                          const brideLast = currentFormData.couple.bride?.lastName || ''
                          const groomFirst = currentFormData.couple.groom?.firstName || ''
                          const groomLast = currentFormData.couple.groom?.lastName || ''

                          const brideName = `${brideFirst} ${brideLast}`.trim()
                          const groomName = `${groomFirst} ${groomLast}`.trim()

                          if (!brideName && !groomName) return 'Wedding Couple'
                          if (!brideName) return groomName
                          if (!groomName) return brideName
                          return `${brideName} & ${groomName}`
                        })()}
                      </Text>
                    </XStack>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Date:</Text>
                      <Text>
                        {currentFormData.ceremonyDate
                          ? new Date(currentFormData.ceremonyDate).toLocaleDateString()
                          : 'Not set'}
                      </Text>
                    </XStack>
                  </> : null}

                {currentSelectedType === 'engagement' ? <>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Engaged:</Text>
                      <Text>
                        {currentFormData.engagementProposed || '?'} & {currentFormData.engagementTo || '?'}
                      </Text>
                    </XStack>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Date:</Text>
                      <Text>
                        {currentFormData.engagementDate
                          ? new Date(currentFormData.engagementDate).toLocaleDateString()
                          : 'Not set'}
                      </Text>
                    </XStack>
                    {currentFormData.engagementAnnouncement ? (
                      <XStack space="$2" alignItems="flex-start">
                        <Text fontWeight="600">Announcement:</Text>
                        <Text flex={1}>{currentFormData.engagementAnnouncement}</Text>
                      </XStack>
                    ) : null}
                  </> : null}
              </YStack>
            </Card>

            {/* Show actual data */}
            {currentFormData.hostingEcclesia ? (
              <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <XStack space="$2" alignItems="center">
                    <Text fontWeight="600">Hosted by:</Text>
                    <Text>{typeof currentFormData.hostingEcclesia === 'string' ? currentFormData.hostingEcclesia : currentFormData.hostingEcclesia.name}</Text>
                  </XStack>
                </YStack>
              </Card>
            ) : null}

            {currentFormData.location?.name ? <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Location
                  </Text>
                  <Text>{currentFormData.location.name}</Text>
                  {currentFormData.location.address ? <Text fontSize="$3" color="$gray11">
                      {currentFormData.location.address}
                      {currentFormData.location.city ? `, ${currentFormData.location.city}` : ''}
                      {currentFormData.location.province
                        ? `, ${currentFormData.location.province}`
                        : ''}
                    </Text> : null}
                </YStack>
              </Card> : null}

            {(currentFormData.speakers?.length ?? 0) > 0 ? <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Speakers
                  </Text>
                  {currentFormData.speakers?.map((speaker: any, index: number) => (
                    <XStack key={index} space="$1" alignItems="center">
                      <Text>
                        {speaker.firstName} {speaker.lastName}
                      </Text>
                      {speaker.ecclesia ? (
                        <Text color="$gray11"> ({speaker.ecclesia.name})</Text>
                      ) : null}
                    </XStack>
                  ))}
                </YStack>
              </Card> : null}


            {currentFormData.candidate?.testimony ? <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Candidate Testimony
                  </Text>
                  <Text fontSize="$3">{currentFormData.candidate.testimony}</Text>
                </YStack>
              </Card> : null}

            {currentFormData.candidate?.baptismStatement ? <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Baptism Statement
                  </Text>
                  <Text fontSize="$3">{currentFormData.candidate.baptismStatement}</Text>
                </YStack>
              </Card> : null}
          </YStack>
        </YStack>
      </Card>

      <XStack space="$3" justifyContent="flex-end">
        <Button variant="outlined" onPress={() => setStep('components')} disabled={isLoading}>
          Back to Optional Fields
        </Button>

        {onPreview ? <Button
            variant="outlined"
            icon={Eye}
            onPress={() => onPreview({ ...currentFormData, type: currentSelectedType })}
            disabled={isLoading}
          >
            Preview
          </Button> : null}

        <Button icon={Save} onPress={handleSubmit(onSubmit)} disabled={isLoading} theme="green">
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </XStack>
    </YStack>
  )
}
