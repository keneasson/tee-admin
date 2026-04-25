'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, Spinner, Text } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { NotificationList, type NotificationItem } from '@my/ui/src/notifications/notification-list'

export default function NotificationsPage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=100')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isHydrated) {
      fetchNotifications()
    }
  }, [isHydrated, fetchNotifications])

  const handleMarkRead = async (notificationId: string) => {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method: 'PATCH',
    })
    if (res.ok) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId
            ? { ...n, status: 'read' as const, readAt: new Date().toISOString() }
            : n
        )
      )
    }
  }

  const handleMarkAllRead = async () => {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' })
    if (res.ok) {
      const now = new Date().toISOString()
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: 'read' as const, readAt: n.readAt || now }))
      )
    }
  }

  const handleDelete = async (notificationId: string) => {
    const res = await fetch(`/api/notifications/${notificationId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setNotifications((prev) =>
        prev.filter((n) => n.notificationId !== notificationId)
      )
    }
  }

  const handleNavigate = (url: string) => {
    router.push(url)
  }

  if (!isHydrated) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
      </YStack>
    )
  }

  if (loading) {
    return (
      <YStack flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text theme="alt2" marginTop="$2">Loading notifications...</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" maxWidth={700}>
      <NotificationList
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onDelete={handleDelete}
        onNavigate={handleNavigate}
      />
    </YStack>
  )
}
