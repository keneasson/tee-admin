import { Event, EventType, EventStatus } from '@my/app/types/events'
import { EventValidator } from '@my/app/utils/event-validation'
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
} from '@tamagui/lucide-icons'
import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { Button, Card, Circle, Separator, Text, XStack, YStack, Dialog, AlertDialog } from 'tamagui'
import { EcclesiaSearchInput } from '../form/ecclesia-search-input'
import { EventDatePicker } from '../form/event-date-picker'
import { EventDateRangePicker } from '../form/event-date-range-picker'
import { EventFormInput } from '../form/event-form-input'
import { OptimizedTextarea } from '../form/optimized-textarea'
import {
  LocationSection,
  MultipleLocationsSection,
  RegistrationSection,
  ScheduleSection,
  SpeakerSection,
} from './event-form-sections'
import { DocumentsSection } from './form-sections/documents-section'
import { EventTypeSelector } from './event-type-selector'
import { EventStatusIndicator, EventValidationSummary } from './event-status-indicator'

interface ProgressiveEventFormProps {
  initialData?: Partial<Event>
  onSave: (data: any) => Promise<void>
  onAutoSave?: (data: any) => Promise<void> // Auto-save callback for drafts
  onPreview?: (data: any) => void
  isLoading?: boolean
  skipTypeSelection?: boolean // Allow skipping type selection for edit mode
  selectedType?: EventType // Pre-select event type
  compact?: boolean // Streamlined UI for newsletter context
  onCancel?: () => void // Cancel callback
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
            variant="ghost"
            onPress={() => setIsExpanded(!isExpanded)}
            icon={isExpanded ? <ChevronUp size="$1" /> : <ChevronDown size="$1" />}
            padding="$2"
            borderRadius="$2"
          />
          {Icon && <Icon size="$1" color={iconColor} />}
          <Text fontSize="$4" fontWeight="600" flex={1}>
            {title}
          </Text>
        </XStack>

        {/* Right side: Add button + Remove button */}
        <XStack gap="$2" alignItems="center">
          {onAdd && isExpanded && (
            <Button size="$3" theme="blue" icon={Plus} onPress={onAdd}>
              {addButtonText}
            </Button>
          )}
          <Button
            size="$3"
            theme="red"
            onPress={handleRemoveClick}
            opacity={isExpanded ? 1 : 0.7}
          >
            Remove
          </Button>
        </XStack>
      </XStack>

