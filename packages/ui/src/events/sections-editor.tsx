import { Control, useFieldArray, useWatch, FieldValues, FieldPath } from 'react-hook-form'
import { YStack, XStack, Card, Text, Button } from 'tamagui'
import { Plus, Trash2, ChevronDown, ChevronUp } from '@tamagui/lucide-icons'
import { useState } from 'react'
import { EventFormInput } from '../form/event-form-input'
import { EventFormSelect } from '../form/event-form-select'
import { EventDatePicker } from '../form/event-date-picker'
import { AddressAutocomplete } from '../form/address-autocomplete'
import type { ParsedAddress } from '@my/app/types/address-autocomplete'
import { buildMapsUrl } from '@my/app/types/address-autocomplete'

const scheduleItemTypes = [
  { value: 'talk', label: 'Talk/Presentation' },
  { value: 'service', label: 'Service' },
  { value: 'meal', label: 'Meal' },
  { value: 'activity', label: 'Activity' },
  { value: 'break', label: 'Break' },
  { value: 'arrival', label: 'Arrival/Check-in' },
  { value: 'welcome', label: 'Welcome/Mingling' },
  { value: 'other', label: 'Other' },
]

interface SectionsEditorProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  setValue?: (name: string, value: any) => void
}

/**
 * Minimal editor for event sections.
 * Each section: title, location name, and schedule items.
 */
export function SectionsEditor<T extends FieldValues>({
  control,
  namePrefix,
  setValue,
}: SectionsEditorProps<T>) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: namePrefix as any,
  })

  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    fields.length > 0 ? 0 : null
  )

  const addSection = () => {
    append({
      id: crypto.randomUUID(),
      title: '',
      location: { name: '', address: '', city: '', province: '', postalCode: '', country: '', mapsUrl: '' },
      items: [],
    } as any)
    setExpandedIndex(fields.length)
  }

  const toggleSection = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  return (
    <YStack gap="$3" padding="$3">
      {fields.map((field, index) => {
        const isExpanded = expandedIndex === index

        return (
          <Card
            key={field.id}
            borderWidth={1}
            borderColor={isExpanded ? '$blue8' : '$borderColor'}
            borderRadius="$4"
            overflow="hidden"
          >
            {/* Accordion header */}
            <XStack
              padding="$3"
              backgroundColor={isExpanded ? '$blue2' : '$gray2'}
              alignItems="center"
              justifyContent="space-between"
              cursor="pointer"
              pressStyle={{ opacity: 0.8 }}
              onPress={() => toggleSection(index)}
            >
              <XStack gap="$2" alignItems="center" flex={1}>
                {isExpanded ? (
                  <ChevronUp size={16} color="$gray11" />
                ) : (
                  <ChevronDown size={16} color="$gray11" />
                )}
                <Text fontSize="$4" fontWeight="600" color="$color">
                  Section {index + 1}
                </Text>
              </XStack>

              <XStack gap="$2" alignItems="center">
                {index > 0 ? (
                  <Button
                    size="$2"
                    variant="outlined"
                    icon={ChevronUp}
                    onPress={(e: any) => {
                      e.stopPropagation()
                      move(index, index - 1)
                      setExpandedIndex(index - 1)
                    }}
                  />
                ) : null}
                {index < fields.length - 1 ? (
                  <Button
                    size="$2"
                    variant="outlined"
                    icon={ChevronDown}
                    onPress={(e: any) => {
                      e.stopPropagation()
                      move(index, index + 1)
                      setExpandedIndex(index + 1)
                    }}
                  />
                ) : null}
                <Button
                  size="$2"
                  variant="outlined"
                  color="$red10"
                  icon={Trash2}
                  onPress={(e: any) => {
                    e.stopPropagation()
                    remove(index)
                    if (expandedIndex === index) {
                      setExpandedIndex(null)
                    } else if (expandedIndex !== null && expandedIndex > index) {
                      setExpandedIndex(expandedIndex - 1)
                    }
                  }}
                />
              </XStack>
            </XStack>

            {/* Expanded content */}
            {isExpanded ? (
              <YStack padding="$3" gap="$3">
                <EventFormInput
                  control={control}
                  name={`${namePrefix}.${index}.title` as any}
                  label="Section Title"
                  placeholder='e.g., "Friday Evening"'
                  required
                />

                <EventFormInput
                  control={control}
                  name={`${namePrefix}.${index}.location.name` as any}
                  label="Venue Name (Optional)"
                  placeholder='e.g., "Anapilis Hall"'
                />

                <SectionLocationField
                  control={control}
                  namePrefix={`${namePrefix}.${index}.location`}
                  setValue={setValue}
                />

                {/* Schedule items */}
                <SectionScheduleItems
                  control={control}
                  namePrefix={`${namePrefix}.${index}.items`}
                />
              </YStack>
            ) : null}
          </Card>
        )
      })}

      {fields.length === 0 ? (
        <Text color="$gray11" fontSize="$3" textAlign="center" paddingVertical="$3">
          No sections yet. Add sections for different days or locations.
        </Text>
      ) : null}

      <Button size="$3" theme="blue" icon={Plus} onPress={addSection} alignSelf="center">
        Add Section
      </Button>
    </YStack>
  )
}

