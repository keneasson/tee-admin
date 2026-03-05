import React, { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Spinner, Separator } from 'tamagui'
import { Button } from '../Button'
import { Plus, Trash2, UserPlus, UserX, Link2 } from '@tamagui/lucide-icons'

interface Connection {
  targetEmail: string
  status: 'active' | 'pending' | 'blocked'
  createdAt: string
}

interface ConnectionsListProps {
  connections: Connection[]
  blockedUsers: string[]
  editable?: boolean
  onAdd?: (targetEmail: string) => Promise<void>
  onRemove?: (targetEmail: string) => Promise<void>
  onBlock?: (targetEmail: string) => Promise<void>
  onUnblock?: (targetEmail: string) => Promise<void>
}

export const ConnectionsList: React.FC<ConnectionsListProps> = ({
  connections,
  blockedUsers,
  editable = false,
  onAdd,
  onRemove,
  onBlock,
  onUnblock,
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!onAdd || !newEmail) return
    setLoading(true)
    try {
      await onAdd(newEmail)
      setNewEmail('')
      setIsAdding(false)
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (email: string) => {
    if (!onRemove) return
    setLoading(true)
    try {
      await onRemove(email)
    } finally {
      setLoading(false)
    }
  }

  const handleBlock = async (email: string) => {
    if (!onBlock) return
    setLoading(true)
    try {
      await onBlock(email)
    } finally {
      setLoading(false)
    }
  }

  const handleUnblock = async (email: string) => {
    if (!onUnblock) return
    setLoading(true)
    try {
      await onUnblock(email)
    } finally {
      setLoading(false)
    }
  }

  const activeConnections = connections.filter(c => c.status === 'active')

  return (
    <YStack gap="$4">
      {/* Connections Section */}
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <YStack>
            <Text fontSize="$5" fontWeight="600">Connections</Text>
            <Text fontSize="$2" theme="alt2">
              People you share your contact info with
            </Text>
          </YStack>
          {editable && !isAdding ? (
            <Button size="$2" icon={UserPlus} onPress={() => setIsAdding(true)}>
              Add
            </Button>
          ) : null}
        </XStack>

        {isAdding ? (
          <Card padding="$3" backgroundColor="$background">
            <YStack gap="$2">
              <Input
                placeholder="Email address to share your info with"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text fontSize="$2" theme="alt2">
                This person will be able to see your contact details based on your privacy settings.
              </Text>
              <XStack gap="$2" justifyContent="flex-end">
                <Button
                  size="$2"
                  onPress={() => { setIsAdding(false); setNewEmail('') }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  size="$2"
                  theme="blue"
                  onPress={handleAdd}
                  disabled={loading || !newEmail}
                  icon={loading ? <Spinner /> : Link2}
                >
                  Connect
                </Button>
              </XStack>
            </YStack>
          </Card>
        ) : null}

        {activeConnections.length === 0 && !isAdding ? (
          <Text fontSize="$3" theme="alt2">
            You haven't connected with anyone yet. Add a connection to share your contact info.
          </Text>
        ) : null}

        {activeConnections.map((connection) => (
          <Card key={connection.targetEmail} padding="$3" backgroundColor="$backgroundHover">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack>
                <Text fontSize="$4" fontWeight="500">{connection.targetEmail}</Text>
                <Text fontSize="$2" theme="alt2">
                  Connected {new Date(connection.createdAt).toLocaleDateString()}
                </Text>
              </YStack>
              {editable ? (
                <XStack gap="$2">
                  <Button
                    size="$2"
                    circular
                    icon={Trash2}
                    onPress={() => handleRemove(connection.targetEmail)}
                  />
                  <Button
                    size="$2"
                    circular
                    icon={UserX}
                    theme="red"
                    onPress={() => handleBlock(connection.targetEmail)}
                  />
                </XStack>
              ) : null}
            </XStack>
          </Card>
        ))}
      </YStack>

      {/* Blocked Users Section */}
      {editable && blockedUsers.length > 0 ? (
        <>
          <Separator />
          <YStack gap="$3">
            <YStack>
              <Text fontSize="$5" fontWeight="600">Blocked Users</Text>
              <Text fontSize="$2" theme="alt2">
                These users cannot request contact from you
              </Text>
            </YStack>

            {blockedUsers.map((email) => (
              <Card key={email} padding="$3" backgroundColor="$red2">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$4">{email}</Text>
                  <Button
                    size="$2"
                    onPress={() => handleUnblock(email)}
                    disabled={loading}
                  >
                    Unblock
                  </Button>
                </XStack>
              </Card>
            ))}
          </YStack>
        </>
      ) : null}
    </YStack>
  )
}
