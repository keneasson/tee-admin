import React, { useState } from 'react'
import { YStack, XStack, Text, Card, Spinner, View } from 'tamagui'
import { Button } from '../Button'
import {
  Bell,
  Share2,
  UserPlus,
  FileEdit,
  Award,
  Info,
  Check,
  CheckCheck,
  Trash2,
} from '@tamagui/lucide-icons'
import type { NotificationType, NotificationStatus } from '@my/app/provider/dynamodb/types'

export interface NotificationItem {
  notificationId: string
  type: NotificationType
  status: NotificationStatus
  title: string
  body: string
  actionUrl?: string
  sourceId?: string
  sourceType?: string
  senderEmail?: string
  createdAt: string
  readAt?: string
}

interface NotificationListProps {
  notifications: NotificationItem[]
  onMarkRead?: (notificationId: string) => Promise<void>
  onMarkAllRead?: () => Promise<void>
  onDelete?: (notificationId: string) => Promise<void>
  onNavigate?: (url: string) => void
}

const typeIcons: Record<NotificationType, React.ElementType> = {
  event_shared: Share2,
  contact_request: UserPlus,
  edit_request: FileEdit,
  rb_nomination: Award,
  system: Info,
}

const typeLabels: Record<NotificationType, string> = {
  event_shared: 'Event Shared',
  contact_request: 'Contact Request',
  edit_request: 'Edit Request',
  rb_nomination: 'RB Nomination',
  system: 'System',
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete,
  onNavigate,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const unreadCount = notifications.filter((n) => n.status === 'unread').length

  const handleMarkRead = async (notificationId: string) => {
    if (!onMarkRead) return
    setLoadingId(notificationId)
    try {
      await onMarkRead(notificationId)
    } finally {
      setLoadingId(null)
    }
  }

  const handleMarkAllRead = async () => {
    if (!onMarkAllRead) return
    setMarkingAll(true)
    try {
      await onMarkAllRead()
    } finally {
      setMarkingAll(false)
    }
  }

  const handleDelete = async (notificationId: string) => {
    if (!onDelete) return
    setLoadingId(notificationId)
    try {
      await onDelete(notificationId)
    } finally {
      setLoadingId(null)
    }
  }

  const handleNotificationClick = (notification: NotificationItem) => {
    if (notification.status === 'unread' && onMarkRead) {
      onMarkRead(notification.notificationId)
    }
    if (notification.actionUrl && onNavigate) {
      onNavigate(notification.actionUrl)
    }
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Bell size={20} />
          <Text fontSize="$5" fontWeight="600">
            Notifications
          </Text>
          {unreadCount > 0 ? (
            <View
              backgroundColor="$red10"
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$10"
            >
              <Text color="white" fontSize="$1" fontWeight="bold">
                {unreadCount}
              </Text>
            </View>
          ) : null}
        </XStack>
        {unreadCount > 0 && onMarkAllRead ? (
          <Button
            size="$2"
            icon={markingAll ? <Spinner size="small" width={16} height={16} /> : CheckCheck}
            onPress={handleMarkAllRead}
            disabled={markingAll}
          >
            Mark all read
          </Button>
        ) : null}
      </XStack>

      {notifications.length === 0 ? (
        <Card padding="$4" backgroundColor="$backgroundHover">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No notifications yet.
          </Text>
        </Card>
      ) : null}

      {notifications.map((notification) => {
        const Icon = typeIcons[notification.type] || Info
        const isUnread = notification.status === 'unread'

        return (
          <Card
            key={notification.notificationId}
            padding="$3"
            backgroundColor={isUnread ? '$blue2' : '$backgroundHover'}
            borderLeftWidth={4}
            borderLeftColor={isUnread ? '$blue10' : '$borderColor'}
            pressStyle={{ opacity: 0.8 }}
            onPress={() => handleNotificationClick(notification)}
            cursor="pointer"
          >
            <YStack gap="$2">
              <XStack justifyContent="space-between" alignItems="flex-start">
                <XStack gap="$2" alignItems="center" flex={1}>
                  <Icon size={16} />
                  <YStack flex={1} gap="$1">
                    <Text
                      fontSize="$4"
                      fontWeight={isUnread ? '600' : '400'}
                    >
                      {notification.title}
                    </Text>
                    <Text fontSize="$3" theme="alt2">
                      {notification.body}
                    </Text>
                  </YStack>
                </XStack>
                <YStack alignItems="flex-end" gap="$1">
                  <Text fontSize="$1" theme="alt2">
                    {typeLabels[notification.type]}
                  </Text>
                  <Text fontSize="$1" theme="alt2">
                    {formatRelativeTime(notification.createdAt)}
                  </Text>
                </YStack>
              </XStack>

              <XStack gap="$2" justifyContent="flex-end">
                {isUnread && onMarkRead ? (
                  <Button
                    size="$2"
                    icon={
                      loadingId === notification.notificationId ? (
                        <Spinner size="small" width={16} height={16} />
                      ) : (
                        Check
                      )
                    }
                    onPress={(e: any) => {
                      e.stopPropagation?.()
                      handleMarkRead(notification.notificationId)
                    }}
                    disabled={loadingId === notification.notificationId}
                  >
                    Mark read
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button
                    size="$2"
                    icon={
                      loadingId === notification.notificationId ? (
                        <Spinner size="small" width={16} height={16} />
                      ) : (
                        Trash2
                      )
                    }
                    onPress={(e: any) => {
                      e.stopPropagation?.()
                      handleDelete(notification.notificationId)
                    }}
                    disabled={loadingId === notification.notificationId}
                  >
                    Delete
                  </Button>
                ) : null}
              </XStack>
            </YStack>
          </Card>
        )
      })}
    </YStack>
  )
}
