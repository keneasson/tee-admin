import { useState, useEffect, useMemo } from 'react'
import { YStack, XStack, Text, Label, Input } from 'tamagui'
import { Button } from '../Button'
import { AddressAutocomplete } from './address-autocomplete'
import type { ParsedAddress } from '@my/app/types/address-autocomplete'

interface EcclesiaFormData {
  name: string
  country: string
  province: string
  city: string
  address?: string
  postalCode?: string
  venue?: string
}

interface AddEcclesiaFormProps {
  initialData?: Partial<EcclesiaFormData>
  /** @deprecated Use initialData instead */
  initialName?: string
  onSave: (ecclesia: EcclesiaFormData) => Promise<boolean>
  onCancel: () => void
  isLoading?: boolean
  mode?: 'add' | 'edit'
}

export function AddEcclesiaForm({
  initialData,
  initialName = '',
  onSave,
  onCancel,
  isLoading = false,
  mode = 'add'
}: AddEcclesiaFormProps) {
  const [formData, setFormData] = useState<EcclesiaFormData>({
    name: initialData?.name || initialName,
    country: initialData?.country || 'CA',
    province: initialData?.province || '',
    city: initialData?.city || '',
    address: initialData?.address || '',
    postalCode: initialData?.postalCode || '',
    venue: initialData?.venue || ''
  })

  const [errors, setErrors] = useState<Partial<EcclesiaFormData>>({})

  // Reset form when initialData changes (e.g., when editing different ecclesia)
  useEffect(() => {
    setFormData({
      name: initialData?.name || initialName,
      country: initialData?.country || 'CA',
      province: initialData?.province || '',
      city: initialData?.city || '',
      address: initialData?.address || '',
      postalCode: initialData?.postalCode || '',
      venue: initialData?.venue || ''
    })
    setErrors({})
  }, [initialData, initialName])

  // Update field and clear error
  const updateField = (field: keyof EcclesiaFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // Validate form - only name is required now
  const validateForm = (): boolean => {
    const newErrors: Partial<EcclesiaFormData> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Ecclesia name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return

    const success = await onSave({
      name: formData.name.trim(),
      country: formData.country,
      province: formData.province,
      city: formData.city.trim(),
      address: formData.address?.trim() || undefined,
      postalCode: formData.postalCode?.trim() || undefined,
      venue: formData.venue?.trim() || undefined
    })

    if (!success) {
      setErrors({ name: 'Failed to save ecclesia. Please try again.' })
    }
  }

  // Check if form is valid
  const isValid = useMemo(() => {
    return !!formData.name.trim()
  }, [formData])

  return (
    <YStack gap="$4" padding="$4" minWidth={400} backgroundColor="$brandLight">
      {/* Name Field */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Ecclesia Name <Text color="$red10">*</Text>
        </Label>
        <Input
          value={formData.name}
          onChangeText={(text) => updateField('name', text)}
          placeholder="Enter ecclesia name"
          borderWidth={2}
          borderColor={errors.name ? '$error' : '$textTertiary'}
          backgroundColor="$background"
          focusStyle={{
            borderColor: errors.name ? '$error' : '$primary',
            borderWidth: 2
          }}
          hoverStyle={{
            borderColor: errors.name ? '$error' : '$textSecondary'
          }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
        {errors.name ? <Text color="$red11" fontSize="$3">{errors.name}</Text> : null}
      </YStack>

      {/* Address Field (Optional) - Google Places autocomplete */}
      <AddressAutocomplete
        value={formData.address || ''}
        onChangeText={(text) => updateField('address', text)}
        onAddressSelect={(parsed: ParsedAddress) => {
          setFormData((prev) => ({
            ...prev,
            address: parsed.formattedAddress || parsed.streetAddress,
            city: parsed.city,
            province: parsed.province,
            postalCode: parsed.postalCode || '',
            country: parsed.country,
            venue: parsed.name || prev.venue || '',
          }))
        }}
        label="Address (Optional)"
        disabled={isLoading}
      />

      {/* Venue Field (Optional) - auto-filled from Google place name */}
      <YStack gap="$2">
        <Label fontSize="$4" fontWeight="600">
          Venue (Optional)
        </Label>
        <Input
          value={formData.venue}
          onChangeText={(text) => updateField('venue', text)}
          placeholder="Auto-filled from address lookup"
          borderWidth={2}
          borderColor="$textTertiary"
          backgroundColor="$background"
          focusStyle={{
            borderColor: '$primary',
            borderWidth: 2
          }}
          hoverStyle={{
            borderColor: '$textSecondary'
          }}
          paddingHorizontal="$3"
          paddingVertical="$2.5"
          disabled={isLoading}
        />
        <Text fontSize="$2" color="$gray10">
          e.g., community centre, church hall — filled automatically from address
        </Text>
      </YStack>

      {/* Action Buttons */}
      <XStack gap="$3" justifyContent="flex-end" paddingTop="$2">
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
          {isLoading
            ? (mode === 'edit' ? 'Saving...' : 'Adding...')
            : (mode === 'edit' ? 'Save Changes' : 'Add Ecclesia')}
        </Button>
      </XStack>
    </YStack>
  )
}
