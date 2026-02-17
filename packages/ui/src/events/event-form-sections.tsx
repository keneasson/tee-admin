import { Control, useFieldArray, useController, FieldValues, FieldPath, useWatch, useFormContext, PathValue, Path } from 'react-hook-form'
import { formatEcclesiaToLocation, createLocationFieldUpdates } from './location-utils'
import { LocationFieldsContainer } from './location-components'
import { YStack, XStack, Card, Text, Button, Separator, Checkbox } from 'tamagui'
import { Plus, MapPin, User, Calendar, FileText, Trash2, Check, Video, Globe } from '@tamagui/lucide-icons'
import { EventFormInput } from '../form/event-form-input'
import { EventDatePicker } from '../form/event-date-picker'
import { EventFormSelect } from '../form/event-form-select'
import { EcclesiaSearchInput } from '../form/ecclesia-search-input'
import { AddressAutocomplete } from '../form/address-autocomplete'
import { CountrySelect, ProvinceSelect } from '../form/location-select'
import type { ParsedAddress } from '@my/app/types/address-autocomplete'
import { buildMapsUrl } from '@my/app/types/address-autocomplete'
import { OptimizedTextarea } from '../form/optimized-textarea'
import { CheckboxWithCheck } from '../form/checkbox-with-check'
import { useAdminSpacing } from '../hooks/use-admin-spacing'

// Sticky Header Component for Add buttons
interface StickyHeaderProps {
  title: string
  icon: React.ComponentType<any>
  iconColor: string
  buttonText: string
  onAdd: () => void
  buttonSize?: string
}

function StickyHeader({ title, icon: Icon, iconColor, buttonText, onAdd, buttonSize = "$3" }: StickyHeaderProps) {
  return (
    <XStack 
      style={{ position: 'sticky', top: 0, zIndex: 15 }}
      backgroundColor="$background"
      padding="$3"
      borderBottomWidth={1}
      borderBottomColor="$borderColor"
      gap="$2"
      alignItems="center" 
      justifyContent="space-between"
      shadowColor="$shadowColor"
      shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={0.1}
      shadowRadius={4}
      elevation={2}
      marginBottom="$1"
    >
      <XStack gap="$2" alignItems="center">
        <Icon size="$1" color={iconColor} />
        <Text fontSize="$4" fontWeight="600">{title}</Text>
      </XStack>
      
      <Button
        size={buttonSize as any}
        theme="blue"
        icon={Plus}
        onPress={onAdd}
      >
        {buttonText}
      </Button>
    </XStack>
  )
}

// Location Details Section
interface LocationSectionProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  title?: string
  required?: boolean
  showAtTheHallOption?: boolean
  hostingEcclesiaFieldName?: string
  setValue?: any // Pass setValue from useForm
}

// Multiple Locations Section (for events with multiple venues)
interface MultipleLocationsSectionProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  title?: string
  allowCustomLocationTypes?: boolean
}

