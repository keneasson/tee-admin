import React, { useState } from 'react'
import { YStack, XStack, Text, Button, Card, TextArea, Input, Spinner, Sheet, Label, ScrollView } from 'tamagui'
import { Edit3, X, User, Phone, MapPin, Mail } from '@tamagui/lucide-icons'
import type { EditRequestField } from '@my/app/provider/dynamodb/types'

type PhoneType = 'mobile' | 'home' | 'work' | 'other'

const phoneTypeLabels: Record<PhoneType, string> = {
  mobile: 'Mobile',
  home: 'Home',
  work: 'Work',
  other: 'Other',
}

// Format 10 digits as xxx-xxx-xxxx
function formatPhoneNumber(digits: string): string {
  const cleaned = digits.replace(/\D/g, '').slice(0, 10)
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
}

// Extract just digits from formatted number
function extractDigits(formatted: string): string {
  return formatted.replace(/\D/g, '').slice(0, 10)
}

interface SuggestEditButtonProps {
  targetEmail: string
  targetName?: string
  field: EditRequestField
  currentValue?: string
  onRequest: (suggestedValue: string, message?: string) => Promise<void>
  disabled?: boolean
  /** Show as icon only (smaller button) */
  iconOnly?: boolean
}

const fieldLabels: Record<EditRequestField, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  address: 'Address',
}

const fieldIcons: Record<EditRequestField, React.ReactNode> = {
  name: <User size={16} />,
  email: <Mail size={16} />,
  phone: <Phone size={16} />,
  address: <MapPin size={16} />,
}

const fieldPlaceholders: Record<EditRequestField, string> = {
  name: 'Enter the new name...',
  email: 'Enter the new email...',
  phone: 'Enter the new phone number...',
  address: 'Enter the new address...',
}