// --- Section location field with address autocomplete ---

function SectionLocationField<T extends FieldValues>({
  control,
  namePrefix,
  setValue,
}: {
  control: Control<T>
  namePrefix: string // e.g., "sections.0.location"
  setValue?: (name: string, value: any) => void
}) {
  const addressValue = useWatch({
    control,
    name: `${namePrefix}.address` as FieldPath<T>,
  }) as string | undefined

  const countryValue = useWatch({
    control,
    name: `${namePrefix}.country` as FieldPath<T>,
  }) as string | undefined

  return (
    <AddressAutocomplete
      value={addressValue || ''}
      onChangeText={(text) => {
        if (setValue) setValue(`${namePrefix}.address`, text)
      }}
      onAddressSelect={(parsed: ParsedAddress) => {
        if (!setValue) return
        setValue(`${namePrefix}.address`, parsed.formattedAddress || parsed.streetAddress)
        setValue(`${namePrefix}.city`, parsed.city)
        setValue(`${namePrefix}.province`, parsed.province)
        setValue(`${namePrefix}.postalCode`, parsed.postalCode)
        setValue(`${namePrefix}.country`, parsed.country)
        setValue(`${namePrefix}.mapsUrl`, buildMapsUrl(parsed))
        if (parsed.lat) setValue(`${namePrefix}.lat`, parsed.lat)
        if (parsed.lng) setValue(`${namePrefix}.lng`, parsed.lng)
        if (parsed.placeId) setValue(`${namePrefix}.placeId`, parsed.placeId)
        if (parsed.name) setValue(`${namePrefix}.placeName`, parsed.name)
      }}
      label="Address"
      country={countryValue}
      disabled={!setValue}
    />
  )
}

// --- Schedule items within a section ---

function SectionScheduleItems<T extends FieldValues>({
  control,
  namePrefix,
}: {
  control: Control<T>
  namePrefix: string
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: namePrefix as any,
  })

  const addItem = () => {
    append({
      title: '',
      startTime: new Date(),
      type: 'talk',
    } as any)
  }

  return (
    <YStack gap="$2">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$3" fontWeight="600" color="$gray11">
          Schedule Items
        </Text>
        <Button size="$2" theme="blue" icon={Plus} onPress={addItem}>
          Add Item
        </Button>
      </XStack>

      {fields.map((field, index) => (
        <Card key={field.id} padding="$3" backgroundColor="$gray1">
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize="$3" fontWeight="600">Item {index + 1}</Text>
              <Button
                size="$2"
                variant="outlined"
                color="$red10"
                icon={Trash2}
                onPress={() => remove(index)}
              />
            </XStack>

            <XStack gap="$2">
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

            <XStack gap="$2">
              <YStack flex={1}>
                <EventDatePicker
                  control={control}
                  name={`${namePrefix}.${index}.startTime` as any}
                  label="Start Time"
                  includeTime
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
          </YStack>
        </Card>
      ))}

      {fields.length === 0 ? (
        <Text color="$gray11" fontSize="$2" textAlign="center" paddingVertical="$2">
          No schedule items yet.
        </Text>
      ) : null}
    </YStack>
  )
}