export function LocationSection<T extends FieldValues>({
  control,
  namePrefix,
  title = "Location Details",
  required = false,
  showAtTheHallOption = false,
  hostingEcclesiaFieldName = "hostingEcclesia",
  setValue: setValueProp
}: LocationSectionProps<T>) {
  const { card, text, button } = useAdminSpacing()

  // Try to get setValue from prop first, then from context as fallback
  const formContext = useFormContext()
  const setValue = setValueProp || formContext?.setValue

  const hostingEcclesia = useWatch({
    control,
    name: hostingEcclesiaFieldName as FieldPath<T>
  })

  // Watch the location mode to show/hide fields conditionally
  const locationMode = (useWatch({
    control,
    name: `${namePrefix}.mode` as FieldPath<T>
  }) as 'in-person' | 'online' | 'hybrid' | undefined) || 'in-person' // Default to in-person if not set

  // Watch the "At the Hall" checkbox to show read-only vs editable fields
  const atTheHall = useWatch({
    control,
    name: `${namePrefix}._atTheHall` as FieldPath<T>
  }) as boolean | undefined

  // Watch address and name for autocomplete integration
  const addressValue = useWatch({
    control,
    name: `${namePrefix}.address` as FieldPath<T>
  }) as string | undefined

  const locationName = useWatch({
    control,
    name: `${namePrefix}.name` as FieldPath<T>
  }) as string | undefined

  const locationCountry = useWatch({
    control,
    name: `${namePrefix}.country` as FieldPath<T>
  }) as string | undefined

  // Use pure functions for data transformation
  const handleAtTheHallChange = (checked: boolean) => {
    // Only proceed if setValue is available
    if (!setValue) {
      console.warn('LocationSection: setValue not available - component must be used within a FormProvider')
      return
    }

    if (checked && hostingEcclesia) {
      // Transform data using pure function
      const locationData = formatEcclesiaToLocation(hostingEcclesia)
      // Handle parkingInfo vs parking field name
      locationData.parking = hostingEcclesia.hall?.parkingInfo || hostingEcclesia.parkingInfo || ''

      // Get field updates and apply them
      const updates = createLocationFieldUpdates(locationData, namePrefix)
      // Rename parking to parkingInfo for this form
      updates.forEach(({ field, value }) => {
        const fieldName = field.includes('.parking') ? field.replace('.parking', '.parkingInfo') : field
        setValue(fieldName as any, value)
      })
    } else if (!checked) {
      // Clear all fields using empty location
      const emptyLocation = formatEcclesiaToLocation(null)
      const updates = createLocationFieldUpdates(emptyLocation, namePrefix)
      updates.forEach(({ field, value }) => {
        const fieldName = field.includes('.parking') ? field.replace('.parking', '.parkingInfo') : field
        setValue(fieldName as any, value || '')
      })
    }
  }

  const showPhysicalLocation = locationMode === 'in-person' || locationMode === 'hybrid'
  const showOnlineFields = locationMode === 'online' || locationMode === 'hybrid'

  return (
    <Card padding={card.padding} borderWidth={1} borderColor="$borderColor">
      <YStack space={card.space}>
        <XStack space={card.space} alignItems="center">
          <MapPin size={button.iconSize} color="$blue10" />
          <Text fontSize="$4" fontWeight="600">{title}</Text>
        </XStack>

        <YStack space={card.space}>
          {/* Location Mode Selector */}
          <EventFormSelect
            control={control}
            name={`${namePrefix}.mode` as any}
            label="Location Type"
            placeholder="Select location type"
            required
            options={[
              { value: 'in-person', label: 'In-Person Only' },
              { value: 'online', label: 'Online Only' },
              { value: 'hybrid', label: 'Hybrid (In-Person & Online)' }
            ]}
          />

          {/* Physical Location Fields - shown for in-person and hybrid */}
          {showPhysicalLocation ? <>
              <Separator marginVertical="$2" />
              <XStack gap="$2" alignItems="center">
                <MapPin size="$0.75" color="$green10" />
                <Text fontSize="$3" fontWeight="600" color="$green11">
                  Physical Location
                </Text>
              </XStack>

              {/* At the Hall convenience option */}
              {showAtTheHallOption && hostingEcclesia ? <CheckboxWithCheck
                  control={control}
                  name={`${namePrefix}._atTheHall` as any}
                  label={`At the Hall - Use ${hostingEcclesia.name}'s hall location`}
                  onCheckChange={handleAtTheHallChange}
                /> : null}

              {/* Show read-only location when "At the Hall" is checked */}
              {atTheHall && hostingEcclesia ? (
                <Card padding="$3" backgroundColor="$gray2" borderRadius="$3">
                  <YStack gap="$2">
                    <Text fontSize="$4" fontWeight="600" color="$gray12">
                      {hostingEcclesia.hall?.name || hostingEcclesia.name}
                    </Text>
                    {(hostingEcclesia.hall?.address || hostingEcclesia.address) ? (
                      <Text fontSize="$3" color="$gray11">
                        {hostingEcclesia.hall?.address || hostingEcclesia.address}
                      </Text>
                    ) : null}
                    <Text fontSize="$3" color="$gray11">
                      {[
                        hostingEcclesia.hall?.city || hostingEcclesia.city,
                        hostingEcclesia.hall?.province || hostingEcclesia.province,
                        hostingEcclesia.hall?.postalCode || hostingEcclesia.postalCode
                      ].filter(Boolean).join(', ')}
                    </Text>
                    {(hostingEcclesia.hall?.country || hostingEcclesia.country) ? (
                      <Text fontSize="$3" color="$gray11">
                        {hostingEcclesia.hall?.country || hostingEcclesia.country}
                      </Text>
                    ) : null}
                    {(hostingEcclesia.hall?.parkingInfo || hostingEcclesia.parkingInfo) ? (
                      <YStack marginTop="$2">
                        <Text fontSize="$2" fontWeight="600" color="$gray10">Parking</Text>
                        <Text fontSize="$3" color="$gray11">
                          {hostingEcclesia.hall?.parkingInfo || hostingEcclesia.parkingInfo}
                        </Text>
                      </YStack>
                    ) : null}
                  </YStack>
                </Card>
              ) : (
                /* Show editable fields when "At the Hall" is NOT checked */
                <>
                  <EventFormInput
                    control={control}
                    name={`${namePrefix}.name` as any}
                    label="Venue Name"
                    placeholder=""
                    required={required}
                  />

                  <AddressAutocomplete
                    value={addressValue || ''}
                    onChangeText={(text) => {
                      if (setValue) setValue(`${namePrefix}.address` as any, text)
                    }}
                    onAddressSelect={(parsed: ParsedAddress) => {
                      if (!setValue) return
                      setValue(`${namePrefix}.address` as any, parsed.formattedAddress || parsed.streetAddress)
                      setValue(`${namePrefix}.city` as any, parsed.city)
                      setValue(`${namePrefix}.province` as any, parsed.province)
                      setValue(`${namePrefix}.postalCode` as any, parsed.postalCode)
                      setValue(`${namePrefix}.country` as any, parsed.country)
                      setValue(`${namePrefix}.mapsUrl` as any, buildMapsUrl(parsed))
                      if (parsed.lat) setValue(`${namePrefix}.lat` as any, parsed.lat)
                      if (parsed.lng) setValue(`${namePrefix}.lng` as any, parsed.lng)
                      if (parsed.placeId) setValue(`${namePrefix}.placeId` as any, parsed.placeId)
                      if (parsed.name) setValue(`${namePrefix}.placeName` as any, parsed.name)
                    }}
                    label="Address"
                    placeholder="123 Main Street"
                    country={locationCountry}
                    disabled={!setValue}
                  />

                  <XStack space="$2">
                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name={`${namePrefix}.city` as any}
                        label="City"
                        placeholder="Toronto"
                        required={required}
                      />
                    </YStack>

                    <YStack flex={1}>
                      <ProvinceSelect
                        control={control}
                        name={`${namePrefix}.province` as any}
                        countryFieldName={`${namePrefix}.country` as any}
                        label="Province"
                        placeholder="Select Province"
                        required={required}
                      />
                    </YStack>

                    <YStack flex={1}>
                      <EventFormInput
                        control={control}
                        name={`${namePrefix}.postalCode` as any}
                        label="Postal Code"
                        placeholder="M1A 1A1"
                      />
                    </YStack>
                  </XStack>

                  <XStack space="$2">
                    <YStack flex={1}>
                      <CountrySelect
                        control={control}
                        name={`${namePrefix}.country` as any}
                        label="Country"
                        placeholder="Select Country"
                      />
                    </YStack>
                  </XStack>

                  <OptimizedTextarea
                    control={control}
                    name={`${namePrefix}.directions` as any}
                    label="Directions"
                    placeholder="Additional directions or landmarks"
                    rows={3}
                    maxLength={500}
                  />

                  <OptimizedTextarea
                    control={control}
                    name={`${namePrefix}.parkingInfo` as any}
                    label="Parking Information"
                    placeholder="Parking details and restrictions"
                    rows={3}
                    maxLength={300}
                  />
                </>
              )}
            </> : null}

          {/* Online Meeting Fields - shown for online and hybrid */}
          {showOnlineFields ? <>
              <Separator marginVertical="$2" />
              <XStack gap="$2" alignItems="center">
                <Video size="$0.75" color="$purple10" />
                <Text fontSize="$3" fontWeight="600" color="$purple11">
                  Online Meeting Details
                </Text>
              </XStack>

              <EventFormInput
                control={control}
                name={`${namePrefix}.onlineMeeting.link` as any}
                label="Meeting Link"
                placeholder="https://zoom.us/j/123456789 or https://meet.google.com/..."
                type="url"
                required={required}
              />

              <EventFormSelect
                control={control}
                name={`${namePrefix}.onlineMeeting.platform` as any}
                label="Platform (Optional)"
                placeholder="Select platform"
                options={[
                  { value: 'zoom', label: 'Zoom' },
                  { value: 'google-meet', label: 'Google Meet' },
                  { value: 'teams', label: 'Microsoft Teams' },
                  { value: 'webex', label: 'Webex' },
                  { value: 'other', label: 'Other' }
                ]}
              />

              <XStack space="$2">
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name={`${namePrefix}.onlineMeeting.meetingId` as any}
                    label="Meeting ID (Optional)"
                    placeholder="e.g., 123 456 789"
                  />
                </YStack>

                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name={`${namePrefix}.onlineMeeting.password` as any}
                    label="Passcode (Optional)"
                    placeholder="Meeting passcode"
                  />
                </YStack>
              </XStack>

              <EventFormInput
                control={control}
                name={`${namePrefix}.onlineMeeting.dialInNumber` as any}
                label="Dial-In Number (Optional)"
                placeholder="+1 234 567 8900"
                type="tel"
              />

              <OptimizedTextarea
                control={control}
                name={`${namePrefix}.onlineMeeting.additionalInfo` as any}
                label="Additional Online Info (Optional)"
                placeholder="Any other relevant meeting details or instructions"
                rows={3}
                maxLength={500}
              />
            </> : null}
        </YStack>
      </YStack>
    </Card>
  )
}