export const SuggestEditButton: React.FC<SuggestEditButtonProps> = ({
  targetEmail,
  targetName,
  field,
  currentValue,
  onRequest,
  disabled = false,
  iconOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [suggestedValue, setSuggestedValue] = useState(currentValue || '')
  const [phoneType, setPhoneType] = useState<PhoneType>('mobile')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRequest = async () => {
    // For phone field, construct the value from type + number
    const valueToSubmit = field === 'phone'
      ? `${phoneTypeLabels[phoneType]}: ${formatPhoneNumber(phoneNumber)}`
      : suggestedValue.trim()

    if (field === 'phone') {
      if (phoneNumber.length !== 10) {
        setError('Please enter all 10 digits')
        return
      }
    } else if (!valueToSubmit) {
      setError('Please enter a new value')
      return
    }

    // Don't allow submitting unchanged value (skip for phone since format is different)
    if (field !== 'phone' && valueToSubmit === currentValue) {
      setError('The new value is the same as the current value')
      return
    }

    setError(null)
    setLoading(true)
    try {
      await onRequest(valueToSubmit, message || undefined)
      setSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
        setSuccess(false)
        setSuggestedValue('')
        setPhoneType('mobile')
        setPhoneNumber('')
        setMessage('')
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send request')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setError(null)
    setSuggestedValue(currentValue || '')
    setPhoneType('mobile')
    setPhoneNumber('')
    setMessage('')
  }

  const displayName = targetName || targetEmail

  const handleButtonPress = (e: { stopPropagation?: () => void }) => {
    // Stop event bubbling to parent Card
    e.stopPropagation?.()
    setIsOpen(true)
  }

  return (
    <>
      {iconOnly ? (
        <Button
          size="$2"
          circular
          icon={Edit3}
          disabled={disabled}
          onPress={handleButtonPress}
          theme="gray"
        />
      ) : (
        <Button
          size="$2"
          icon={Edit3}
          disabled={disabled}
          onPress={handleButtonPress}
          theme="gray"
        >
          Suggest Edit
        </Button>
      )}

      <Sheet
        modal
        open={isOpen}
        onOpenChange={(open: boolean) => {
          if (!open) handleClose()
          else setIsOpen(true)
        }}
        snapPoints={[85]}
        dismissOnSnapToBottom
        zIndex={100000}
      >
        <Sheet.Overlay />
        <Sheet.Frame padding="$4">
          <Sheet.Handle />
          <ScrollView>
            <YStack gap="$4" paddingTop="$2" paddingBottom="$4">
              <YStack>
                <XStack gap="$2" alignItems="center">
                  {fieldIcons[field]}
                  <Text fontSize="$6" fontWeight="600">Update {fieldLabels[field]}</Text>
                </XStack>
                <Text fontSize="$3" theme="alt2">
                  Submit a new {fieldLabels[field].toLowerCase()} for {displayName}.
                </Text>
              </YStack>

              {success ? (
                <Card padding="$4" backgroundColor="$green2">
                  <YStack alignItems="center" gap="$2">
                    <Text fontSize="$5" color="$green10">Request Sent!</Text>
                    <Text fontSize="$3" theme="alt2" textAlign="center">
                      {displayName} will receive an email to review your update request.
                    </Text>
                  </YStack>
                </Card>
              ) : (
                <YStack gap="$4">
                  {/* Current value display */}
                  {currentValue ? (
                    <YStack gap="$1">
                      <Label fontSize="$3" fontWeight="600">Current value</Label>
                      <Card padding="$3" backgroundColor="$backgroundHover">
                        <Text fontSize="$3" theme="alt2">{currentValue}</Text>
                      </Card>
                    </YStack>
                  ) : null}

                  {/* New value input */}
                  <YStack gap="$1">
                    <Label fontSize="$3" fontWeight="600">New value</Label>
                    {field === 'phone' ? (
                      <YStack gap="$2">
                        <XStack gap="$2" flexWrap="wrap" alignItems="center">
                          <XStack gap="$2" alignItems="center">
                            <Text fontSize="$3">Type:</Text>
                            {(['mobile', 'home', 'work', 'other'] as PhoneType[]).map((type) => (
                              <Button
                                key={type}
                                size="$2"
                                theme={phoneType === type ? 'blue' : undefined}
                                onPress={() => setPhoneType(type)}
                              >
                                {phoneTypeLabels[type]}
                              </Button>
                            ))}
                          </XStack>
                        </XStack>
                        <Input
                          placeholder="xxx-xxx-xxxx"
                          value={formatPhoneNumber(phoneNumber)}
                          onChangeText={(value: string) => setPhoneNumber(extractDigits(value))}
                          keyboardType="phone-pad"
                          maxLength={12}
                        />
                        {phoneNumber.length > 0 && phoneNumber.length < 10 && (
                          <Text fontSize="$2" color="$red10">
                            Enter all 10 digits
                          </Text>
                        )}
                      </YStack>
                    ) : field === 'address' ? (
                      <TextArea
                        placeholder={fieldPlaceholders[field]}
                        value={suggestedValue}
                        onChangeText={setSuggestedValue}
                        numberOfLines={3}
                      />
                    ) : (
                      <Input
                        placeholder={fieldPlaceholders[field]}
                        value={suggestedValue}
                        onChangeText={setSuggestedValue}
                        keyboardType={field === 'email' ? 'email-address' : 'default'}
                        autoCapitalize={field === 'email' ? 'none' : field === 'name' ? 'words' : 'sentences'}
                      />
                    )}
                  </YStack>

                  {/* Optional message */}
                  <YStack gap="$1">
                    <Label fontSize="$3" fontWeight="600">Note (optional)</Label>
                    <TextArea
                      placeholder="Add context about this correction..."
                      value={message}
                      onChangeText={setMessage}
                      numberOfLines={2}
                    />
                  </YStack>

                  {/* Error display */}
                  {error ? (
                    <Card padding="$3" backgroundColor="$red2">
                      <Text fontSize="$3" color="$red10">{error}</Text>
                    </Card>
                  ) : null}

                  {/* Email warning */}
                  {field === 'email' ? (
                    <Card padding="$3" backgroundColor="$yellow2">
                      <Text fontSize="$3" color="$yellow11">
                        Email changes require additional verification by the profile owner.
                      </Text>
                    </Card>
                  ) : null}

                  {/* Action buttons */}
                  <XStack gap="$2" justifyContent="flex-end">
                    <Button size="$3" icon={X} onPress={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      size="$3"
                      theme="blue"
                      onPress={handleRequest}
                      disabled={loading || (field === 'phone' ? phoneNumber.length !== 10 : !suggestedValue.trim())}
                      icon={loading ? <Spinner /> : undefined}
                    >
                      {loading ? 'Sending...' : 'Continue'}
                    </Button>
                  </XStack>
                </YStack>
              )}
            </YStack>
          </ScrollView>
        </Sheet.Frame>
      </Sheet>
    </>
  )
}