      {/* Content area */}
      {isExpanded && <YStack padding="$3" backgroundColor="$borderContrast">{children}</YStack>}
      
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
            animation={[
              'quick',
              {
                opacity: {
                  overshootClamping: true,
                },
              },
            ]}
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
                Are you sure you want to remove this entire {title.toLowerCase()} section? This action cannot be undone.
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

// Event status summary component
function EventStatusSection({
  formData,
  currentSelectedType,
}: {
  formData: any
  currentSelectedType?: EventType
}) {
  if (!currentSelectedType) return null

  const eventData = {
    ...formData,
    type: currentSelectedType,
  }

  return <EventValidationSummary event={eventData} showWarnings />
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
            {index < steps.length - 1 && (
              <XStack
                width="$3"
                height={1}
                backgroundColor={index < currentIndex ? '$green10' : '$gray8'}
                marginHorizontal="$2"
              />
            )}
          </XStack>
        ))}
      </XStack>

      {currentSelectedType && (
        <Text fontSize="$2" color="$gray11" textAlign="center" marginTop="$2">
          {`Creating ${currentSelectedType.replace('-', ' ')} event`}
        </Text>
      )}

      {/* Unsaved changes and save status indicator */}
      <XStack justifyContent="center" alignItems="center" space="$2" marginTop="$2" minHeight="$2">
        {/* Show unsaved changes indicator when dirty and not saving */}
        {isDirty && autoSaveStatus === 'idle' && (
          <>
            <Circle size="$0.5" backgroundColor="$orange10" />
            <Text fontSize="$2" color="$orange11" fontWeight="500">
              Unsaved changes
            </Text>
          </>
        )}
        {autoSaveStatus === 'saving' && (
          <>
            <Circle size="$0.5" backgroundColor="$blue10" animation="spin" />
            <Text fontSize="$2" color="$blue11">
              Saving...
            </Text>
          </>
        )}
        {autoSaveStatus === 'saved' && (
          <>
            <CheckCircle size="$1" color="$green10" />
            <Text fontSize="$2" color="$green11">
              Saved {lastSaved ? `at ${lastSaved.toLocaleTimeString()}` : ''}
            </Text>
          </>
        )}
        {autoSaveStatus === 'error' && (
          <>
            <Circle size="$0.5" backgroundColor="$red10" />
            <Text fontSize="$2" color="$red11">
              {autoSaveRetryCount && maxAutoSaveRetries && autoSaveRetryCount >= maxAutoSaveRetries
                ? 'Auto-save failed (max retries)'
                : `Auto-save failed${autoSaveRetryCount && maxAutoSaveRetries ? ` (retry ${autoSaveRetryCount}/${maxAutoSaveRetries})` : ''}`}
            </Text>
          </>
        )}
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
                >{`${formData.couple.bride?.firstName || ''} & ${formData.couple.groom?.firstName || ''}`}</Text>
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
  compact = false,
  onCancel,
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
      if (initialData.location) active.push('location')
      if (initialData.speakers && initialData.speakers.length > 0) active.push('speakers')
      if (initialData.schedule && initialData.schedule.length > 0) active.push('schedule')
      if (initialData.registration) active.push('registration')
    }

    if (currentSelectedType === 'baptism') {
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
      if (initialData.locations?.service) active.push('service-location')
      if (initialData.locations?.burial) active.push('burial-location')
      if (initialData.eulogies && initialData.eulogies.length > 0) active.push('eulogies')
    }

    return active
  }

  const [activeComponents, setActiveComponents] = useState<string[]>(getInitialActiveComponents())
  // Start at 'basic' step if we're skipping type selection (edit mode) and have a type
  const [step, setStep] = useState<'type' | 'basic' | 'components' | 'review'>(
    skipTypeSelection && initialData?.type ? 'basic' : 'type'
  )

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
      publishDate: initialData?.publishDate,
      // Type-specific defaults
      ...(currentSelectedType === 'study-weekend' && {
        dateRange: initialData?.dateRange || {
          start: new Date(),
          end: new Date(new Date().getTime() + 2 * 60 * 60 * 1000), // 2 hours later
          hidesTimes: false,
        },
        hostingEcclesia: initialData?.hostingEcclesia || 'Toronto East Christadelphian Ecclesia',
        location: initialData?.location || {
          name: '',
          address: '',
          city: '',
          province: '',
        },
        theme: initialData?.theme || '',
        speakers: initialData?.speakers || [],
        schedule: initialData?.schedule || [],
        registration: initialData?.registration || null,
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'funeral' && {
        serviceDate: initialData?.serviceDate || new Date(),
        viewingDate: initialData?.viewingDate,
        deceased: initialData?.deceased || {
          firstName: '',
          lastName: '',
        },
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
        hostingEcclesia: initialData?.hostingEcclesia || 'Toronto East Christadelphian Ecclesia',
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
      ...(currentSelectedType === 'baptism' && {
        baptismDate: initialData?.baptismDate || new Date(),
        candidate: initialData?.candidate || {
          firstName: '',
          lastName: '',
          testimony: '',
          baptismStatement: '',
        },
        hostingEcclesia: initialData?.hostingEcclesia || 'Toronto East Christadelphian Ecclesia',
        location: initialData?.location || {
          name: '',
          address: '',
          city: '',
          province: '',
        },
        zoomLink: initialData?.zoomLink || '',
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'general' && {
        startDate: initialData?.startDate,
        endDate: initialData?.endDate,
        location: initialData?.location,
        speakers: initialData?.speakers || [],
        schedule: initialData?.schedule || [],
        registration: initialData?.registration,
        documents: initialData?.documents || [],
      }),
      ...(currentSelectedType === 'recurring' && {
        recurringConfig: initialData?.recurringConfig || {
          daysOfWeek: [],
          startTime: '19:00',
          endTime: '20:30',
          frequency: 'weekly',
          startDate: new Date(),
          endDate: undefined,
          exceptions: [],
          location: '',
          description: '',
          contactPerson: '',
        },
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
          label: 'Event Location',
          icon: MapPin,
          description: 'Venue information and directions (e.g., camp, hall, hotel)',
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
          description: 'Viewing, service, and burial locations',
          required: true,
          component: (
            <YStack space="$4">
              <LocationSection
                control={control}
                setValue={setValue}
                namePrefix="locations.service"
                title="Service Location"
                required
              />
              <LocationSection
                control={control}
                setValue={setValue}
                namePrefix="locations.viewing"
                title="Viewing Location"
              />
              <LocationSection
                control={control}
                setValue={setValue}
                namePrefix="locations.burial"
                title="Burial Location"
              />
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
                name="reception.date"
                label="Reception Date"
                includeTime
                onDateChange={handleFieldChange}
              />
              <EventFormInput
                control={control}
                name="reception.details"
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
          description: 'Specific location where baptism will take place (e.g., Lakefield College)',
          required: true,
          component: (
            <LocationSection
              control={control}
              setValue={setValue}
              namePrefix="location"
              title="Event Location"
              required
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
            />
          ),
        },
        ...baseComponents,
      ]
    }

    return baseComponents
  }

  const availableComponents = getAvailableComponents()
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
    setActiveComponents(activeComponents.filter((id) => id !== componentId))
  }

  const onSubmit = async (data: any) => {
    // Check if event passes validation
    const validation = EventValidator.canPublish({ ...data, type: currentSelectedType })

    // Set status based on validation
    const status: EventStatus = validation.isValid ? 'ready' : 'draft'

    const eventData = {
      ...data,
      type: currentSelectedType,
      id: persistentEventId, // Use persistent ID for final save too
      status,
      // Note: No 'published' field needed - it's computed from status + publishDate
    }
    await onSave(eventData)
  }

  const currentFormData = watch()

  // Manual save draft function
  const handleManualSave = async () => {
    if (!onAutoSave || !currentSelectedType) return

    try {
      setAutoSaveStatus('saving')
      const eventData = {
        ...currentFormData,
        type: currentSelectedType,
        id: persistentEventId,
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
      let timeoutId: NodeJS.Timeout
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
              ...data,
              type: currentSelectedType,
              id: persistentEventId, // Use persistent ID for all saves
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
        <EventStatusSection formData={currentFormData} currentSelectedType={currentSelectedType} />
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

            {currentSelectedType === 'study-weekend' && (
              <>
                <EventFormInput
                  control={control}
                  name="theme"
                  label="Theme"
                  placeholder="Event theme or topic"
                />

                <EventDateRangePicker
                  control={control}
                  name="dateRange"
                  label="Event Dates"
                  required
                  allowSingleDay={false}
                  allowHideTimes={true}
                  onDateChange={handleFieldChange}
                />
              </>
            )}

            {currentSelectedType === 'funeral' && (
              <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Deceased Information
                  </Text>
                  <XStack space="$3">
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="deceased.firstName"
                        label="First Name"
                        required
                      />
                    </YStack>
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name="deceased.lastName"
                        label="Last Name"
                        required
                      />
                    </YStack>
                  </XStack>
                </YStack>

                <XStack space="$3">
                  <YStack flex={1}>
                    <EventDatePicker
                      control={control}
                      name="serviceDate"
                      label="Service Date"
                      includeTime
                      required
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                  <YStack flex={1}>
                    <EventDatePicker
                      control={control}
                      name="viewingDate"
                      label="Viewing Date"
                      includeTime
                      onDateChange={handleFieldChange}
                    />
                  </YStack>
                </XStack>
              </>
            )}

            {currentSelectedType === 'wedding' && (
              <>
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

                <EventDatePicker
                  control={control}
                  name="ceremonyDate"
                  label="Ceremony Date"
                  includeTime
                  allowHideTimes
                  required
                  onDateChange={handleFieldChange}
                />
              </>
            )}

            {currentSelectedType === 'baptism' && (
              <>
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

                <EventDatePicker
                  control={control}
                  name="baptismDate"
                  label="Baptism Date"
                  includeTime
                  allowHideTimes
                  required
                  onDateChange={handleFieldChange}
                />

                <EcclesiaSearchInput
                  control={control}
                  name="hostingEcclesia"
                  label="Hosting Ecclesia"
                  placeholder="Search for hosting ecclesia..."
                />

                <EventFormInput
                  control={control}
                  name="zoomLink"
                  label="Zoom Link (Optional)"
                  placeholder="https://zoom.us/j/..."
                  type="url"
                />
              </>
            )}

            {currentSelectedType === 'general' && (
              <XStack space="$3">
                <YStack flex={1}>
                  <EventDatePicker
                    control={control}
                    name="startDate"
                    label="Start Date"
                    includeTime
                    onDateChange={handleFieldChange}
                  />
                </YStack>
                <YStack flex={1}>
                  <EventDatePicker
                    control={control}
                    name="endDate"
                    label="End Date"
                    includeTime
                    onDateChange={handleFieldChange}
                  />
                </YStack>
              </XStack>
            )}

            {currentSelectedType === 'recurring' && (
              <>
                <YStack space="$3">
                  <Text fontSize="$5" fontWeight="600">
                    Recurring Schedule
                  </Text>
                  <Text fontSize="$3" color="$gray11">
                    Configure when and how often this event occurs.
                  </Text>
                </YStack>

                <XStack space="$3">
                  <YStack flex={1}>
                    <EventFormInput
                      control={control}
                      name="recurringConfig.startTime"
                      label="Start Time"
                      placeholder="19:00"
                      required
                    />
                  </YStack>
                  <YStack flex={1}>
                    <EventFormInput
                      control={control}
                      name="recurringConfig.endTime"
                      label="End Time"
                      placeholder="20:30"
                      required
                    />
                  </YStack>
                </XStack>

                <EventDatePicker
                  control={control}
                  name="recurringConfig.startDate"
                  label="Start Date"
                  placeholder="When does this recurring event begin?"
                  required
                  onDateChange={handleFieldChange}
                />

                <EventFormInput
                  control={control}
                  name="recurringConfig.contactPerson"
                  label="Contact Person"
                  placeholder="e.g., Brother Smith"
                />
              </>
            )}

            <EventDatePicker
              control={control}
              name="publishDate"
              label="Publish Date"
              includeTime
              onDateChange={handleFieldChange}
            />
          </YStack>
        </Card>

        <XStack space="$3" justifyContent="space-between">
          <Button
            variant="outlined"
            onPress={handleManualSave}
            disabled={isLoading || autoSaveStatus === 'saving'}
            theme="green"
          >
            {autoSaveStatus === 'saving' ? 'Saving...' : 'Save Draft'}
          </Button>

          <XStack space="$3">
            {!skipTypeSelection && (
              <Button variant="outlined" onPress={() => setStep('type')} disabled={isLoading}>
                Back
              </Button>
            )}
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
        <EventStatusSection formData={currentFormData} currentSelectedType={currentSelectedType} />
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
                      const locationsField = getValues('locations') || []
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

          {onPreview && (
            <Button
              variant="outlined"
              icon={Eye}
              onPress={() => onPreview(watch())}
              disabled={isLoading}
            >
              Preview
            </Button>
          )}

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
      <EventStatusSection formData={currentFormData} currentSelectedType={currentSelectedType} />
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
                {currentFormData.description && (
                  <XStack space="$2" alignItems="flex-start">
                    <Text fontWeight="600">Description:</Text>
                    <Text flex={1}>{currentFormData.description}</Text>
                  </XStack>
                )}

                {/* Type-specific details */}
                {currentSelectedType === 'baptism' && currentFormData.candidate && (
                  <>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Candidate:</Text>
                      <Text>{`${currentFormData.candidate.firstName} ${currentFormData.candidate.lastName}`}</Text>
                    </XStack>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Date:</Text>
                      <Text>
                        {currentFormData.baptismDate
                          ? new Date(currentFormData.baptismDate).toLocaleDateString()
                          : 'Not set'}
                      </Text>
                    </XStack>
                  </>
                )}

                {currentSelectedType === 'study-weekend' && (
                  <>
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
                  </>
                )}

                {currentSelectedType === 'wedding' && currentFormData.couple && (
                  <>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Couple:</Text>
                      <Text>{`${currentFormData.couple.bride?.firstName || ''} ${currentFormData.couple.bride?.lastName || ''} & ${currentFormData.couple.groom?.firstName || ''} ${currentFormData.couple.groom?.lastName || ''}`}</Text>
                    </XStack>
                    <XStack space="$2" alignItems="center">
                      <Text fontWeight="600">Date:</Text>
                      <Text>
                        {currentFormData.ceremonyDate
                          ? new Date(currentFormData.ceremonyDate).toLocaleDateString()
                          : 'Not set'}
                      </Text>
                    </XStack>
                  </>
                )}
              </YStack>
            </Card>

            {/* Show actual data */}
            {currentFormData.hostingEcclesia ? (
              <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <XStack space="$2" alignItems="center">
                    <Text fontWeight="600">Hosted by:</Text>
                    <Text>{currentFormData.hostingEcclesia.name}</Text>
                  </XStack>
                </YStack>
              </Card>
            ) : null}

            {currentFormData.location?.name && (
              <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Location
                  </Text>
                  <Text>{currentFormData.location.name}</Text>
                  {currentFormData.location.address && (
                    <Text fontSize="$3" color="$gray11">
                      {currentFormData.location.address}
                      {currentFormData.location.city ? `, ${currentFormData.location.city}` : ''}
                      {currentFormData.location.province
                        ? `, ${currentFormData.location.province}`
                        : ''}
                    </Text>
                  )}
                </YStack>
              </Card>
            )}

            {currentFormData.speakers?.length > 0 && (
              <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Speakers
                  </Text>
                  {currentFormData.speakers.map((speaker: any, index: number) => (
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
              </Card>
            )}

            {currentFormData.zoomLink && (
              <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Zoom Link
                  </Text>
                  <Text fontSize="$3" color="$blue11">
                    {currentFormData.zoomLink}
                  </Text>
                </YStack>
              </Card>
            )}

            {currentFormData.candidate?.testimony && (
              <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Candidate Testimony
                  </Text>
                  <Text fontSize="$3">{currentFormData.candidate.testimony}</Text>
                </YStack>
              </Card>
            )}

            {currentFormData.candidate?.baptismStatement && (
              <Card padding="$3" backgroundColor="$gray1">
                <YStack space="$2">
                  <Text fontSize="$5" fontWeight="600">
                    Baptism Statement
                  </Text>
                  <Text fontSize="$3">{currentFormData.candidate.baptismStatement}</Text>
                </YStack>
              </Card>
            )}
          </YStack>
        </YStack>
      </Card>

      <XStack space="$3" justifyContent="flex-end">
        <Button variant="outlined" onPress={() => setStep('components')} disabled={isLoading}>
          Back to Optional Fields
        </Button>

        {onPreview && (
          <Button
            variant="outlined"
            icon={Eye}
            onPress={() => onPreview(currentFormData)}
            disabled={isLoading}
          >
            Preview
          </Button>
        )}

        <Button icon={Save} onPress={handleSubmit(onSubmit)} disabled={isLoading} theme="blue">
          {isLoading ? 'Saving...' : 'Save Event'}
        </Button>
      </XStack>
    </YStack>
  )
}