// Speaker Section
interface SpeakerSectionProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  title?: string
}

export function SpeakerSection<T extends FieldValues>({ 
  control, 
  namePrefix, 
  title = "Speakers" 
}: SpeakerSectionProps<T>) {
  const { card, text, button } = useAdminSpacing()
  const { fields, append, remove } = useFieldArray({
    control,
    name: namePrefix as any
  })

  const addSpeaker = () => {
    append({
      firstName: '',
      lastName: '',
      ecclesia: ''
    } as any)
  }

  // This component is now rendered through CollapsibleComponent which handles the header
  return (
    <YStack padding={card.padding} gap={card.space}>
          {fields.map((field, index) => (
            <Card key={field.id} padding={card.padding} backgroundColor="$gray1">
              <YStack space={card.space}>
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={text.headerSize} fontWeight="600">Speaker {index + 1}</Text>
                  <Button
                    size="$2"
                    variant="outlined"
                    color="$red10"
                    icon={Trash2}
                    onPress={() => remove(index)}
                  />
                </XStack>
                
                <XStack space={card.space}>
                  <YStack flex={1}>
                    <EventFormInput
                      control={control}
                      name={`${namePrefix}.${index}.firstName` as any}
                      label="First Name"
                      required
                    />
                  </YStack>
                  
                  <YStack flex={1}>
                    <EventFormInput
                      control={control}
                      name={`${namePrefix}.${index}.lastName` as any}
                      label="Last Name"
                      required
                    />
                  </YStack>
                </XStack>
                
                <EcclesiaSearchInput
                  control={control}
                  name={`${namePrefix}.${index}.ecclesia` as any}
                  label="Ecclesia"
                  placeholder="Search for speaker's ecclesia..."
                  required
                />
              </YStack>
            </Card>
          ))}
          
          {fields.length === 0 ? <Text color="$gray11" fontSize="$3" textAlign="center" paddingVertical="$3">
              No speakers added yet. Click "Add Speaker" to get started.
            </Text> : null}
      </YStack>
  )
}

