import React from 'react'
import { View, Text } from 'tamagui'
import { Button } from '../Button'
import { Bell } from '@tamagui/lucide-icons'

interface NotificationBellProps {
  unreadCount: number
  onPress: () => void
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  unreadCount,
  onPress,
}) => {
  return (
    <Button
      size="$3"
      circular
      icon={Bell}
      onPress={onPress}
      backgroundColor="transparent"
      position="relative"
    >
      {unreadCount > 0 ? (
        <View
          position="absolute"
          top={-2}
          right={-2}
          backgroundColor="$red10"
          borderRadius={999}
          minWidth={18}
          height={18}
          alignItems="center"
          justifyContent="center"
          paddingHorizontal="$1"
        >
          <Text color="white" fontSize={10} fontWeight="bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      ) : null}
    </Button>
  )
}
