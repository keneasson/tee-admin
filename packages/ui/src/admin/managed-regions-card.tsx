'use client'

import { useState } from 'react'
import {
  YStack,
  XStack,
  Text,
  Card,
  Separator,
  Checkbox,
  Label,
  Spinner,
} from '@my/ui'
import { Button } from '../Button'
import {
  MapPin,
  Pencil,
  Save,
  X,
  Check as CheckIcon,
  Globe2,
} from '@tamagui/lucide-icons'
import type { PersonRecord } from '@my/app/provider/dynamodb/types'

interface RegionOption {
  id: string
  label: string
}

interface ManagedRegionsCardProps {
  person: PersonRecord
  regionOptions: RegionOption[]
  canEdit: boolean
  onSave: (managedRegions: string[]) => Promise<void>
}

/**
 * Owner-only card for assigning regional admin responsibilities.
 *
 * Displays a read-only list of regions the admin currently manages, with an
 * edit mode that lets the owner toggle a multi-select checklist of all
 * available regions. Requires the `MULTI_TENANT_INIT` flag at the page level.
 */
export function ManagedRegionsCard({
  person,
  regionOptions,
  canEdit,
  onSave,
}: ManagedRegionsCardProps) {
  const currentRegions = person.managedRegions ?? []

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>(currentRegions)

  const labelFor = (id: string): string => {
    const match = regionOptions.find((opt) => opt.id === id)
    return match ? match.label : id
  }

  const startEditing = () => {
    setSelected([...currentRegions])
    setError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setError(null)
  }

  const toggleRegion = (regionId: string, checked: boolean) => {
    if (checked) {
      if (!selected.includes(regionId)) {
        setSelected([...selected, regionId])
      }
    } else {
      setSelected(selected.filter((id) => id !== regionId))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(selected)
      setEditing(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save managed regions'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const roleLabel = person.role ?? 'member'
  const isAdmin = roleLabel === 'admin' || roleLabel === 'owner'

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor" backgroundColor="$background">
      <YStack gap="$3">
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Globe2 size={20} color="$primary" />
            <Text fontSize="$5" fontWeight="600">
              Managed Regions
            </Text>
          </XStack>
          {canEdit && !editing ? (
            <Button
              size="$3"
              icon={Pencil}
              variant="outlined"
              onPress={startEditing}
            >
              Edit
            </Button>
          ) : null}
        </XStack>

        <Text fontSize="$2" theme="alt2">
          Regions this admin oversees for cross-ecclesia coordination.
        </Text>

        {!isAdmin ? (
          <Text fontSize="$3" theme="alt2" fontStyle="italic">
            Managed regions only apply to users with the admin role.
          </Text>
        ) : null}

        <Separator />

        {editing ? (
          <YStack gap="$3">
            <Text fontSize="$3" fontWeight="600">
              Select regions
            </Text>
            <YStack gap="$2">
              {regionOptions.map((option) => {
                const isChecked = selected.includes(option.id)
                const checkboxId = `managed-region-${option.id}`
                return (
                  <XStack
                    key={option.id}
                    gap="$3"
                    alignItems="center"
                    paddingVertical="$1"
                  >
                    <Checkbox
                      id={checkboxId}
                      size="$4"
                      checked={isChecked}
                      onCheckedChange={(next) => toggleRegion(option.id, next === true)}
                      borderWidth={2}
                      borderColor={isChecked ? '$primary' : '$borderColor'}
                      backgroundColor={isChecked ? '$primary' : 'transparent'}
                      focusStyle={{
                        borderColor: '$primary',
                        borderWidth: 2,
                      }}
                    >
                      <Checkbox.Indicator>
                        <CheckIcon size={14} color="$primaryForeground" />
                      </Checkbox.Indicator>
                    </Checkbox>
                    <Label
                      htmlFor={checkboxId}
                      fontSize="$3"
                      cursor="pointer"
                      onPress={() => toggleRegion(option.id, !isChecked)}
                    >
                      {option.label}
                    </Label>
                  </XStack>
                )
              })}
            </YStack>

            {error ? (
              <Text fontSize="$2" color="$error">
                {error}
              </Text>
            ) : null}

            <XStack gap="$2" justifyContent="flex-end">
              <Button icon={X} onPress={cancelEditing} disabled={saving}>
                Cancel
              </Button>
              <Button
                theme="blue"
                icon={saving ? <Spinner size="small" width={16} height={16} /> : Save}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <YStack gap="$2">
            {currentRegions.length > 0 ? (
              <XStack flexWrap="wrap" gap="$2">
                {currentRegions.map((regionId) => (
                  <XStack
                    key={regionId}
                    gap="$1"
                    alignItems="center"
                    paddingHorizontal="$3"
                    paddingVertical="$1.5"
                    borderRadius="$10"
                    borderWidth={1}
                    borderColor="$borderColor"
                    backgroundColor="$backgroundHover"
                  >
                    <MapPin size={12} color="$primary" />
                    <Text fontSize="$3">{labelFor(regionId)}</Text>
                  </XStack>
                ))}
              </XStack>
            ) : (
              <Text fontSize="$3" theme="alt2" fontStyle="italic">
                No regions assigned.
              </Text>
            )}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}
