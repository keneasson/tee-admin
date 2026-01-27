import React, { useState } from 'react'
import { YStack, XStack, Text, Button, Card, TextArea, Spinner, Sheet } from 'tamagui'
import { Phone, Mail, MessageSquare, X, Send } from '@tamagui/lucide-icons'
import type { ContactRequestType } from '@my/app/provider/dynamodb/types'

interface ContactRequestButtonProps {
  recipientEmail: string
  recipientName?: string
  allowedTypes?: ContactRequestType[]
  onRequest: (type: ContactRequestType, message?: string) => Promise<void>
  disabled?: boolean
}

export const ContactRequestButton: React.FC<ContactRequestButtonProps> = ({
  recipientEmail,
  recipientName,
  allowedTypes = ['callback', 'email_me'],
  onRequest,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ContactRequestType | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleRequest = async () => {
    if (!selectedType) return
    setLoading(true)
    try {
      await onRequest(selectedType, message || undefined)
      setSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        setSuccess(false)
        setSelectedType(null)
        setMessage('')
      }, 2000)
    } finally {
      setLoading(false)
    }
  }

  const displayName = recipientName || recipientEmail

  return (
    <>
      <Button
        size="$3"
        theme="blue"
        icon={MessageSquare}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
      >
        Request Contact
      </Button>

      <Sheet
        modal
        open={isOpen}
        onOpenChange={setIsOpen}
        snapPoints={[50]}
        position={0}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay />
        <Sheet.Frame padding="$4">
          <Sheet.Handle />
          <YStack gap="$4" paddingTop="$4">
            <YStack>
              <Text fontSize="$6" fontWeight="600">Request Contact</Text>
              <Text fontSize="$3" theme="alt2">
                Ask {displayName} to get in touch with you.
              </Text>
            </YStack>

            {success ? (
              <Card padding="$4" backgroundColor="$green2">
                <YStack alignItems="center" gap="$2">
                  <Text fontSize="$5" color="$green10">Request Sent!</Text>
                  <Text fontSize="$3" theme="alt2" textAlign="center">
                    {displayName} will be notified of your request.
                  </Text>
                </YStack>
              </Card>
            ) : (
              <YStack gap="$4">
                <YStack gap="$2">
                  <Text fontSize="$3" fontWeight="600">How would you like them to contact you?</Text>
                  <XStack gap="$2" flexWrap="wrap">
                    {allowedTypes.includes('callback') ? (
                      <Button
                        size="$3"
                        icon={Phone}
                        theme={selectedType === 'callback' ? 'blue' : undefined}
                        onPress={() => setSelectedType('callback')}
                      >
                        Call Me Back
                      </Button>
                    ) : null}
                    {allowedTypes.includes('email_me') ? (
                      <Button
                        size="$3"
                        icon={Mail}
                        theme={selectedType === 'email_me' ? 'blue' : undefined}
                        onPress={() => setSelectedType('email_me')}
                      >
                        Email Me
                      </Button>
                    ) : null}
                  </XStack>
                </YStack>

                <YStack gap="$2">
                  <Text fontSize="$3" fontWeight="600">Add a message (optional)</Text>
                  <TextArea
                    placeholder="Let them know what you'd like to discuss..."
                    value={message}
                    onChangeText={setMessage}
                    numberOfLines={3}
                  />
                </YStack>

                <XStack gap="$2" justifyContent="flex-end">
                  <Button size="$3" icon={X} onPress={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="$3"
                    theme="blue"
                    onPress={handleRequest}
                    disabled={!selectedType || loading}
                    icon={loading ? <Spinner /> : Send}
                  >
                    Send Request
                  </Button>
                </XStack>
              </YStack>
            )}
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  )
}
