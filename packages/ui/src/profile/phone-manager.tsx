import React, { useState } from 'react'
import { YStack, XStack, Text, Card, Input, Spinner, Popover } from 'tamagui'
import { Button } from '../Button'
import { Phone, Plus, Trash2, Check, Pencil, MoreHorizontal, Star, X } from '@tamagui/lucide-icons'
import { movePhoneToFront } from './phone-ordering'

export { movePhoneToFront }

export type PhoneType = 'mobile' | 'home' | 'work' | 'other'

export interface PhoneEntry {
  id: string
  type: PhoneType
  number: string // 10 digits only
  verified?: boolean
}

interface PhoneManagerProps {
  phones: PhoneEntry[]
  /** Add a new phone. Each save hits its endpoint immediately, then the page refetches. */
  onAddPhone: (type: PhoneType, number: string) => Promise<void> | void
  /** Update a phone's type and/or number in place. */
  onUpdatePhone: (id: string, updates: { type?: PhoneType; number?: string }) => Promise<void> | void
  /** Soft-delete a phone by id. */
  onDeletePhone: (id: string) => Promise<void> | void
  /** Make this number the preferred (first) contact — soft, in-place (reorder). */
  onSetPreferred: (id: string) => Promise<void> | void
  /** View-only: render numbers + badges, no controls. */
  readOnly?: boolean
}

const GUTTER = 34

const phoneTypeLabels: Record<PhoneType, string> = {
  mobile: 'Mobile',
  home: 'Home',
  work: 'Work',
  other: 'Other',
}

const PHONE_TYPES: PhoneType[] = ['mobile', 'home', 'work', 'other']

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

function isValidNumber(digits: string): boolean {
  return /^\d{10}$/.test(digits)
}

