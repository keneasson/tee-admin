import React, { useState } from 'react'
import { XStack, Text, Spinner } from 'tamagui'
import { Button } from '../Button'
import { UserPlus, Clock, Check, UserCheck, UserX } from '@tamagui/lucide-icons'

type ConnectionStatusType = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'self'

interface ConnectButtonProps {
  targetEmail: string
  targetName?: string
  connectionStatus: ConnectionStatusType
  needsConnection: boolean
  onConnect: () => Promise<void>
  onAccept: () => Promise<void>
  onDecline: () => Promise<void>
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({
  targetEmail,
  targetName,
  connectionStatus,
  needsConnection,
  onConnect,
  onAccept,
  onDecline,
}) => {
  const [loading, setLoading] = useState(false)
  const [localStatus, setLocalStatus] = useState<ConnectionStatusType>(connectionStatus)

  const handleConnect = async () => {
    setLoading(true)
    try {
      await onConnect()
      setLocalStatus('pending_sent')
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    setLoading(true)
    try {
      await onAccept()
      setLocalStatus('connected')
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = async () => {
    setLoading(true)
    try {
      await onDecline()
      setLocalStatus('none')
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  // Hide if not needed and no active connection state
  if (localStatus === 'none' && !needsConnection) {
    return null
  }

  if (localStatus === 'self') {
    return null
  }

  // IMPORTANT: Never put <Spinner> as a child of <Button> — Tamagui will render
  // it at full container size (200px+). Always use the `icon` prop instead.
  if (loading) {
    return (
      <Button size="$3" disabled icon={<Spinner size="small" />}>
        Loading...
      </Button>
    )
  }

  // Connected state
  if (localStatus === 'connected') {
    return (
      <Button
        size="$3"
        theme="green"
        icon={Check}
        disabled
        opacity={0.7}
      >
        Connected
      </Button>
    )
  }

  // Pending sent state
  if (localStatus === 'pending_sent') {
    return (
      <Button
        size="$3"
        icon={Clock}
        disabled
        opacity={0.7}
      >
        Request Sent
      </Button>
    )
  }

  // Pending received state — show Accept and Decline
  if (localStatus === 'pending_received') {
    return (
      <XStack gap="$2">
        <Button
          size="$3"
          theme="green"
          icon={UserCheck}
          onPress={handleAccept}
        >
          Accept
        </Button>
        <Button
          size="$3"
          theme="red"
          icon={UserX}
          onPress={handleDecline}
        >
          Decline
        </Button>
      </XStack>
    )
  }

  // Default: show Connect button
  return (
    <Button
      size="$3"
      theme="blue"
      icon={UserPlus}
      onPress={handleConnect}
    >
      Connect
    </Button>
  )
}
