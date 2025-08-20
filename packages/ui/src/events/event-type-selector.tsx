import { YStack, XStack, Card, Text, Button } from 'tamagui'
import { Calendar, Heart, Users, FileText, Droplets, RefreshCw } from '@tamagui/lucide-icons'
import { EventType } from '@my/app/types/events'

interface EventTypeOption {
  type: EventType
  label: string
  description: string
  icon: any
  color: string
}

const eventTypeOptions: EventTypeOption[] = [
  {
    type: 'study-weekend',
    label: 'Study Weekend',
    description: 'Multi-day ecclesial event with speakers, meals, and activities',
    icon: Calendar,
    color: '$blue10'
  },
  {
    type: 'funeral',
    label: 'Funeral',
    description: 'Memorial service with viewing and burial information',
    icon: Heart,
    color: '$gray10'
  },
  {
    type: 'wedding',
    label: 'Wedding',
    description: 'Marriage ceremony with reception details',
    icon: Users,
    color: '$pink10'
  },
  {
    type: 'baptism',
    label: 'Baptism',
    description: 'Baptism ceremony with candidate and ecclesia information',
    icon: Droplets,
    color: '$blue8'
  },
  {
    type: 'general',
    label: 'General Event',
    description: 'Flexible event type for any other ecclesial activities',
    icon: FileText,
    color: '$green10'
  },
  {
    type: 'recurring',
    label: 'Recurring Event',
    description: 'Regular ongoing activities like Bible seminars, weekly studies, etc.',
    icon: RefreshCw,
    color: '$purple10'
  }
]

interface EventTypeSelectorProps {
  value?: EventType
  onSelect: (type: EventType) => void
  disabled?: boolean
}

export function EventTypeSelector({ value, onSelect, disabled = false }: EventTypeSelectorProps) {
  return (
    <YStack space="$4">
      <YStack space="$2">
        <Text fontSize="$6" fontWeight="bold">Select Event Type</Text>
        <Text color="$gray11" fontSize="$4">
          Choose the type of event you want to create. This will determine the available form fields and structure.
        </Text>
      </YStack>

      <YStack space="$3">
        {eventTypeOptions.map((option) => {
          const IconComponent = option.icon
          const isSelected = value === option.type
          
          return (
            <Card
              key={option.type}
              padding="$4"
              borderWidth={2}
              borderColor={isSelected ? option.color : '$borderColor'}
              backgroundColor={isSelected ? '$color2' : '$background'}
              pressStyle={{ scale: 0.98 }}
              cursor="pointer"
              onPress={() => !disabled && onSelect(option.type)}
              opacity={disabled ? 0.6 : 1}
            >
              <XStack space="$4" alignItems="center">
                <YStack
                  width="$4"
                  height="$4"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={isSelected ? option.color : '$gray5'}
                  borderRadius="$4"
                >
                  <IconComponent
                    size="$1.5"
                    color={isSelected ? 'white' : '$gray11'}
                  />
                </YStack>
                
                <YStack flex={1} space="$1">
                  <Text fontSize="$5" fontWeight="600" color={isSelected ? option.color : '$color'}>
                    {option.label}
                  </Text>
                  <Text fontSize="$3" color="$gray11" lineHeight="$1">
                    {option.description}
                  </Text>
                </YStack>
                
                {isSelected && (
                  <YStack
                    width="$2"
                    height="$2"
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={option.color}
                    borderRadius="$10"
                  >
                    <Text color="white" fontSize="$2" fontWeight="bold">✓</Text>
                  </YStack>
                )}
              </XStack>
            </Card>
          )
        })}
      </YStack>
    </YStack>
  )
}