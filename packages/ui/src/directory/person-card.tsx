import React from 'react'
import { YStack, XStack, Text, Card } from 'tamagui'
import { ChevronRight } from '@tamagui/lucide-icons'

interface PersonCardProps {
  name: string
  ecclesia?: string
  /** Hide ecclesia label when already filtering by ecclesia */
  hideEcclesia?: boolean
  /** Second line under the name (e.g. the address of a record with no name). */
  subtitle?: string
  /** Grey the name: it's a placeholder like "Name not set", not a real name. */
  nameMuted?: boolean
  onPress?: () => void
}

export const PersonCard: React.FC<PersonCardProps> = ({
  name,
  ecclesia,
  hideEcclesia = false,
  subtitle,
  nameMuted = false,
  onPress,
}) => {
  return (
    <Card
      padding="$3"
      backgroundColor="$backgroundHover"
      pressStyle={onPress ? { opacity: 0.8, scale: 0.99 } : undefined}
      onPress={onPress}
      cursor={onPress ? 'pointer' : undefined}
      hoverStyle={onPress ? { backgroundColor: '$backgroundFocus' } : undefined}
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <YStack flex={1} gap="$1.5">
          <Text fontSize="$4" fontWeight="500" color={nameMuted ? '$textTertiary' : undefined} fontStyle={nameMuted ? 'italic' : undefined}>
            {name}
          </Text>
          {subtitle ? (
            <Text fontSize="$2" theme="alt2">{subtitle}</Text>
          ) : null}
          {!hideEcclesia && ecclesia ? (
            <Text fontSize="$2" theme="alt2">{ecclesia}</Text>
          ) : null}
        </YStack>
        {onPress ? <ChevronRight size={20} color="$gray10" /> : null}
      </XStack>
    </Card>
  )
}
