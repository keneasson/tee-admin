import React, { useState } from 'react'
import { YStack, XStack, Text, Button, Card, Spinner, View } from 'tamagui'
import { Phone, Mail, Check, X, Eye, Trash2, Bell } from '@tamagui/lucide-icons'
import type { ContactRequestType, ContactRequestStatus } from '@my/app/provider/dynamodb/types'

interface ContactRequest {
  requestId: string
  requesterEmail: string
  requesterName?: string
  requestType: ContactRequestType
  message?: string
  status: ContactRequestStatus
  createdAt: string
}

interface ContactRequestsListProps {
  requests: ContactRequest[]
  onMarkViewed?: (requestId: string) => Promise<void>
  onRespond?: (requestId: string) => Promise<void>
  onDecline?: (requestId: string) => Promise<void>
  onDelete?: (requestId: string) => Promise<void>
}

const statusLabels: Record<ContactRequestStatus, string> = {
  pending: 'New',
  viewed: 'Viewed',
  responded: 'Responded',
  declined: 'Declined',
}

const statusColors: Record<ContactRequestStatus, string> = {
  pending: '$blue10',
  viewed: '$yellow10',
  responded: '$green10',
  declined: '$red10',
}

export const ContactRequestsList: React.FC<ContactRequestsListProps> = ({
  requests,
  onMarkViewed,
  onRespond,
  onDecline,
  onDelete,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleAction = async (
    requestId: string,
    action: (id: string) => Promise<void> | undefined
  ) => {
    if (!action) return
    setLoadingId(requestId)
    try {
      await action(requestId)
    } finally {
      setLoadingId(null)
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length

  // Sort: pending first, then by date
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Bell size={20} />
          <Text fontSize="$5" fontWeight="600">Contact Requests</Text>
          {pendingCount > 0 ? (
            <View
              backgroundColor="$red10"
              paddingHorizontal="$2"
              paddingVertical="$1"
              borderRadius="$10"
            >
              <Text color="white" fontSize="$1" fontWeight="bold">
                {pendingCount}
              </Text>
            </View>
          ) : null}
        </XStack>
      </XStack>

      {requests.length === 0 ? (
        <Card padding="$4" backgroundColor="$backgroundHover">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No contact requests yet.
          </Text>
        </Card>
      ) : null}

      {sortedRequests.map((request) => (
        <Card
          key={request.requestId}
          padding="$3"
          backgroundColor={request.status === 'pending' ? '$blue2' : '$backgroundHover'}
          borderLeftWidth={4}
          borderLeftColor={statusColors[request.status]}
        >
          <YStack gap="$2">
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack gap="$1" flex={1}>
                <XStack gap="$2" alignItems="center">
                  {request.requestType === 'callback' ? (
                    <Phone size={16} />
                  ) : (
                    <Mail size={16} />
                  )}
                  <Text fontSize="$4" fontWeight="500">
                    {request.requesterName || request.requesterEmail}
                  </Text>
                </XStack>
                {request.requesterName ? (
                  <Text fontSize="$2" theme="alt2">{request.requesterEmail}</Text>
                ) : null}
                <Text fontSize="$2" theme="alt2">
                  Wants you to {request.requestType === 'callback' ? 'call them back' : 'email them'}
                </Text>
              </YStack>
              <YStack alignItems="flex-end" gap="$1">
                <Text fontSize="$2" color={statusColors[request.status]} fontWeight="500">
                  {statusLabels[request.status]}
                </Text>
                <Text fontSize="$1" theme="alt2">
                  {new Date(request.createdAt).toLocaleDateString()}
                </Text>
              </YStack>
            </XStack>

            {request.message ? (
              <Card padding="$2" backgroundColor="$background">
                <Text fontSize="$3" fontStyle="italic">"{request.message}"</Text>
              </Card>
            ) : null}

            {request.status === 'pending' || request.status === 'viewed' ? (
              <XStack gap="$2" justifyContent="flex-end" marginTop="$2">
                {request.status === 'pending' && onMarkViewed ? (
                  <Button
                    size="$2"
                    icon={loadingId === request.requestId ? <Spinner /> : Eye}
                    onPress={() => handleAction(request.requestId, onMarkViewed)}
                    disabled={loadingId === request.requestId}
                  >
                    Mark Viewed
                  </Button>
                ) : null}
                {onDecline ? (
                  <Button
                    size="$2"
                    theme="red"
                    icon={loadingId === request.requestId ? <Spinner /> : X}
                    onPress={() => handleAction(request.requestId, onDecline)}
                    disabled={loadingId === request.requestId}
                  >
                    Decline
                  </Button>
                ) : null}
                {onRespond ? (
                  <Button
                    size="$2"
                    theme="green"
                    icon={loadingId === request.requestId ? <Spinner /> : Check}
                    onPress={() => handleAction(request.requestId, onRespond)}
                    disabled={loadingId === request.requestId}
                  >
                    Mark Responded
                  </Button>
                ) : null}
              </XStack>
            ) : null}

            {(request.status === 'responded' || request.status === 'declined') && onDelete ? (
              <XStack justifyContent="flex-end" marginTop="$2">
                <Button
                  size="$2"
                  icon={loadingId === request.requestId ? <Spinner /> : Trash2}
                  onPress={() => handleAction(request.requestId, onDelete)}
                  disabled={loadingId === request.requestId}
                >
                  Delete
                </Button>
              </XStack>
            ) : null}
          </YStack>
        </Card>
      ))}
    </YStack>
  )
}
