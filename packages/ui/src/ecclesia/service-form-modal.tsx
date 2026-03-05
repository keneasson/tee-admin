import { useState, useEffect } from 'react'
import { Dialog, Button, Input, Select, Adapt, Sheet, YStack, XStack, Text } from '@my/ui'
import { Check, ChevronDown, ChevronUp } from '@tamagui/lucide-icons'
import type { EcclesiaService, ServiceType } from './service-list'
import { SERVICE_TYPE_LABELS } from './service-list'

interface ServiceFormModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  service?: EcclesiaService | null
  onSave: (service: Omit<EcclesiaService, 'id'> & { id?: string }) => void
}

const SERVICE_TYPES: ServiceType[] = ['memorial', 'bible_class', 'cyc', 'sunday_school', 'other']

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function ServiceFormModal({ isOpen, onOpenChange, service, onSave }: ServiceFormModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ServiceType>('memorial')
  const [day, setDay] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')

  const isEditing = !!service

  useEffect(() => {
    if (service) {
      setName(service.name)
      setType(service.type)
      setDay(service.day || '')
      setTime(service.time || '')
      setLocation(service.location || '')
    } else {
      setName('')
      setType('memorial')
      setDay('')
      setTime('')
      setLocation('')
    }
  }, [service, isOpen])

  const handleSave = () => {
    if (!name.trim()) return

    onSave({
      ...(service ? { id: service.id } : {}),
      name: name.trim(),
      type,
      day: day || undefined,
      time: time.trim() || undefined,
      location: location.trim() || undefined,
    })

    onOpenChange(false)
  }

  return (
    <Dialog modal open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          opacity={0.5}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
        <Dialog.Content
          bordered
          elevate
          key="content"
          animation="quick"
          enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
          exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
          gap="$4"
          padding="$4"
          minWidth={360}
        >
          <Dialog.Title fontSize="$6" fontWeight="600">
            {isEditing ? 'Edit Service' : 'Add Worship Service'}
          </Dialog.Title>

          <YStack gap="$3">
            {/* Service Name */}
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Service Name *</Text>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="e.g. Sunday Memorial"
                autoFocus
              />
            </YStack>

            {/* Service Type */}
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Type</Text>
              <Select
                value={type}
                onValueChange={(val) => setType(val as ServiceType)}
                disablePreventBodyScroll
              >
                <Select.Trigger iconAfter={ChevronDown}>
                  <Select.Value placeholder="Select type" />
                </Select.Trigger>

                <Adapt when="sm" platform="touch">
                  <Sheet modal dismissOnSnapToBottom snapPoints={[40]}>
                    <Sheet.Frame>
                      <Sheet.ScrollView>
                        <Adapt.Contents />
                      </Sheet.ScrollView>
                    </Sheet.Frame>
                    <Sheet.Overlay />
                  </Sheet>
                </Adapt>

                <Select.Content zIndex={200000}>
                  <Select.ScrollUpButton alignItems="center" justifyContent="center" height="$3">
                    <ChevronUp size={20} />
                  </Select.ScrollUpButton>
                  <Select.Viewport>
                    <Select.Group>
                      {SERVICE_TYPES.map((st, index) => (
                        <Select.Item key={st} index={index} value={st}>
                          <Select.ItemText>{SERVICE_TYPE_LABELS[st]}</Select.ItemText>
                          <Select.ItemIndicator marginLeft="auto">
                            <Check size={16} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                  <Select.ScrollDownButton alignItems="center" justifyContent="center" height="$3">
                    <ChevronDown size={20} />
                  </Select.ScrollDownButton>
                </Select.Content>
              </Select>
            </YStack>

            {/* Day */}
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Day</Text>
              <Select
                value={day}
                onValueChange={setDay}
                disablePreventBodyScroll
              >
                <Select.Trigger iconAfter={ChevronDown}>
                  <Select.Value placeholder="Select day" />
                </Select.Trigger>

                <Adapt when="sm" platform="touch">
                  <Sheet modal dismissOnSnapToBottom snapPoints={[50]}>
                    <Sheet.Frame>
                      <Sheet.ScrollView>
                        <Adapt.Contents />
                      </Sheet.ScrollView>
                    </Sheet.Frame>
                    <Sheet.Overlay />
                  </Sheet>
                </Adapt>

                <Select.Content zIndex={200000}>
                  <Select.ScrollUpButton alignItems="center" justifyContent="center" height="$3">
                    <ChevronUp size={20} />
                  </Select.ScrollUpButton>
                  <Select.Viewport>
                    <Select.Group>
                      {DAYS.map((d, index) => (
                        <Select.Item key={d} index={index} value={d}>
                          <Select.ItemText>{d}</Select.ItemText>
                          <Select.ItemIndicator marginLeft="auto">
                            <Check size={16} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  </Select.Viewport>
                  <Select.ScrollDownButton alignItems="center" justifyContent="center" height="$3">
                    <ChevronDown size={20} />
                  </Select.ScrollDownButton>
                </Select.Content>
              </Select>
            </YStack>

            {/* Time */}
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Time</Text>
              <Input
                value={time}
                onChangeText={setTime}
                placeholder="e.g. 11:00 AM"
              />
            </YStack>

            {/* Location override */}
            <YStack gap="$1">
              <Text fontSize="$3" fontWeight="600">Location (optional override)</Text>
              <Input
                value={location}
                onChangeText={setLocation}
                placeholder="Leave blank to use ecclesia address"
              />
            </YStack>
          </YStack>

          <XStack gap="$3" justifyContent="flex-end" marginTop="$2">
            <Dialog.Close asChild>
              <Button variant="outlined" borderWidth={2} borderColor="$textTertiary">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              theme="blue"
              onPress={handleSave}
              disabled={!name.trim()}
            >
              {isEditing ? 'Save Changes' : 'Add Service'}
            </Button>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  )
}
