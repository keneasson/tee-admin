import React, { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Select, Checkbox, Spinner, View } from 'tamagui'
import { Button } from '../Button'
import { Plus, Trash2, Edit3, Check, X, Phone, Smartphone, Briefcase } from '@tamagui/lucide-icons'
import type { PhoneType } from '@my/app/provider/dynamodb/types'

interface PhoneRecord {
  phoneId: string
  type: PhoneType
  number: string
  isPrimary: boolean
  isHousehold: boolean
}

interface PhoneListProps {
  phones: PhoneRecord[]
  editable?: boolean
  onAdd?: (phone: Omit<PhoneRecord, 'phoneId'>) => Promise<void>
  onUpdate?: (phoneId: string, updates: Partial<PhoneRecord>) => Promise<void>
  onDelete?: (phoneId: string) => Promise<void>
}

const phoneTypeLabels: Record<PhoneType, string> = {
  mobile: 'Mobile',
  home: 'Home',
  work: 'Work',
  other: 'Other',
}

const phoneTypeIcons: Record<PhoneType, React.ReactNode> = {
  mobile: <Smartphone size={16} />,
  home: <Phone size={16} />,
  work: <Briefcase size={16} />,
  other: <Phone size={16} />,
}

const emptyPhone: Omit<PhoneRecord, 'phoneId'> = {
  type: 'mobile',
  number: '',
  isPrimary: false,
  isHousehold: false,
}

export const PhoneList: React.FC<PhoneListProps> = ({
  phones,
  editable = false,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newPhone, setNewPhone] = useState(emptyPhone)
  const [editPhone, setEditPhone] = useState<PhoneRecord | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!onAdd || !newPhone.number) return
    setLoading(true)
    try {
      await onAdd(newPhone)
      setNewPhone(emptyPhone)
      setIsAdding(false)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!onUpdate || !editPhone) return
    setLoading(true)
    try {
      const { phoneId, ...updates } = editPhone
      await onUpdate(phoneId, updates)
      setEditingId(null)
      setEditPhone(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (phoneId: string) => {
    if (!onDelete) return
    setLoading(true)
    try {
      await onDelete(phoneId)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (phone: PhoneRecord) => {
    setEditingId(phone.phoneId)
    setEditPhone({ ...phone })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditPhone(null)
  }

  const renderPhoneForm = (
    phone: Omit<PhoneRecord, 'phoneId'>,
    setPhone: (p: Omit<PhoneRecord, 'phoneId'>) => void,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <Card padding="$3" backgroundColor="$background">
      <YStack gap="$2">
        <XStack gap="$2">
          <View flex={1}>
            <Select
              value={phone.type}
              onValueChange={(val: string) => setPhone({ ...phone, type: val as PhoneType })}
            >
              <Select.Trigger>
                <Select.Value placeholder="Type" />
              </Select.Trigger>
              <Select.Content>
                <Select.ScrollUpButton />
                <Select.Viewport>
                  {Object.entries(phoneTypeLabels).map(([value, label]) => (
                    <Select.Item key={value} value={value} index={Object.keys(phoneTypeLabels).indexOf(value)}>
                      <Select.ItemText>{label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
          </View>
          <Input
            placeholder="Phone Number"
            value={phone.number}
            onChangeText={(val: string) => setPhone({ ...phone, number: val })}
            flex={2}
            keyboardType="phone-pad"
          />
        </XStack>
        <XStack gap="$4">
          <XStack gap="$2" alignItems="center">
            <Checkbox
              checked={phone.isPrimary}
              onCheckedChange={(val) => setPhone({ ...phone, isPrimary: !!val })}
            >
              <Checkbox.Indicator>
                <Check size={14} />
              </Checkbox.Indicator>
            </Checkbox>
            <Text fontSize="$2">Primary</Text>
          </XStack>
          <XStack gap="$2" alignItems="center">
            <Checkbox
              checked={phone.isHousehold}
              onCheckedChange={(val) => setPhone({ ...phone, isHousehold: !!val })}
            >
              <Checkbox.Indicator>
                <Check size={14} />
              </Checkbox.Indicator>
            </Checkbox>
            <Text fontSize="$2">Household</Text>
          </XStack>
        </XStack>
        <XStack gap="$2" justifyContent="flex-end">
          <Button size="$2" onPress={onCancel} icon={X} disabled={loading}>
            Cancel
          </Button>
          <Button size="$2" theme="blue" onPress={onSave} icon={loading ? <Spinner /> : Check} disabled={loading}>
            Save
          </Button>
        </XStack>
      </YStack>
    </Card>
  )

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Text fontSize="$5" fontWeight="600">Phone Numbers</Text>
        {editable && !isAdding ? (
          <Button size="$2" icon={Plus} onPress={() => setIsAdding(true)}>
            Add
          </Button>
        ) : null}
      </XStack>

      {isAdding ? renderPhoneForm(
        newPhone,
        setNewPhone,
        handleAdd,
        () => { setIsAdding(false); setNewPhone(emptyPhone) }
      ) : null}

      {phones.length === 0 && !isAdding ? (
        <Text fontSize="$3" theme="alt2">No phone numbers added yet.</Text>
      ) : null}

      {phones.map((phone) => (
        <Card key={phone.phoneId} padding="$3" backgroundColor="$backgroundHover">
          {editingId === phone.phoneId && editPhone ? (
            renderPhoneForm(
              editPhone,
              (updates) => setEditPhone({ ...editPhone, ...updates }),
              handleUpdate,
              cancelEdit
            )
          ) : (
            <XStack justifyContent="space-between" alignItems="center">
              <XStack gap="$3" alignItems="center" flex={1}>
                {phoneTypeIcons[phone.type]}
                <YStack>
                  <XStack gap="$2" alignItems="center">
                    <Text fontSize="$4" fontWeight="500">{phone.number}</Text>
                    {phone.isPrimary ? (
                      <Text fontSize="$2" color="$blue10">(Primary)</Text>
                    ) : null}
                    {phone.isHousehold ? (
                      <Text fontSize="$2" color="$green10">(Household)</Text>
                    ) : null}
                  </XStack>
                  <Text fontSize="$2" theme="alt2">{phoneTypeLabels[phone.type]}</Text>
                </YStack>
              </XStack>
              {editable ? (
                <XStack gap="$2">
                  <Button size="$2" circular icon={Edit3} onPress={() => startEdit(phone)} />
                  <Button size="$2" circular icon={Trash2} theme="red" onPress={() => handleDelete(phone.phoneId)} />
                </XStack>
              ) : null}
            </XStack>
          )}
        </Card>
      ))}
    </YStack>
  )
}