// Schedule Section
interface ScheduleSectionProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  title?: string
}

const scheduleItemTypes = [
  { value: 'talk', label: 'Talk/Presentation' },
  { value: 'service', label: 'Service' },
  { value: 'meal', label: 'Meal' },
  { value: 'activity', label: 'Activity' },
  { value: 'break', label: 'Break' },
  { value: 'arrival', label: 'Arrival/Check-in' },
  { value: 'welcome', label: 'Welcome/Mingling' },
  { value: 'other', label: 'Other' }
]

export function ScheduleSection<T extends FieldValues>({ 
  control, 
  namePrefix, 
  title = "Schedule" 
}: ScheduleSectionProps<T>) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: namePrefix as any
  })

  const addScheduleItem = () => {
    append({
      title: '',
      startTime: new Date(),
      endTime: null,
      description: '',
      type: 'talk',
      notes: ''
    } as any)
  }

  // This component is now rendered through CollapsibleComponent which handles the header
  return (
    <YStack padding="$3" gap="$2">
          {fields.map((field, index) => (
            <Card key={field.id} padding="$3" backgroundColor="$gray1">
              <YStack space="$2">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$4" fontWeight="600">Schedule Item {index + 1}</Text>
                  <Button
                    size="$2"
                    variant="outlined"
                    color="$red10"
                    icon={Trash2}
                    onPress={() => remove(index)}
                  />
                </XStack>
                
                <XStack space="$2">
                  <YStack flex={2}>
                    <EventFormInput
                      control={control}
                      name={`${namePrefix}.${index}.title` as any}
                      label="Title"
                      placeholder="e.g., Opening Address"
                      required
                    />
                  </YStack>
                  
                  <YStack flex={1}>
                    <EventFormSelect
                      control={control}
                      name={`${namePrefix}.${index}.type` as any}
                      label="Type"
                      options={scheduleItemTypes}
                    />
                  </YStack>
                </XStack>
                
                <XStack space="$2">
                  <YStack flex={1}>
                    <EventDatePicker
                      control={control}
                      name={`${namePrefix}.${index}.startTime` as any}
                      label="Start Time"
                      includeTime
                      required
                    />
                  </YStack>
                  
                  <YStack flex={1}>
                    <EventDatePicker
                      control={control}
                      name={`${namePrefix}.${index}.endTime` as any}
                      label="End Time (Optional)"
                      includeTime
                    />
                  </YStack>
                </XStack>
                
                <EventFormInput
                  control={control}
                  name={`${namePrefix}.${index}.description` as any}
                  label="Description"
                  placeholder="Brief description of the item"
                  multiline
                />
                
                <EventFormInput
                  control={control}
                  name={`${namePrefix}.${index}.notes` as any}
                  label="Notes"
                  placeholder="Additional notes or special instructions"
                  multiline
                />
              </YStack>
            </Card>
          ))}
          
          {fields.length === 0 ? <Text color="$gray11" fontSize="$3" textAlign="center" paddingVertical="$3">
              No schedule items added yet. Click "Add Item" to get started.
            </Text> : null}
      </YStack>
  )
}

