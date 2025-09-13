import { Control, FieldValues } from 'react-hook-form'
import { Calendar, FileText } from '@tamagui/lucide-icons'
import { YStack, XStack } from 'tamagui'
import { EventFormInput } from '../../form/event-form-input'
import { EventDateRangePicker } from '../../form/event-date-range-picker'
import { EcclesiaSearchInput } from '../../form/ecclesia-search-input'
import { BaseFormSection, BaseFormSectionProps } from './base-form-section'
import { EventType } from '@my/app/types/events'

interface EventBasicInfoSectionProps<T extends FieldValues> extends BaseFormSectionProps<T> {
  eventType: EventType
}

export function EventBasicInfoSection<T extends FieldValues>({
  control,
  eventType,
  onFieldChange
}: EventBasicInfoSectionProps<T>) {
  const getSectionContent = () => {
    switch (eventType) {
      case 'study-weekend':
        return (
          <YStack gap="$4">
            <EventFormInput
              control={control}
              name="title"
              label="Event Title"
              placeholder="Enter event title"
              required
              onDebouncedChange={onFieldChange}
            />
            
            <EventFormInput
              control={control}
              name="theme"
              label="Theme"
              placeholder="Event theme or topic"
              onDebouncedChange={onFieldChange}
            />
            
            <EventDateRangePicker
              control={control}
              name="dateRange"
              label="Event Dates"
              required
              allowSingleDay={false}
              allowHideTimes={true}
              onDateChange={onFieldChange}
            />
          </YStack>
        )
        
      case 'baptism':
        return (
          <YStack gap="$4">
            <EventFormInput
              control={control}
              name="title"
              label="Event Title"
              placeholder="Enter event title"
              required
              onDebouncedChange={onFieldChange}
            />
            
            <YStack gap="$3">
              <XStack gap="$3">
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="candidate.firstName"
                    label="Candidate First Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="candidate.lastName"
                    label="Candidate Last Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
              </XStack>
            </YStack>
            
            <EventDateRangePicker
              control={control}
              name="baptismDate"
              label="Baptism Date"
              required
              allowSingleDay={true}
              allowHideTimes={true}
              onDateChange={onFieldChange}
            />
            
            <EcclesiaSearchInput
              control={control}
              name="hostingEcclesia"
              label="Hosting Ecclesia"
              placeholder="Search for hosting ecclesia..."
              required
            />
          </YStack>
        )
        
      case 'wedding':
        return (
          <YStack gap="$4">
            <EventFormInput
              control={control}
              name="title"
              label="Event Title"
              placeholder="Enter event title"
              required
              onDebouncedChange={onFieldChange}
            />
            
            <YStack gap="$3">
              <XStack gap="$3">
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="couple.bride.firstName"
                    label="Bride First Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="couple.bride.lastName"
                    label="Bride Last Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
              </XStack>
              <XStack gap="$3">
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="couple.groom.firstName"
                    label="Groom First Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="couple.groom.lastName"
                    label="Groom Last Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
              </XStack>
            </YStack>
            
            <EventDateRangePicker
              control={control}
              name="ceremonyDate"
              label="Ceremony Date"
              required
              allowSingleDay={true}
              allowHideTimes={true}
              onDateChange={onFieldChange}
            />
          </YStack>
        )
        
      case 'funeral':
        return (
          <YStack gap="$4">
            <EventFormInput
              control={control}
              name="title"
              label="Event Title"
              placeholder="Enter event title"
              required
              onDebouncedChange={onFieldChange}
            />
            
            <YStack gap="$3">
              <XStack gap="$3">
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="deceased.firstName"
                    label="First Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name="deceased.lastName"
                    label="Last Name"
                    required
                    onDebouncedChange={onFieldChange}
                  />
                </YStack>
              </XStack>
            </YStack>
            
            <XStack gap="$3">
              <YStack flex={1}>
                <EventDateRangePicker
                  control={control}
                  name="serviceDate"
                  label="Service Date"
                  required
                  allowSingleDay={true}
                  allowHideTimes={false}
                  onDateChange={onFieldChange}
                />
              </YStack>
              <YStack flex={1}>
                <EventDateRangePicker
                  control={control}
                  name="viewingDate"
                  label="Viewing Date"
                  allowSingleDay={true}
                  allowHideTimes={false}
                  onDateChange={onFieldChange}
                />
              </YStack>
            </XStack>
          </YStack>
        )
        
      case 'general':
        return (
          <YStack gap="$4">
            <EventFormInput
              control={control}
              name="title"
              label="Event Title"
              placeholder="Enter event title"
              required
              onDebouncedChange={onFieldChange}
            />
            
            <EventDateRangePicker
              control={control}
              name="eventDates"
              label="Event Dates"
              required
              allowSingleDay={true}
              allowHideTimes={true}
              onDateChange={onFieldChange}
            />
          </YStack>
        )
        
      case 'recurring':
        return (
          <YStack gap="$4">
            <EventFormInput
              control={control}
              name="title"
              label="Event Title"
              placeholder="Enter event title"
              required
              onDebouncedChange={onFieldChange}
            />
            
            <XStack gap="$3">
              <YStack flex={1}>
                <EventFormInput
                  control={control}
                  name="recurringConfig.startTime"
                  label="Start Time"
                  placeholder="19:00"
                  required
                  onDebouncedChange={onFieldChange}
                />
              </YStack>
              <YStack flex={1}>
                <EventFormInput
                  control={control}
                  name="recurringConfig.endTime"
                  label="End Time"
                  placeholder="20:30"
                  required
                  onDebouncedChange={onFieldChange}
                />
              </YStack>
            </XStack>
            
            <EventDateRangePicker
              control={control}
              name="recurringConfig.startDate"
              label="Start Date"
              required
              allowSingleDay={true}
              allowHideTimes={false}
              onDateChange={onFieldChange}
            />
            
            <EventFormInput
              control={control}
              name="recurringConfig.contactPerson"
              label="Contact Person"
              placeholder="e.g., Brother Smith"
              onDebouncedChange={onFieldChange}
            />
          </YStack>
        )
        
      default:
        return null
    }
  }
  
  return (
    <BaseFormSection
      control={control}
      title="Basic Event Information"
      description="Essential details about your event"
      icon={Calendar}
      required
    >
      {getSectionContent()}
    </BaseFormSection>
  )
}