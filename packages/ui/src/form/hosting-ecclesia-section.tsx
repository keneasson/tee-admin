import { Control, useController, FieldPath, FieldValues } from 'react-hook-form'
import { YStack, XStack, Card, Text, Checkbox } from 'tamagui'
import { Church, Check } from '@tamagui/lucide-icons'
import { EventFormInput } from './event-form-input'
import { CountrySelect, ProvinceSelect } from './location-select'

interface HostingEcclesiaSectionProps<T extends FieldValues> {
  control: Control<T>
  namePrefix: string
  title?: string
  defaultEcclesiaName?: string
}

export function HostingEcclesiaSection<T extends FieldValues>({ 
  control, 
  namePrefix, 
  title = "Hosting Ecclesia",
  defaultEcclesiaName = "Toronto East Christadelphian Ecclesia"
}: HostingEcclesiaSectionProps<T>) {
  
  const {
    field: { value: isHosting, onChange: onHostingChange }
  } = useController({
    name: `${namePrefix}.isHosting` as FieldPath<T>,
    control,
    defaultValue: false
  })

  const {
    field: { value: ecclesiaName, onChange: onNameChange }
  } = useController({
    name: `${namePrefix}.name` as FieldPath<T>,
    control,
    defaultValue: defaultEcclesiaName
  })

  // Controllers for location fields
  const {
    field: { onChange: onCityChange }
  } = useController({
    name: `${namePrefix}.city` as FieldPath<T>,
    control,
    defaultValue: ''
  })

  const {
    field: { onChange: onProvinceChange }
  } = useController({
    name: `${namePrefix}.province` as FieldPath<T>,
    control,
    defaultValue: ''
  })

  const {
    field: { onChange: onCountryChange }
  } = useController({
    name: `${namePrefix}.country` as FieldPath<T>,
    control,
    defaultValue: ''
  })

  const handleHostingChange = (checked: boolean) => {
    onHostingChange(checked)
    if (checked) {
      // Set default values for Toronto East Christadelphian Ecclesia
      onNameChange(defaultEcclesiaName)
      onCityChange('Toronto')
      onProvinceChange('ON')
      onCountryChange('CA')
    } else {
      // Clear location fields when switching to custom ecclesia
      onCityChange('')
      onProvinceChange('')
      onCountryChange('')
    }
  }

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack space="$4">
        <XStack space="$2" alignItems="center">
          <Church size="$1" color="$green10" />
          <Text fontSize="$5" fontWeight="600">{title}</Text>
        </XStack>
        
        <YStack space="$3">
          {/* Hosting checkbox */}
          <XStack space="$3" alignItems="center">
            <Checkbox
              id={`${namePrefix}-hosting`}
              size="$4"
              checked={isHosting}
              onCheckedChange={handleHostingChange}
            >
              <Checkbox.Indicator>
                <Check />
              </Checkbox.Indicator>
            </Checkbox>
            <Text fontSize="$4" fontWeight="500">
              Hosted by {defaultEcclesiaName}
            </Text>
          </XStack>

          {/* Custom ecclesia name when not hosting */}
          {!isHosting && (
            <YStack space="$3">
              <EventFormInput
                control={control}
                name={`${namePrefix}.name` as FieldPath<T>}
                label="Hosting Ecclesia Name"
                placeholder="Enter the name of the hosting ecclesia"
                required
              />
              
              {/* Location fields for custom ecclesia */}
              <XStack space="$2">
                <YStack flex={1}>
                  <EventFormInput
                    control={control}
                    name={`${namePrefix}.city` as FieldPath<T>}
                    label="City"
                    placeholder="Toronto"
                  />
                </YStack>
                
                <YStack flex={1}>
                  <ProvinceSelect
                    control={control}
                    name={`${namePrefix}.province` as FieldPath<T>}
                    countryFieldName={`${namePrefix}.country` as FieldPath<T>}
                    label="Province/State"
                    placeholder="Select Province"
                  />
                </YStack>
              </XStack>
              
              <XStack space="$2">
                <YStack flex={1}>
                  <CountrySelect
                    control={control}
                    name={`${namePrefix}.country` as FieldPath<T>}
                    label="Country"
                    placeholder="Select Country"
                  />
                </YStack>
              </XStack>
            </YStack>
          )}

          {/* Additional hosting details */}
          <EventFormInput
            control={control}
            name={`${namePrefix}.contactEmail` as FieldPath<T>}
            label="Contact Email"
            type="email"
            placeholder="contact@ecclesia.org"
            autoComplete="email"
          />

          <EventFormInput
            control={control}
            name={`${namePrefix}.contactPhone` as FieldPath<T>}
            label="Contact Phone"
            type="tel"
            placeholder="(555) 123-4567"
            autoComplete="tel"
          />

          <EventFormInput
            control={control}
            name={`${namePrefix}.notes` as FieldPath<T>}
            label="Additional Notes"
            placeholder="Any additional hosting information"
            multiline
          />
        </YStack>
      </YStack>
    </Card>
  )
}