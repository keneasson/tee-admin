import React, { useState } from 'react'
import { YStack, XStack, Text, Button, Card, Input, Select, Checkbox, Spinner, View } from 'tamagui'
import { Plus, Trash2, Edit3, Check, X, MapPin, Home, Briefcase, Mail } from '@tamagui/lucide-icons'
import type { AddressType } from '@my/app/provider/dynamodb/types'
import { AddressAutocomplete } from '../form/address-autocomplete'
import type { ParsedAddress } from '@my/app/types/address-autocomplete'

interface Address {
  addressId: string
  type: AddressType
  label?: string
  street1: string
  street2?: string
  city: string
  province: string
  postalCode: string
  country: string
  isPrimary: boolean
  isHousehold: boolean
}

interface AddressListProps {
  addresses: Address[]
  editable?: boolean
  onAdd?: (address: Omit<Address, 'addressId'>) => Promise<void>
  onUpdate?: (addressId: string, updates: Partial<Address>) => Promise<void>
  onDelete?: (addressId: string) => Promise<void>
}

const addressTypeLabels: Record<AddressType, string> = {
  home: 'Home',
  residence: 'Residence',
  work: 'Work',
  mailing: 'Mailing',
  other: 'Other',
}

const addressTypeIcons: Record<AddressType, React.ReactNode> = {
  home: <Home size={16} />,
  residence: <MapPin size={16} />,
  work: <Briefcase size={16} />,
  mailing: <Mail size={16} />,
  other: <MapPin size={16} />,
}

const emptyAddress: Omit<Address, 'addressId'> = {
  type: 'home',
  street1: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Canada',
  isPrimary: false,
  isHousehold: false,
}