// Registration Section
interface RegistrationSectionProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  title?: string
}

export function RegistrationSection<T extends FieldValues>({ 
  control, 
  namePrefix, 
  title = "Registration Details" 
}: RegistrationSectionProps<T>) {
  const { card, text, button } = useAdminSpacing()
  const {
    field: { value: hasFee, onChange: onFeeChange }
  } = useController({
    name: `${namePrefix}.hasFee` as FieldPath<T>,
    control,
    defaultValue: false as PathValue<T, Path<T>>
  })

  return (
    <Card padding={card.padding} borderWidth={1} borderColor="$borderColor">
      <YStack space={card.space}>
        <XStack space={card.space} alignItems="center">
          <FileText size={button.iconSize} color="$orange10" />
          <Text fontSize="$4" fontWeight="600">{title}</Text>
        </XStack>
        
        <YStack space={card.space}>
          <EventFormSelect
            control={control}
            name={`${namePrefix}.required` as any}
            label="Registration Required"
            options={[
              { value: 'true', label: 'Yes' },
              { value: 'false', label: 'No' }
            ]}
          />
          
          <EventDatePicker
            control={control}
            name={`${namePrefix}.deadline` as any}
            label="Registration Deadline"
            includeTime
          />
          
          <EventFormInput
            control={control}
            name={`${namePrefix}.registrationUrl` as any}
            label="Registration URL"
            type="url"
            placeholder="https://..."
          />
          
          <XStack space={card.space}>
            <YStack flex={1}>
              <EventFormInput
                control={control}
                name={`${namePrefix}.contactEmail` as any}
                label="Contact Email"
                type="email"
                autoComplete="email"
              />
            </YStack>
            
            <YStack flex={1}>
              <EventFormInput
                control={control}
                name={`${namePrefix}.contactPhone` as any}
                label="Contact Phone"
                type="tel"
                autoComplete="tel"
              />
            </YStack>
          </XStack>

          {/* Fee Information Checkbox */}
          <XStack space={card.space} alignItems="center">
            <Checkbox
              id={`${namePrefix}-fee`}
              size="$3"
              checked={hasFee}
              onCheckedChange={onFeeChange}
            >
              <Checkbox.Indicator>
                <Check />
              </Checkbox.Indicator>
            </Checkbox>
            <Text fontSize="$3">Event has registration fee</Text>
          </XStack>

          {/* Fee fields - only show when checkbox is checked */}
          {hasFee ? <YStack space={card.space} paddingLeft={card.padding}>
              <EventFormInput
                control={control}
                name={`${namePrefix}.fee` as any}
                label="Registration Fee"
                type="number"
                placeholder="0.00"
              />
              
              <EventFormInput
                control={control}
                name={`${namePrefix}.paymentInstructions` as any}
                label="Payment Instructions"
                placeholder="How to pay registration fee"
                multiline
              />
            </YStack> : null}
          
          <EventFormInput
            control={control}
            name={`${namePrefix}.notes` as any}
            label="Additional Notes"
            placeholder="Special instructions"
            multiline
          />
        </YStack>
      </YStack>
    </Card>
  )
}

