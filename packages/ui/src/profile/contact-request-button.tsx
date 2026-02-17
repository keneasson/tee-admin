import React, { useState } from 'react'
import {
  YStack,
  XStack,
  Text,
  Button,
  Card,
  Spinner,
  Dialog,
  Adapt,
  Sheet,
  Unspaced,
  Input,
} from 'tamagui'
import { Phone, Mail, MessageSquare, X, Send, Clock, Calendar } from '@tamagui/lucide-icons'
import type { ContactRequestType, ContactRequestReason } from '@my/app/provider/dynamodb/types'

interface RequesterPhone {
  type: string
  number: string
}

interface ContactRequestButtonProps {
  recipientEmail: string
  recipientName?: string
  allowedTypes?: ContactRequestType[]
  onRequest: (type: ContactRequestType, message?: string, reason?: ContactRequestReason) => Promise<void>
  disabled?: boolean
  requesterPhones?: RequesterPhone[]
}

function formatPhone(digits: string): string {
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits
}

const TIME_OPTIONS = ['Morning', 'Afternoon', 'Evening'] as const
const DAY_OPTIONS = ['Weekdays', 'Weekends'] as const

export const ContactRequestButton: React.FC<ContactRequestButtonProps> = ({
  recipientName,
  allowedTypes = ['phone', 'email', 'text'],
  onRequest,
  disabled = false,
  requesterPhones,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<ContactRequestType | null>(null)
  const [selectedReason, setSelectedReason] = useState<ContactRequestReason | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Call Me sub-section state
  const [selectedPhoneIndex, setSelectedPhoneIndex] = useState(0)
  const [selectedTimes, setSelectedTimes] = useState<Set<string>>(new Set())
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())
  const [customTime, setCustomTime] = useState('')
  const [timeWarning, setTimeWarning] = useState<string | null>(null)

  const phones = requesterPhones ?? []
  const hasPhones = phones.length > 0

  const resetState = () => {
    setSelectedType(null)
    setSelectedReason(null)
    setSelectedPhoneIndex(0)
    setSelectedTimes(new Set())
    setSelectedDays(new Set())
    setCustomTime('')
    setTimeWarning(null)
    setError(null)
    setSuccess(false)
  }

  const toggleChip = (set: Set<string>, value: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const next = new Set(set)
    if (next.has(value)) {
      next.delete(value)
    } else {
      next.add(value)
    }
    setter(next)
  }

  const validateCustomTime = (input: string) => {
    setCustomTime(input)
    if (!input.trim()) {
      setTimeWarning(null)
      return
    }
    try {
      const d = new Date(`2026-01-01 ${input.trim()}`)
      if (isNaN(d.getTime())) {
        setTimeWarning("Couldn't understand this as a time")
      } else {
        setTimeWarning(null)
      }
    } catch {
      setTimeWarning("Couldn't understand this as a time")
    }
  }

  const buildCallMeMessage = (): string => {
    const phone = phones[selectedPhoneIndex]
    if (!phone) return ''

    const parts: string[] = []
    parts.push(`Call ${formatPhone(phone.number)} (${phone.type})`)

    const availability: string[] = []
    selectedTimes.forEach(t => availability.push(t))
    selectedDays.forEach(d => availability.push(d))
    if (availability.length > 0) {
      parts.push(`Available: ${availability.join(', ')}`)
    }

    if (customTime.trim()) {
      parts.push(`Note: ${customTime.trim()}`)
    }

    return parts.join('. ')
  }

  const handleRequest = async () => {
    if (!selectedType) return
    setLoading(true)
    setError(null)
    try {
      const message = selectedType === 'phone' && hasPhones ? buildCallMeMessage() : undefined
      await onRequest(selectedType, message, selectedReason || undefined)
      setSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        resetState()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setLoading(false)
    }
  }

  const displayName = recipientName || 'this member'

  const canSubmit = selectedType !== null &&
    (selectedType !== 'phone' || hasPhones)

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

      <Dialog
        modal
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open)
          if (!open) resetState()
        }}
      >
        <Adapt when="sm" platform="touch">
          <Sheet animation="quick" zIndex={200000} modal dismissOnSnapToBottom>
            <Sheet.Frame padding="$4" gap="$4">
              <Adapt.Contents />
            </Sheet.Frame>
            <Sheet.Overlay
              animation="lazy"
              enterStyle={{ opacity: 0 }}
              exitStyle={{ opacity: 0 }}
            />
          </Sheet>
        </Adapt>

        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="lazy"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            bordered
            elevate
            key="content"
            animateOnly={['transform', 'opacity']}
            animation="quick"
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
            width={480}
            maxWidth="90vw"
            padding="$4"
          >
            <Unspaced>
              <Dialog.Close asChild>
                <Button
                  position="absolute"
                  top="$3"
                  right="$3"
                  size="$2"
                  circular
                  icon={X}
                />
              </Dialog.Close>
            </Unspaced>

            <Dialog.Title>Request Contact</Dialog.Title>
            <Dialog.Description>
              Ask {displayName} to get in touch with you.
            </Dialog.Description>

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
                {error ? (
                  <Card padding="$3" backgroundColor="$red2">
                    <Text fontSize="$3" color="$red10">{error}</Text>
                  </Card>
                ) : null}

                {/* Contact type selector */}
                <YStack gap="$2">
                  <Text fontSize="$3" fontWeight="600">How would you like them to contact you?</Text>
                  <XStack gap="$2" flexWrap="wrap">
                    {allowedTypes.includes('phone') ? (
                      <Button
                        size="$3"
                        icon={Phone}
                        theme={selectedType === 'phone' ? 'blue' : undefined}
                        onPress={() => setSelectedType('phone')}
                      >
                        Call Me
                      </Button>
                    ) : null}
                    {allowedTypes.includes('email') ? (
                      <Button
                        size="$3"
                        icon={Mail}
                        theme={selectedType === 'email' ? 'blue' : undefined}
                        onPress={() => setSelectedType('email')}
                      >
                        Email Me
                      </Button>
                    ) : null}
                    {allowedTypes.includes('text') ? (
                      <Button
                        size="$3"
                        icon={MessageSquare}
                        theme={selectedType === 'text' ? 'blue' : undefined}
                        onPress={() => setSelectedType('text')}
                      >
                        Text Me
                      </Button>
                    ) : null}
                  </XStack>
                </YStack>

                {/* Call Me sub-section */}
                {selectedType === 'phone' ? (
                  <YStack gap="$3" padding="$3" backgroundColor="$backgroundHover" borderRadius="$3">
                    {!hasPhones ? (
                      <Card padding="$3" backgroundColor="$yellow2" borderColor="$yellow6" borderWidth={1}>
                        <YStack gap="$2">
                          <Text fontSize="$3" fontWeight="600" color="$yellow11">
                            No phone number on file
                          </Text>
                          <Text fontSize="$2" color="$yellow11">
                            You need to add a phone number to your profile before requesting a call back.
                          </Text>
                          <Button
                            size="$3"
                            theme="yellow"
                            onPress={() => {
                              setIsOpen(false)
                              resetState()
                              // Navigate handled by parent — link to /profile
                              window.location.href = '/profile'
                            }}
                          >
                            Go to Profile
                          </Button>
                        </YStack>
                      </Card>
                    ) : (
                      <>
                        {/* Phone selector */}
                        <YStack gap="$1">
                          <Text fontSize="$3" fontWeight="600">Your callback number</Text>
                          <XStack gap="$2" flexWrap="wrap">
                            {phones.map((phone, index) => (
                              <Button
                                key={`${phone.number}-${index}`}
                                size="$3"
                                theme={selectedPhoneIndex === index ? 'blue' : undefined}
                                onPress={() => setSelectedPhoneIndex(index)}
                              >
                                {formatPhone(phone.number)} ({phone.type})
                              </Button>
                            ))}
                          </XStack>
                        </YStack>

                        {/* Availability chips */}
                        <YStack gap="$2">
                          <Text fontSize="$3" fontWeight="600">When are you available?</Text>
                          <XStack gap="$2" flexWrap="wrap">
                            {TIME_OPTIONS.map(time => (
                              <Button
                                key={time}
                                size="$2"
                                icon={Clock}
                                theme={selectedTimes.has(time) ? 'blue' : undefined}
                                onPress={() => toggleChip(selectedTimes, time, setSelectedTimes)}
                              >
                                {time}
                              </Button>
                            ))}
                          </XStack>
                          <XStack gap="$2" flexWrap="wrap">
                            {DAY_OPTIONS.map(day => (
                              <Button
                                key={day}
                                size="$2"
                                icon={Calendar}
                                theme={selectedDays.has(day) ? 'blue' : undefined}
                                onPress={() => toggleChip(selectedDays, day, setSelectedDays)}
                              >
                                {day}
                              </Button>
                            ))}
                          </XStack>
                        </YStack>

                        {/* Custom time input */}
                        <YStack gap="$1">
                          <Text fontSize="$2" theme="alt2">Or specify a time</Text>
                          <Input
                            size="$3"
                            placeholder="e.g. After 9:00pm"
                            value={customTime}
                            onChangeText={validateCustomTime}
                          />
                          {timeWarning ? (
                            <Text fontSize="$2" color="$orange10">{timeWarning}</Text>
                          ) : null}
                        </YStack>
                      </>
                    )}
                  </YStack>
                ) : null}

                {/* Reason selector */}
                <YStack gap="$2">
                  <Text fontSize="$3" fontWeight="600">Reason for contact</Text>
                  <XStack gap="$2" flexWrap="wrap">
                    <Button
                      size="$3"
                      theme={selectedReason === 'personal' ? 'blue' : undefined}
                      onPress={() => setSelectedReason('personal')}
                    >
                      Personal
                    </Button>
                    <Button
                      size="$3"
                      theme={selectedReason === 'ecclesial' ? 'blue' : undefined}
                      onPress={() => setSelectedReason('ecclesial')}
                    >
                      Ecclesial
                    </Button>
                  </XStack>
                </YStack>

                <Text fontSize="$2" theme="alt2">
                  You can have up to 3 active requests at a time. Requests expire after 7 days.
                </Text>

                {/* Buttons — left-aligned */}
                <XStack gap="$2" justifyContent="flex-start">
                  <Button
                    size="$3"
                    icon={X}
                    onPress={() => {
                      setIsOpen(false)
                      resetState()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="$3"
                    theme="blue"
                    onPress={handleRequest}
                    disabled={!canSubmit || loading}
                    icon={loading ? <Spinner size="small" /> : Send}
                  >
                    Send Request
                  </Button>
                </XStack>
              </YStack>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  )
}
