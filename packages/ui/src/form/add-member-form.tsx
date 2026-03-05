import { useState, useMemo } from 'react'
import { YStack, XStack, Text, Label, Input, Select, View, Separator } from 'tamagui'
import { Button } from '../Button'

export interface AddMemberFormData {
  firstName: string
  lastName: string
  email: string
  ecclesia: string
  phone?: string
  address?: string
}

interface AddMemberFormProps {
  defaultEcclesia?: string
  ecclesias: string[]
  onSave: (data: AddMemberFormData) => Promise<boolean>
  onCancel: () => void
  isLoading?: boolean
  resultMessage?: string | null
}

export function AddMemberForm({
  defaultEcclesia,
  ecclesias,
  onSave,
  onCancel,
  isLoading = false,
  resultMessage,
}: AddMemberFormProps) {
  const [formData, setFormData] = useState<AddMemberFormData>({
    firstName: '',
    lastName: '',
    email: '',
    ecclesia: defaultEcclesia || '',
    phone: '',
    address: '',
  })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  const updateField = (field: keyof AddMemberFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required'
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required'
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    if (!formData.ecclesia.trim()) {
      newErrors.ecclesia = 'Ecclesia is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    const success = await onSave({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      ecclesia: formData.ecclesia.trim(),
      phone: formData.phone?.trim() || undefined,
      address: formData.address?.trim() || undefined,
    })

    if (!success) {
      setErrors({ email: 'Failed to add member. Please try again.' })
    }
  }

  const isValid = useMemo(() => {
    return !!(
      formData.firstName.trim() &&
      formData.lastName.trim() &&
      formData.email.trim() &&
      formData.ecclesia.trim()
    )
  }, [formData])

  return (
    <YStack gap="$4" maxWidth={600} width="100%">
      {resultMessage ? (
        <Text color="$red11" fontSize="$3">{resultMessage}</Text>
      ) : null}

      {/* First Name */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          First Name <Text color="$red10">*</Text>
        </Label>
        <Input
          value={formData.firstName}
          onChangeText={(text) => updateField('firstName', text)}
          placeholder="Enter first name"
          borderWidth={2}
          borderColor={errors.firstName ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{ borderColor: errors.firstName ? '$error' : '$primary', borderWidth: 2 }}
          hoverStyle={{ borderColor: errors.firstName ? '$error' : '$textSecondary' }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
          autoFocus
        />
        {errors.firstName ? <Text color="$red11" fontSize="$3">{errors.firstName}</Text> : null}
      </YStack>

      {/* Last Name */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Last Name <Text color="$red10">*</Text>
        </Label>
        <Input
          value={formData.lastName}
          onChangeText={(text) => updateField('lastName', text)}
          placeholder="Enter last name"
          borderWidth={2}
          borderColor={errors.lastName ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{ borderColor: errors.lastName ? '$error' : '$primary', borderWidth: 2 }}
          hoverStyle={{ borderColor: errors.lastName ? '$error' : '$textSecondary' }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
        {errors.lastName ? <Text color="$red11" fontSize="$3">{errors.lastName}</Text> : null}
      </YStack>

      {/* Email */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Email <Text color="$red10">*</Text>
        </Label>
        <Input
          value={formData.email}
          onChangeText={(text) => updateField('email', text)}
          placeholder="Enter email address"
          autoCapitalize="none"
          keyboardType="email-address"
          borderWidth={2}
          borderColor={errors.email ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{ borderColor: errors.email ? '$error' : '$primary', borderWidth: 2 }}
          hoverStyle={{ borderColor: errors.email ? '$error' : '$textSecondary' }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
        {errors.email ? <Text color="$red11" fontSize="$3">{errors.email}</Text> : null}
      </YStack>

      {/* Ecclesia */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Ecclesia <Text color="$red10">*</Text>
        </Label>
        <View>
          <Select
            value={formData.ecclesia}
            onValueChange={(value) => updateField('ecclesia', value)}
          >
            <Select.Trigger
              borderWidth={2}
              borderColor={errors.ecclesia ? '$error' : '$textTertiary'}
              backgroundColor="$background"
            >
              <Select.Value placeholder="Select ecclesia" />
            </Select.Trigger>
            <Select.Content zIndex={200000}>
              <Select.ScrollUpButton />
              <Select.Viewport>
                {ecclesias.map((ecc, index) => (
                  <Select.Item key={ecc} value={ecc} index={index}>
                    <Select.ItemText>{ecc}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
              <Select.ScrollDownButton />
            </Select.Content>
          </Select>
        </View>
        {errors.ecclesia ? <Text color="$red11" fontSize="$3">{errors.ecclesia}</Text> : null}
      </YStack>

      <Separator marginVertical="$2" />

      {/* Optional Fields */}
      <Text fontSize="$3" color="$textSecondary" fontWeight="600">Optional</Text>

      {/* Phone */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">Phone</Label>
        <Input
          value={formData.phone}
          onChangeText={(text) => updateField('phone', text)}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
          borderWidth={2}
          borderColor="$textTertiary"
          backgroundColor="$background"
          focusStyle={{ borderColor: '$primary', borderWidth: 2 }}
          hoverStyle={{ borderColor: '$textSecondary' }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
      </YStack>

      {/* Address */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">Address</Label>
        <Input
          value={formData.address}
          onChangeText={(text) => updateField('address', text)}
          placeholder="Enter address"
          borderWidth={2}
          borderColor="$textTertiary"
          backgroundColor="$background"
          focusStyle={{ borderColor: '$primary', borderWidth: 2 }}
          hoverStyle={{ borderColor: '$textSecondary' }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
      </YStack>

      {/* Action Buttons */}
      <XStack gap="$3" justifyContent="flex-end" paddingTop="$4">
        <Button
          size="$4"
          variant="outlined"
          borderWidth={2}
          borderColor="$textTertiary"
          onPress={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          size="$4"
          theme="blue"
          borderWidth={2}
          onPress={handleSubmit}
          disabled={!isValid || isLoading}
          opacity={!isValid || isLoading ? 0.5 : 1}
        >
          {isLoading ? 'Adding...' : 'Add Member'}
        </Button>
      </XStack>
    </YStack>
  )
}
