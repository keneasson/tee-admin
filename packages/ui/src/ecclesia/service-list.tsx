import { YStack, XStack, Text, Card } from '@my/ui'
import { Clock, MapPin } from '@tamagui/lucide-icons'
import { deriveServicesFromScheduleConfig } from '@my/app/config/service-time-resolver'
import type { ScheduleTypeKey } from '@my/app/config/schedule-fields'

const TYPE_COLORS: Record<ScheduleTypeKey, string> = {
  memorial: '$blue10',
  bibleClass: '$green10',
  cyc: '$orange10',
  sundaySchool: '$purple10',
}

interface ServiceListProps {
  /** The ecclesia's scheduleConfig from DynamoDB */
  scheduleConfig?: Record<string, any>
}

/**
 * Read-only display of worship services derived from the schedule configuration.
 * Replaces the old CRUD-based service list — editing is done via ScheduleConfigEditor.
 */
export function ServiceList({ scheduleConfig }: ServiceListProps) {
  const services = deriveServicesFromScheduleConfig(scheduleConfig)

  return (
    <YStack gap="$3">
      <Text fontSize="$5" fontWeight="600">Worship Services</Text>

      {services.length === 0 ? (
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No worship services have been configured yet.
          </Text>
        </Card>
      ) : (
        <YStack gap="$2">
          {services.map((service) => (
            <Card
              key={service.id}
              padding="$3"
              borderWidth={1}
              borderColor="$borderColor"
            >
              <YStack gap="$1">
                <XStack gap="$2" alignItems="center">
                  <Text fontSize="$4" fontWeight="600">{service.name}</Text>
                  <Card
                    paddingHorizontal="$2"
                    paddingVertical="$1"
                    backgroundColor="$backgroundHover"
                    borderRadius="$2"
                  >
                    <Text
                      fontSize="$2"
                      fontWeight="600"
                      color={TYPE_COLORS[service.type] || '$gray10'}
                    >
                      {service.type}
                    </Text>
                  </Card>
                </XStack>
                <XStack gap="$4" flexWrap="wrap">
                  {(service.day || service.time) ? (
                    <XStack gap="$1" alignItems="center">
                      <Clock size={14} color="$gray10" />
                      <Text fontSize="$3" theme="alt2">
                        {[service.day, service.time].filter(Boolean).join(' at ')}
                      </Text>
                    </XStack>
                  ) : null}
                  {service.location ? (
                    <XStack gap="$1" alignItems="center">
                      <MapPin size={14} color="$gray10" />
                      <Text fontSize="$3" theme="alt2">{service.location}</Text>
                    </XStack>
                  ) : null}
                </XStack>
              </YStack>
            </Card>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