// Common location types for events
const locationTypes = [
  { value: 'main', label: 'Main Venue' },
  { value: 'ceremony', label: 'Ceremony' },
  { value: 'reception', label: 'Reception' },
  { value: 'viewing', label: 'Viewing' },
  { value: 'service', label: 'Service' },
  { value: 'burial', label: 'Burial' },
  { value: 'assembly', label: 'Assembly' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' }
]

export function MultipleLocationsSection<T extends FieldValues>({
  control,
  namePrefix,
  title = "Event Locations",
  allowCustomLocationTypes = true
}: MultipleLocationsSectionProps<T>) {
  const { card, text, button } = useAdminSpacing()
  const { fields, append, remove } = useFieldArray({
    control,
    name: namePrefix as any
  })

  const addLocation = () => {
    append({
      type: 'main',
      name: '',
      address: '',
      city: '',
      province: '',
      country: 'Canada',
      postalCode: '',
      directions: '',
      parkingInfo: ''
    } as any)
  }

  // This component is now rendered through CollapsibleComponent which handles the header  
  return (
    <YStack padding={card.padding} gap={card.space}>
        {fields.map((field, index) => (
          <Card key={field.id} padding={card.padding} backgroundColor="$gray1">
            <YStack space={card.space}>
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize="$4" fontWeight="600">Location {index + 1}</Text>
                <Button
                  size="$2"
                  variant="outlined"
                  color="$red10"
                  icon={Trash2}
                  onPress={() => remove(index)}
                />
              </XStack>
              
              <XStack space={card.space}>
                <YStack flex={1}>
                  <EventFormSelect
                    control={control}
                    name={`${namePrefix}.${index}.type` as any}
                    label="Location Type"
                    options={locationTypes}
                  />
                </YStack>
                
                <YStack flex={2}>
                  <EventFormInput
                    control={control}
                    name={`${namePrefix}.${index}.name` as any}
                    label="Location Name"
                    placeholder="e.g., Toronto East Ecclesial Hall"
                    required
                  />
                </YStack>
              </XStack>
              
              <EventFormInput
                control={control}
                name={`${namePrefix}.${index}.address` as any}
                label="Address"
                placeholder="123 Main Street"
                required
              />
              
              <XStack space={card.space}>
                <YStack flex={2}>
                  <EventFormInput
                    control={control}
                    name={`${namePrefix}.${index}.city` as any}
                    label="City"
                    placeholder="Toronto"
                    required
                  />
                </YStack>
                
                <YStack flex={1}>
                  <ProvinceSelect
                    control={control}
                    name={`${namePrefix}.${index}.province` as any}
                    countryFieldName={`${namePrefix}.${index}.country` as any}
                    label="Province"
                  />
                </YStack>
                
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name={`${namePrefix}.${index}.postalCode` as any}
                    label="Postal Code"
                    placeholder="M1M 1M1"
                  />
                </YStack>
              </XStack>
              
              <XStack space={card.space}>
                <YStack flex={1}>
                  <OptimizedTextarea
                    control={control}
                    name={`${namePrefix}.${index}.directions` as any}
                    label="Directions"
                    placeholder="Additional directions to help people find this location"
                    rows={3}
                  />
                </YStack>

                <YStack flex={1}>
                  <OptimizedTextarea
                    control={control}
                    name={`${namePrefix}.${index}.parkingInfo` as any}
                    label="Parking Information"
                    placeholder="Parking availability and instructions"
                    rows={3}
                  />
                </YStack>
              </XStack>
            </YStack>
          </Card>
        ))}
        
        {fields.length === 0 ? <Text color="$gray11" fontSize="$3" textAlign="center" paddingVertical="$3">
            No locations added yet. Click "Add Location" to get started.
          </Text> : null}
      </YStack>
  )
}