/** Shared inline editor: a compact segmented type selector + number Input + Save/Cancel. */
const PhoneEditor: React.FC<{
  type: PhoneType
  number: string
  onTypeChange: (type: PhoneType) => void
  onNumberChange: (digits: string) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  saveLabel: string
}> = ({ type, number, onTypeChange, onNumberChange, onCancel, onSave, saving, saveLabel }) => {
  const invalid = number.length > 0 && !isValidNumber(number)
  return (
    <YStack gap="$2">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <XStack gap="$1" flexWrap="wrap" alignItems="center">
          {PHONE_TYPES.map((t) => (
            <Button
              key={t}
              size="$2"
              theme={type === t ? 'blue' : undefined}
              onPress={() => onTypeChange(t)}
            >
              {phoneTypeLabels[t]}
            </Button>
          ))}
        </XStack>
        <Input
          flex={1}
          minWidth={160}
          placeholder="xxx-xxx-xxxx"
          value={formatPhoneNumber(number)}
          onChangeText={(value: string) => onNumberChange(extractDigits(value))}
          keyboardType="phone-pad"
          maxLength={12}
          autoFocus
        />
        <Button
          size="$2"
          variant="outlined"
          icon={X}
          onPress={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="$2"
          theme="blue"
          icon={saving ? <Spinner size="small" /> : Check}
          onPress={onSave}
          disabled={saving || !isValidNumber(number)}
        >
          {saveLabel}
        </Button>
      </XStack>
      {invalid ? (
        <Text fontSize="$2" color="$red10" paddingLeft={GUTTER + 8}>
          Enter all 10 digits
        </Text>
      ) : null}
    </YStack>
  )
}

export const PhoneManager: React.FC<PhoneManagerProps> = ({
  phones,
  onAddPhone,
  onUpdatePhone,
  onDeletePhone,
  onSetPreferred,
  readOnly = false,
}) => {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Inline "add a new number" editor (revealed by the Add button).
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<PhoneType>('mobile')
  const [newNumber, setNewNumber] = useState('')

  // Inline "edit an existing number" editor, keyed by row id.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editType, setEditType] = useState<PhoneType>('mobile')
  const [editNumber, setEditNumber] = useState('')

  const run = async (id: string, fn: () => Promise<void> | void) => {
    setBusyId(id)
    try {
      await fn()
    } finally {
      setBusyId(null)
    }
  }

  const startAdd = () => {
    setAdding(true)
    setNewType('mobile')
    setNewNumber('')
  }

  const submitAdd = async () => {
    if (!isValidNumber(newNumber)) return
    await run('__add__', async () => {
      await onAddPhone(newType, newNumber)
      setNewNumber('')
      setAdding(false)
    })
  }

  const startEdit = (entry: PhoneEntry) => {
    setEditingId(entry.id)
    setEditType(entry.type)
    setEditNumber(entry.number)
  }

  const submitEdit = async (entry: PhoneEntry) => {
    if (!isValidNumber(editNumber)) return
    if (editNumber === entry.number && editType === entry.type) {
      setEditingId(null)
      return
    }
    await run(entry.id, async () => {
      await onUpdatePhone(entry.id, { type: editType, number: editNumber })
      setEditingId(null)
    })
  }

  return (
    <YStack gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <XStack gap="$2" alignItems="center">
          <Phone size={20} />
          <Text fontSize="$4" fontWeight="600">Phone Numbers</Text>
        </XStack>
        {readOnly ? null : (
          <Button size="$2" variant="outlined" icon={Plus} onPress={startAdd}>
            Add
          </Button>
        )}
      </XStack>

      {phones.length === 0 && !adding ? (
        <Card padding="$3" backgroundColor="$backgroundHover">
          <Text fontSize="$3" theme="alt2" textAlign="center">
            No phone numbers. Click "Add" to add one.
          </Text>
        </Card>
      ) : (
        <YStack gap="$2">
          {phones.map((entry, index) => {
            const isPreferred = index === 0
            const isEditing = editingId === entry.id
            const rowBusy = busyId === entry.id
            const showMenu = !readOnly && !isPreferred

            return (
              <Card
                key={entry.id}
                padding="$3"
                backgroundColor={isPreferred ? '$blue2' : '$backgroundHover'}
                borderWidth={isPreferred ? 1 : 0}
                borderColor="$blue6"
              >
                {isEditing ? (
                  <PhoneEditor
                    type={editType}
                    number={editNumber}
                    onTypeChange={setEditType}
                    onNumberChange={setEditNumber}
                    onCancel={() => setEditingId(null)}
                    onSave={() => submitEdit(entry)}
                    saving={rowBusy}
                    saveLabel="Save"
                  />
                ) : (
                  <XStack gap="$2" alignItems="flex-start">
                    {/* Left edit gutter — consistent on every row */}
                    <XStack width={GUTTER} alignItems="center" justifyContent="flex-start">
                      {readOnly ? null : (
                        <Button
                          size="$2"
                          circular
                          chromeless
                          icon={Pencil}
                          aria-label="Edit phone"
                          onPress={() => startEdit(entry)}
                          disabled={rowBusy}
                        />
                      )}
                    </XStack>

                    {/* Value + badges */}
                    <YStack flex={1} gap="$1" minWidth={0}>
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <Text fontSize="$4" fontWeight="500">
                          {formatPhoneNumber(entry.number) || 'No number'}
                        </Text>
                        <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$gray4">
                          <Text fontSize="$1" color="$gray11">{phoneTypeLabels[entry.type]}</Text>
                        </Card>
                        {isPreferred ? (
                          <Card paddingHorizontal="$2" paddingVertical="$1" backgroundColor="$blue4">
                            <Text fontSize="$1" color="$blue10">Preferred</Text>
                          </Card>
                        ) : null}
                      </XStack>
                    </YStack>

                    {/* Right actions */}
                    <XStack gap="$2" alignItems="center">
                      {showMenu ? (
                        <Popover
                          size="$3"
                          allowFlip
                          open={openMenuId === entry.id}
                          onOpenChange={(open) => setOpenMenuId(open ? entry.id : null)}
                        >
                          <Popover.Trigger asChild>
                            <Button
                              size="$2"
                              circular
                              chromeless
                              icon={MoreHorizontal}
                              aria-label="More actions"
                            />
                          </Popover.Trigger>
                          <Popover.Content
                            bordered
                            elevate
                            padding="$0"
                            enterStyle={{ y: -6, opacity: 0 }}
                            exitStyle={{ y: -6, opacity: 0 }}
                            animation="quick"
                          >
                            <YStack minWidth={220}>
                              <Button
                                chromeless
                                justifyContent="flex-start"
                                borderRadius={0}
                                icon={Star}
                                onPress={() => {
                                  setOpenMenuId(null)
                                  void run(entry.id, () => onSetPreferred(entry.id))
                                }}
                              >
                                Set as preferred
                              </Button>
                            </YStack>
                          </Popover.Content>
                        </Popover>
                      ) : null}

                      {readOnly ? null : (
                        <Button
                          size="$2"
                          circular
                          chromeless
                          icon={rowBusy ? <Spinner size="small" /> : Trash2}
                          color="$red10"
                          aria-label="Delete this number"
                          onPress={() => run(entry.id, () => onDeletePhone(entry.id))}
                          disabled={rowBusy}
                        />
                      )}
                    </XStack>
                  </XStack>
                )}
              </Card>
            )
          })}

          {adding ? (
            <Card padding="$3" backgroundColor="$backgroundHover">
              <PhoneEditor
                type={newType}
                number={newNumber}
                onTypeChange={setNewType}
                onNumberChange={setNewNumber}
                onCancel={() => { setAdding(false); setNewNumber('') }}
                onSave={submitAdd}
                saving={busyId === '__add__'}
                saveLabel="Add"
              />
            </Card>
          ) : null}
        </YStack>
      )}
    </YStack>
  )
}
