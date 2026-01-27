import React, { useState } from 'react'
import { YStack, XStack, Text, Button, Card, Input, Spinner } from 'tamagui'
import { Phone, Plus, Trash2, GripVertical, Check } from '@tamagui/lucide-icons'

export type PhoneType = 'mobile' | 'home' | 'work' | 'other'

export interface PhoneEntry {
  id: string
  type: PhoneType
  number: string // 10 digits only
  verified?: boolean
}

interface PhoneManagerProps {
  phones: PhoneEntry[]
  onChange: (phones: PhoneEntry[]) => void
  onSave?: () => Promise<void>
  saving?: boolean
  readOnly?: boolean
}

const phoneTypeLabels: Record<PhoneType, string> = {
  mobile: 'Mobile',
  home: 'Home',
  work: 'Work',
  other: 'Other',
}

// Format 10 digits as xxx-xxx-xxxx
export function formatPhoneNumber(digits: string): string {
  const cleaned = digits.replace(/\D/g, '').slice(0, 10)
  if (cleaned.length <= 3) return cleaned
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
}

// Extract just digits from formatted number
export function extractDigits(formatted: string): string {
  return formatted.replace(/\D/g, '').slice(0, 10)
}

// Generate a simple ID
function generateId(): string {
  return `phone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export const PhoneManager: React.FC<PhoneManagerProps> = ({
  phones,
  onChange,
  onSave,
  saving = false,
  readOnly = false,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleAddPhone = () => {
    const newPhone: PhoneEntry = {
      id: generateId(),
      type: 'mobile',
      number: '',
    }
    onChange([...phones, newPhone])
  }

  const handleRemovePhone = (id: string) => {
    onChange(phones.filter(p => p.id !== id))
  }

  const handleUpdatePhone = (id: string, updates: Partial<PhoneEntry>) => {
    onChange(phones.map(p => p.id === id ? { ...p, ...updates } : p))
  }

  const handleNumberChange = (id: string, value: string) => {
    // Extract digits and update
    const digits = extractDigits(value)
    handleUpdatePhone(id, { number: digits })
  }

  const movePhone = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= phones.length) return
    const newPhones = [...phones]
    const [moved] = newPhones.splice(fromIndex, 1)
    newPhones.splice(toIndex, 0, moved)
    onChange(newPhones)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      movePhone(draggedIndex, index)
      setDraggedIndex(index)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Phone size={20} />
          <Text fontSize="$4" fontWeight="600">Phone Numbers</Text>
        </XStack>
        {!readOnly && (
          <Button size="$2" icon={Plus} onPress={handleAddPhone}>
            Add
          </Button>
        )}
      </XStack>

      {phones.length === 0 ? (
        <Card padding="$3" backgroundColor="$backgroundHover">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No phone numbers added. Click "Add" to add one.
          </Text>
        </Card>
      ) : (
        <YStack gap="$2">
          {phones.map((phone, index) => (
            <Card
              key={phone.id}
              padding="$3"
              backgroundColor={index === 0 ? '$blue2' : '$backgroundHover'}
              borderWidth={index === 0 ? 1 : 0}
              borderColor="$blue6"
              draggable={!readOnly}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e: React.DragEvent) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              opacity={draggedIndex === index ? 0.5 : 1}
            >
              <XStack gap="$3" alignItems="center">
                {!readOnly && (
                  <YStack cursor="grab" opacity={0.5}>
                    <GripVertical size={16} />
                  </YStack>
                )}

                <YStack flex={1} gap="$2">
                  {readOnly ? (
                    <XStack gap="$2" alignItems="center">
                      <Text fontSize="$4" fontWeight="500">
                        {formatPhoneNumber(phone.number) || 'No number'}
                      </Text>
                      <Text fontSize="$2" theme="alt2">
                        ({phoneTypeLabels[phone.type]})
                      </Text>
                      {index === 0 && (
                        <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$blue4">
                          <Text fontSize="$1" color="$blue10">Preferred</Text>
                        </Card>
                      )}
                      {phone.verified && (
                        <Check size={14} color="$green10" />
                      )}
                    </XStack>
                  ) : (
                    <YStack gap="$2">
                      <XStack gap="$1" flexWrap="wrap" alignItems="center">
                        {(['mobile', 'home', 'work', 'other'] as PhoneType[]).map((type) => (
                          <Button
                            key={type}
                            size="$2"
                            theme={phone.type === type ? 'blue' : undefined}
                            onPress={() => handleUpdatePhone(phone.id, { type })}
                          >
                            {phoneTypeLabels[type]}
                          </Button>
                        ))}
                        {index === 0 && (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$blue4" marginLeft="$2">
                            <Text fontSize="$1" color="$blue10">Preferred</Text>
                          </Card>
                        )}
                      </XStack>

                      <Input
                        placeholder="xxx-xxx-xxxx"
                        value={formatPhoneNumber(phone.number)}
                        onChangeText={(value: string) => handleNumberChange(phone.id, value)}
                        keyboardType="phone-pad"
                        maxLength={12}
                      />
                    </YStack>
                  )}

                  {phone.number.length > 0 && phone.number.length < 10 && !readOnly && (
                    <Text fontSize="$2" color="$red10">
                      Enter all 10 digits
                    </Text>
                  )}
                </YStack>

                {!readOnly && (
                  <Button
                    size="$2"
                    circular
                    icon={Trash2}
                    theme="red"
                    onPress={() => handleRemovePhone(phone.id)}
                  />
                )}
              </XStack>
            </Card>
          ))}
        </YStack>
      )}

      {phones.length > 1 && !readOnly && (
        <Text fontSize="$2" theme="alt2" textAlign="center">
          Drag to reorder. First number is your preferred contact.
        </Text>
      )}

      {onSave && !readOnly && (
        <Button
          theme="blue"
          onPress={onSave}
          disabled={saving || phones.some(p => p.number.length > 0 && p.number.length < 10)}
          icon={saving ? <Spinner /> : undefined}
        >
          {saving ? 'Saving...' : 'Save Phone Numbers'}
        </Button>
      )}
    </YStack>
  )
}
