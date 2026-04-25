import { YStack, XStack, Text, Card } from 'tamagui'
import { Building2, MapPin, Mail, Users } from '@tamagui/lucide-icons'
import type { OrganizationType } from '@my/app/provider/dynamodb/types'

export interface OrganizationCardData {
  name: string
  type: OrganizationType
  description?: string
  country: string
  province: string
  city: string
  contactEmail?: string
  website?: string
  memberEcclesias: string[]
}

interface OrganizationCardProps {
  organization: OrganizationCardData
  onPress?: () => void
}

const TYPE_LABELS: Record<OrganizationType, string> = {
  fraternal_gathering: 'Fraternal Gathering',
  bible_school: 'Bible School',
  charity: 'Charity',
  youth_group: 'Youth Group',
  other: 'Other',
}

const TYPE_COLORS: Record<OrganizationType, { bg: string; text: string }> = {
  fraternal_gathering: { bg: '$blue3', text: '$blue11' },
  bible_school: { bg: '$green3', text: '$green11' },
  charity: { bg: '$purple3', text: '$purple11' },
  youth_group: { bg: '$orange3', text: '$orange11' },
  other: { bg: '$gray3', text: '$gray11' },
}

export function OrganizationCard({ organization, onPress }: OrganizationCardProps) {
  const locationParts = [organization.city, organization.province, organization.country].filter(Boolean)
  const typeColor = TYPE_COLORS[organization.type] || TYPE_COLORS.other

  return (
    <Card
      padding="$4"
      borderWidth={1}
      borderColor="$borderColor"
      pressStyle={{ backgroundColor: '$backgroundHover' }}
      cursor={onPress ? 'pointer' : undefined}
      onPress={onPress}
      hoverStyle={{ borderColor: '$blue8' }}
    >
      <YStack gap="$2">
        <XStack justifyContent="space-between" alignItems="flex-start">
          <XStack gap="$2" alignItems="center" flex={1}>
            <Building2 size={20} color="$blue10" />
            <Text fontSize="$5" fontWeight="600" numberOfLines={1} flex={1}>
              {organization.name}
            </Text>
          </XStack>
          <Card
            paddingHorizontal="$2"
            paddingVertical="$1"
            backgroundColor={typeColor.bg}
            borderRadius="$2"
          >
            <Text fontSize="$2" fontWeight="600" color={typeColor.text}>
              {TYPE_LABELS[organization.type] || 'Other'}
            </Text>
          </Card>
        </XStack>

        {organization.description ? (
          <Text fontSize="$3" theme="alt2" numberOfLines={2}>
            {organization.description}
          </Text>
        ) : null}

        <XStack gap="$4" flexWrap="wrap" marginTop="$1">
          {locationParts.length > 0 ? (
            <XStack gap="$1" alignItems="center">
              <MapPin size={14} color="$gray10" />
              <Text fontSize="$3" theme="alt2">{locationParts.join(', ')}</Text>
            </XStack>
          ) : null}

          {organization.contactEmail ? (
            <XStack gap="$1" alignItems="center">
              <Mail size={14} color="$gray10" />
              <Text fontSize="$3" theme="alt2">{organization.contactEmail}</Text>
            </XStack>
          ) : null}

          {organization.memberEcclesias.length > 0 ? (
            <XStack gap="$1" alignItems="center">
              <Users size={14} color="$gray10" />
              <Text fontSize="$3" theme="alt2">
                {organization.memberEcclesias.length} ecclesia{organization.memberEcclesias.length !== 1 ? 's' : ''}
              </Text>
            </XStack>
          ) : null}
        </XStack>
      </YStack>
    </Card>
  )
}
