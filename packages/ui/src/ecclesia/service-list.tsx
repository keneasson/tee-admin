import { YStack, XStack, Text, Card, Button } from '@my/ui'
import { Clock, MapPin, Pencil, Trash, Plus } from '@tamagui/lucide-icons'

export type ServiceType = 'memorial' | 'bible_class' | 'cyc' | 'sunday_school' | 'other'

export interface EcclesiaService {
  id: string
  name: string
  type: ServiceType
  day?: string
  time?: string
  location?: string
}

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  memorial: 'Memorial Meeting',
  bible_class: 'Bible Class',
  cyc: 'CYC',
  sunday_school: 'Sunday School',
  other: 'Other',
}

const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  memorial: '$blue10',
  bible_class: '$green10',
  cyc: '$orange10',
  sunday_school: '$purple10',
  other: '$gray10',
}

interface ServiceListProps {
  services: EcclesiaService[]
  canEdit: boolean
  onAdd?: () => void
  onEdit?: (service: EcclesiaService) => void
  onDelete?: (serviceId: string) => void
}

export function ServiceList({ services, canEdit, onAdd, onEdit, onDelete }: ServiceListProps) {
  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$5" fontWeight="600">Worship Services</Text>
        {canEdit ? (
          <Button
            size="$3"
            icon={Plus}
            theme="blue"
            onPress={onAdd}
          >
            Add Service
          </Button>
        ) : null}
      </XStack>

      {services.length === 0 ? (
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No worship services have been added yet.
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
              <XStack justifyContent="space-between" alignItems="flex-start">
                <YStack gap="$1" flex={1}>
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
                        color={SERVICE_TYPE_COLORS[service.type]}
                      >
                        {SERVICE_TYPE_LABELS[service.type]}
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
                {canEdit ? (
                  <XStack gap="$1">
                    <Button
                      size="$2"
                      icon={Pencil}
                      chromeless
                      circular
                      onPress={() => onEdit?.(service)}
                    />
                    <Button
                      size="$2"
                      icon={Trash}
                      chromeless
                      circular
                      onPress={() => onDelete?.(service.id)}
                    />
                  </XStack>
                ) : null}
              </XStack>
            </Card>
          ))}
        </YStack>
      )}
    </YStack>
  )
}

export { SERVICE_TYPE_LABELS }