export const AddressList: React.FC<AddressListProps> = ({
  addresses,
  editable = false,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newAddress, setNewAddress] = useState(emptyAddress)
  const [editAddress, setEditAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!onAdd || !newAddress.street1 || !newAddress.city) return
    setLoading(true)
    try {
      await onAdd(newAddress)
      setNewAddress(emptyAddress)
      setIsAdding(false)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!onUpdate || !editAddress) return
    setLoading(true)
    try {
      const { addressId, ...updates } = editAddress
      await onUpdate(addressId, updates)
      setEditingId(null)
      setEditAddress(null)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (addressId: string) => {
    if (!onDelete) return
    setLoading(true)
    try {
      await onDelete(addressId)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (address: Address) => {
    setEditingId(address.addressId)
    setEditAddress({ ...address })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditAddress(null)
  }

  const renderAddressForm = (
    address: Omit<Address, 'addressId'>,
    setAddress: (addr: Omit<Address, 'addressId'>) => void,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <Card padding="$3" backgroundColor="$background">
      <YStack gap="$2">
        <XStack gap="$2">
          <View flex={1}>
            <Select
              value={address.type}
              onValueChange={(val: string) => setAddress({ ...address, type: val as AddressType })}
            >
              <Select.Trigger>
                <Select.Value placeholder="Type" />
              </Select.Trigger>
              <Select.Content>
                <Select.ScrollUpButton />
                <Select.Viewport>
                  {Object.entries(addressTypeLabels).map(([value, label]) => (
                    <Select.Item key={value} value={value} index={Object.keys(addressTypeLabels).indexOf(value)}>
                      <Select.ItemText>{label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton />
              </Select.Content>
            </Select>
          </View>
          <Input
            placeholder="Label (optional)"
            value={address.label || ''}
            onChangeText={(val: string) => setAddress({ ...address, label: val })}
            flex={1}
          />
        </XStack>
        <AddressAutocomplete
          value={address.street1}
          onChangeText={(val: string) => setAddress({ ...address, street1: val })}
          onAddressSelect={(parsed: ParsedAddress) => {
            setAddress({
              ...address,
              street1: parsed.formattedAddress || parsed.streetAddress,
              city: parsed.city,
              province: parsed.province,
              postalCode: parsed.postalCode,
              country: parsed.country,
            })
          }}
          label=""
          placeholder="Street Address"
          country={address.country}
        />
        <Input
          placeholder="Apt, Suite, etc. (optional)"
          value={address.street2 || ''}
          onChangeText={(val: string) => setAddress({ ...address, street2: val })}
        />
        <XStack gap="$2">
          <Input
            placeholder="City"
            value={address.city}
            onChangeText={(val: string) => setAddress({ ...address, city: val })}
            flex={1}
          />
          <Input
            placeholder="Province"
            value={address.province}
            onChangeText={(val: string) => setAddress({ ...address, province: val })}
            flex={1}
          />
        </XStack>
        <XStack gap="$2">
          <Input
            placeholder="Postal Code"
            value={address.postalCode}
            onChangeText={(val: string) => setAddress({ ...address, postalCode: val })}
            flex={1}
          />
          <Input
            placeholder="Country"
            value={address.country}
            onChangeText={(val: string) => setAddress({ ...address, country: val })}
            flex={1}
          />
        </XStack>
        <XStack gap="$4">
          <XStack gap="$2" alignItems="center">
            <Checkbox
              checked={address.isPrimary}
              onCheckedChange={(val) => setAddress({ ...address, isPrimary: !!val })}
            >
              <Checkbox.Indicator>
                <Check size={14} />
              </Checkbox.Indicator>
            </Checkbox>
            <Text fontSize="$2">Primary</Text>
          </XStack>
          <XStack gap="$2" alignItems="center">
            <Checkbox
              checked={address.isHousehold}
              onCheckedChange={(val) => setAddress({ ...address, isHousehold: !!val })}
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
        <Text fontSize="$5" fontWeight="600">Addresses</Text>
        {editable && !isAdding ? (
          <Button size="$2" icon={Plus} onPress={() => setIsAdding(true)}>
            Add
          </Button>
        ) : null}
      </XStack>

      {isAdding ? renderAddressForm(
        newAddress,
        setNewAddress,
        handleAdd,
        () => { setIsAdding(false); setNewAddress(emptyAddress) }
      ) : null}

      {addresses.length === 0 && !isAdding ? (
        <Text fontSize="$3" theme="alt2">No addresses added yet.</Text>
      ) : null}

      {addresses.map((address) => (
        <Card key={address.addressId} padding="$3" backgroundColor="$backgroundHover">
          {editingId === address.addressId && editAddress ? (
            renderAddressForm(
              editAddress,
              (updates) => setEditAddress({ ...editAddress, ...updates }),
              handleUpdate,
              cancelEdit
            )
          ) : (
            <XStack justifyContent="space-between" alignItems="flex-start">
              <YStack gap="$1" flex={1}>
                <XStack gap="$2" alignItems="center">
                  {addressTypeIcons[address.type]}
                  <Text fontSize="$4" fontWeight="500">
                    {address.label || addressTypeLabels[address.type]}
                  </Text>
                  {address.isPrimary ? (
                    <Text fontSize="$2" color="$blue10">(Primary)</Text>
                  ) : null}
                  {address.isHousehold ? (
                    <Text fontSize="$2" color="$green10">(Household)</Text>
                  ) : null}
                </XStack>
                <Text fontSize="$3">{address.street1}</Text>
                {address.street2 ? <Text fontSize="$3">{address.street2}</Text> : null}
                <Text fontSize="$3">
                  {address.city}, {address.province} {address.postalCode}
                </Text>
                <Text fontSize="$3">{address.country}</Text>
              </YStack>
              {editable ? (
                <XStack gap="$2">
                  <Button size="$2" circular icon={Edit3} onPress={() => startEdit(address)} />
                  <Button size="$2" circular icon={Trash2} theme="red" onPress={() => handleDelete(address.addressId)} />
                </XStack>
              ) : null}
            </XStack>
          )}
        </Card>
      ))}
    </YStack>
  )
}
