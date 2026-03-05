import React from 'react'
import { YStack, XStack, Text, Card, Spinner } from 'tamagui'
import { Button } from '../Button'
import { ChevronRight, Trash2 } from '@tamagui/lucide-icons'

interface MemberCardProps {
  email: string
  name: string
  ecclesia?: string
  canViewDetails?: boolean
  privacy?: Record<string, string> // kept for backward compat, not rendered on cards
  onPress?: () => void
  onDelete?: () => void
  isDeleting?: boolean
}

export const MemberCard: React.FC<MemberCardProps> = ({
  name,
  ecclesia,
  onPress,
  onDelete,
  isDeleting = false,
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
          <Text fontSize="$4" fontWeight="500">{name}</Text>
          {ecclesia ? (
            <Text fontSize="$2" theme="alt2">{ecclesia}</Text>
          ) : null}
        </YStack>
        <XStack gap="$2" alignItems="center">
          {onDelete ? (
            <Button
              size="$2"
              icon={isDeleting ? <Spinner size="small" /> : <Trash2 size={14} />}
              backgroundColor="$red9"
              color="white"
              hoverStyle={{ backgroundColor: '$red10' }}
              onPress={(e: any) => {
                e.stopPropagation()
                onDelete()
              }}
              disabled={isDeleting}
              borderRadius="$2"
            />
          ) : null}
          {onPress ? <ChevronRight size={20} color="$gray10" /> : null}
        </XStack>
      </XStack>
    </Card>
  )
}
