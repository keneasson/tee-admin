import { YStack, XStack, Text, Card, Button, Separator, Spinner } from '@my/ui'
import { MapPin, Navigation, Users } from '@tamagui/lucide-icons'

export interface NearbyEcclesiaItem {
  name: string
  displayName?: string
  distanceKm?: number
  country?: string
  province?: string
}

interface NearbyEcclesiasCardProps {
  ecclesiaName: string
  nearbyEcclesias: NearbyEcclesiaItem[]
  loading?: boolean
  radiusKm: number
  onEcclesiaClick?: (name: string) => void
}

function formatDistance(distanceKm: number | undefined): string | null {
  if (typeof distanceKm !== 'number') return null
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`
  return `${Math.round(distanceKm)} km`
}

function formatRegion(item: NearbyEcclesiaItem): string | null {
  const parts: string[] = []
  if (item.province) parts.push(item.province)
  if (item.country) parts.push(item.country)
  if (parts.length === 0) return null
  return parts.join(', ')
}

export function NearbyEcclesiasCard({
  ecclesiaName,
  nearbyEcclesias,
  loading = false,
  radiusKm,
  onEcclesiaClick,
}: NearbyEcclesiasCardProps) {
  const count = nearbyEcclesias.length
  const isClickable = typeof onEcclesiaClick === 'function'

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Navigation size={20} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Nearby Ecclesias</Text>
          </XStack>
          {!loading && count > 0 ? (
            <XStack
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$10"
              backgroundColor="$blue4"
              alignItems="center"
              gap="$1"
            >
              <Users size={12} color="$blue11" />
              <Text fontSize="$2" fontWeight="600" color="$blue11">{count}</Text>
            </XStack>
          ) : null}
        </XStack>

        <Text fontSize="$2" theme="alt2">
          Ecclesias within {radiusKm}km of {ecclesiaName}
        </Text>

        <Separator />

        {loading ? (
          <XStack gap="$2" alignItems="center" justifyContent="center" paddingVertical="$4">
            <Spinner size="small" width={20} height={20} />
            <Text fontSize="$3" theme="alt2">Loading nearby ecclesias...</Text>
          </XStack>
        ) : count === 0 ? (
          <XStack gap="$2" alignItems="center" justifyContent="center" paddingVertical="$4">
            <MapPin size={16} color="$gray10" />
            <Text fontSize="$3" theme="alt2">No ecclesias within {radiusKm}km</Text>
          </XStack>
        ) : (
          <YStack gap="$2">
            {nearbyEcclesias.map((item) => {
              const label = item.displayName || item.name
              const distance = formatDistance(item.distanceKm)
              const region = formatRegion(item)

              const row = (
                <XStack gap="$3" alignItems="center" paddingVertical="$2" paddingHorizontal="$2">
                  <MapPin size={16} color="$blue10" />
                  <YStack flex={1} gap="$1">
                    <Text fontSize="$4" fontWeight="600">{label}</Text>
                    {region ? (
                      <Text fontSize="$2" theme="alt2">{region}</Text>
                    ) : null}
                  </YStack>
                  {distance ? (
                    <Text fontSize="$3" color="$blue11" fontWeight="600">{distance}</Text>
                  ) : null}
                </XStack>
              )

              if (isClickable) {
                return (
                  <Button
                    key={item.name}
                    unstyled
                    padding={0}
                    backgroundColor="$background"
                    borderWidth={1}
                    borderColor="$borderColor"
                    borderRadius="$3"
                    hoverStyle={{
                      backgroundColor: '$blue2',
                      borderColor: '$blue8',
                    }}
                    pressStyle={{
                      backgroundColor: '$blue3',
                      borderColor: '$blue9',
                    }}
                    cursor="pointer"
                    onPress={() => onEcclesiaClick?.(item.name)}
                  >
                    {row}
                  </Button>
                )
              }

              return (
                <YStack
                  key={item.name}
                  borderWidth={1}
                  borderColor="$borderColor"
                  borderRadius="$3"
                  backgroundColor="$background"
                >
                  {row}
                </YStack>
              )
            })}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}
