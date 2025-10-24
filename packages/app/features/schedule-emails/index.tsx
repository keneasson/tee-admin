'use client'

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  YStack,
  XStack,
  Button,
  Card,
  Spinner,
  H2,
  H3,
  Separator,
  useThemeName,
  Switch,
  Input,
  Sheet,
  ScrollView,
} from '@my/ui'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { Edit3 as Edit, Clock, Mail, Calendar, Users, Trash2 } from '@tamagui/lucide-icons'
import { EmailType, EmailSchedule, QueueSummary, DayOfWeek } from '@my/app/types/send-queue'

interface ScheduleEmailsProps {}

interface AvailableEmailType {
  type: string
  name: string
  description: string
}

const defaultSchedules: Omit<EmailSchedule, 'enabled' | 'testMode'>[] = [
  {
    emailType: 'newsletter',
    dayOfWeek: 'thursday',
    time: '17:00',
    timezone: 'America/Toronto',
    description: 'Weekly community newsletter',
  },
  {
    emailType: 'bible-class',
    dayOfWeek: 'wednesday',
    time: '14:00',
    timezone: 'America/Toronto',
    description: 'Bible class study materials',
  },
  {
    emailType: 'sunday-school',
    dayOfWeek: 'saturday',
    time: '14:00',
    timezone: 'America/Toronto',
    description: 'Sunday school lesson preparation',
  },
  {
    emailType: 'recap',
    dayOfWeek: 'saturday',
    time: '15:00',
    timezone: 'America/Toronto',
    description: 'Memorial service arrangements',
  },
]

const emailTypeLabels: Record<EmailType, string> = {
  newsletter: 'Newsletter',
  'bible-class': 'Bible Class',
  'sunday-school': 'Sunday School',
  recap: 'Memorial Service',
}

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const daysOfWeek: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export const ScheduleEmails: React.FC<ScheduleEmailsProps> = () => {
  const themeName = useThemeName()
  const mode = themeName.includes('dark') ? 'dark' : 'light'
  const colors = brandColors[mode]

  const [schedules, setSchedules] = useState<EmailSchedule[]>([])
  const [queueSummary, setQueueSummary] = useState<QueueSummary | null>(null)
  const [availableTypes, setAvailableTypes] = useState<AvailableEmailType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EmailType | null>(null)
  const [creating, setCreating] = useState(false)
  const [editForm, setEditForm] = useState<Partial<EmailSchedule>>({})

  useEffect(() => {
    loadSchedules()
    loadQueueSummary()
    loadAvailableTypes()
  }, [])

  const loadSchedules = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/email-schedules')
      if (!response.ok) {
        throw new Error('Failed to load schedules')
      }
      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (error) {
      console.error('Failed to load schedules:', error)
      setError('Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }

  const loadQueueSummary = async () => {
    try {
      const response = await fetch('/api/email-queue?summary=true')
      if (!response.ok) {
        throw new Error('Failed to load queue summary')
      }
      const data = await response.json()
      setQueueSummary(data.summary)
    } catch (error) {
      console.error('Failed to load queue summary:', error)
    }
  }

  const loadAvailableTypes = async () => {
    try {
      const response = await fetch('/api/email-types')
      if (!response.ok) {
        throw new Error('Failed to load available email types')
      }
      const data = await response.json()
      setAvailableTypes(data.emailTypes || [])
    } catch (error) {
      console.error('Failed to load available email types:', error)
    }
  }

  const handleEdit = (emailType: EmailType) => {
    const schedule = schedules.find(s => s.emailType === emailType)
    if (schedule) {
      setEditForm(schedule)
      setEditing(emailType)
      setCreating(false)
    }
  }

  const handleCreate = () => {
    setEditForm({
      dayOfWeek: 'monday',
      time: '09:00',
      timezone: 'America/Toronto',
      enabled: true,
      testMode: true, // Default to test mode for safety
      description: '',
    })
    setCreating(true)
    setEditing(null)
  }

  const handleSave = async () => {
    if ((!editing && !creating) || !editForm) return

    try {
      setSaving(true)
      setError(null)

      // Validate form data
      if (!editForm.emailType && creating) {
        throw new Error('Email type is required')
      }
      if (!editForm.dayOfWeek || !editForm.time) {
        throw new Error('Day of week and time are required')
      }

      // Validate time format
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(editForm.time)) {
        throw new Error('Time must be in HH:MM format (24-hour)')
      }

      // Create or update via API
      const method = creating ? 'POST' : 'PATCH'
      const body = creating ? editForm : { emailType: editing, ...editForm }

      const response = await fetch('/api/email-schedules', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${creating ? 'create' : 'save'} schedule`)
      }

      // Reload schedules to get updated data
      await loadSchedules()
      setEditing(null)
      setCreating(false)
      setEditForm({})
    } catch (error) {
      setError(error instanceof Error ? error.message : `Failed to ${creating ? 'create' : 'save'} schedule`)
      console.error(`Failed to ${creating ? 'create' : 'save'} schedule:`, error)
    } finally {
      setSaving(false)
    }
  }

  const toggleSchedule = async (emailType: EmailType) => {
    try {
      const schedule = schedules.find(s => s.emailType === emailType)
      if (!schedule) return

      const response = await fetch('/api/email-schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailType, enabled: !schedule.enabled }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle schedule')
      }

      await loadSchedules()
    } catch (error) {
      console.error('Failed to toggle schedule:', error)
      setError('Failed to toggle schedule')
    }
  }

  const toggleTestMode = async (emailType: EmailType) => {
    try {
      const schedule = schedules.find(s => s.emailType === emailType)
      if (!schedule) return

      const response = await fetch('/api/email-schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailType, testMode: !schedule.testMode }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle test mode')
      }

      await loadSchedules()
    } catch (error) {
      console.error('Failed to toggle test mode:', error)
      setError('Failed to toggle test mode')
    }
  }

  const handleDelete = async (schedule: EmailSchedule) => {
    // Validate schedule data
    if (!schedule || !schedule.emailType || !schedule.dayOfWeek || !schedule.time) {
      const errorMsg = `Invalid schedule data - missing required fields`
      console.error('Invalid schedule:', schedule)
      alert(errorMsg)
      return
    }

    // Get the type name
    const typeName = emailTypeLabels[schedule.emailType]
    if (!typeName) {
      const errorMsg = `Unknown email type: "${schedule.emailType}"`
      console.error(errorMsg)
      alert(errorMsg)
      return
    }

    // Confirm deletion
    const confirmed = window.confirm(
      `Delete ${typeName} schedule?\n\nThis will remove the ${schedule.dayOfWeek} ${formatTime(schedule.time)} schedule permanently.`
    )

    if (!confirmed) return

    try {
      const params = new URLSearchParams({
        emailType: schedule.emailType,
        dayOfWeek: schedule.dayOfWeek,
        time: schedule.time,
      })

      const response = await fetch(`/api/email-schedules?${params}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete schedule')
      }

      await loadSchedules()
      await loadQueueSummary()
    } catch (error) {
      console.error('Failed to delete schedule:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete schedule'
      setError(errorMessage)
      alert(`Error: ${errorMessage}`)
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${period}`
  }

  const getStatusColor = (ready: number, processing: number, failed: number) => {
    if (failed > 0) return colors.error
    if (processing > 0) return colors.info
    if (ready > 0) return colors.warning
    return colors.success
  }

  const getEmailTypeDisplay = (type: EmailType) => {
    const availableType = availableTypes.find(t => t.type === type)
    return availableType || {
      type,
      name: emailTypeLabels[type],
      description: ''
    }
  }

  if (loading) {
    return (
      <View flex={1} alignItems="center" justifyContent="center" padding="$4">
        <Spinner size="large" color={colors.primary} />
        <Text marginTop="$2" color={colors.textSecondary}>
          Loading email schedules...
        </Text>
      </View>
    )
  }

  return (
    <View flex={1} backgroundColor={colors.background}>
      <ScrollView>
        <YStack padding="$4" gap="$4">
          {/* Header */}
          <View>
            <H2 color={colors.textPrimary}>Schedule Emails to Send</H2>
            <Text color={colors.textSecondary}>
              Manage automated email scheduling for community communications
            </Text>
          </View>

          {/* Queue Summary */}
          {queueSummary && (
            <Card backgroundColor={colors.backgroundSecondary} padding="$4">
              <H3 color={colors.textPrimary} marginBottom="$3">
                Email Queue Status
              </H3>
              <XStack gap="$4" flexWrap="wrap">
                <View alignItems="center">
                  <Text fontSize="$5" fontWeight="700" color={colors.warning}>
                    {queueSummary.ready}
                  </Text>
                  <Text fontSize="$2" color={colors.textSecondary}>
                    Ready to Send
                  </Text>
                </View>
                {queueSummary.processing > 0 && (
                  <View alignItems="center">
                    <Text fontSize="$5" fontWeight="700" color={colors.info}>
                      {queueSummary.processing}
                    </Text>
                    <Text fontSize="$2" color={colors.textSecondary}>
                      Processing
                    </Text>
                  </View>
                )}
                <View alignItems="center">
                  <Text fontSize="$5" fontWeight="700" color={colors.success}>
                    {queueSummary.complete}
                  </Text>
                  <Text fontSize="$2" color={colors.textSecondary}>
                    Completed
                  </Text>
                </View>
                <View alignItems="center">
                  <Text fontSize="$5" fontWeight="700" color={colors.error}>
                    {queueSummary.failed}
                  </Text>
                  <Text fontSize="$2" color={colors.textSecondary}>
                    Failed
                  </Text>
                </View>
              </XStack>
            </Card>
          )}

          {/* Schedule Cards */}
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <H3 color={colors.textPrimary}>Email Schedules</H3>
              <Button
                size="$3"
                onPress={handleCreate}
                backgroundColor={colors.primary}
                icon={Mail}
                hoverStyle={{
                  backgroundColor: colors.primary,
                  opacity: 0.9,
                }}
                pressStyle={{
                  backgroundColor: colors.primary,
                  opacity: 0.8,
                }}
              >
                <Text color={colors.primaryForeground}>Create New Schedule</Text>
              </Button>
            </XStack>
            {schedules.map((schedule, index) => {
              const typeStats = queueSummary?.byType[schedule.emailType]
              const statusColor = typeStats ? getStatusColor(typeStats.ready, typeStats.processing, typeStats.failed) : colors.textSecondary

              return (
                <Card
                  key={`${schedule.emailType}-${schedule.dayOfWeek}-${schedule.time}-${index}`}
                  backgroundColor={colors.backgroundSecondary}
                  padding="$4"
                  borderLeftWidth={4}
                  borderLeftColor={schedule.enabled ? colors.primary : colors.border}
                >
                  <XStack justifyContent="space-between" alignItems="flex-start">
                    <YStack flex={1} gap="$2">
                      <XStack alignItems="center" gap="$2">
                        <Mail size={20} color={colors.primary} />
                        <Text fontSize="$5" fontWeight="600" color={colors.textPrimary}>
                          {emailTypeLabels[schedule.emailType]}
                        </Text>
                        {schedule.testMode && (
                          <View
                            backgroundColor={colors.warning}
                            paddingHorizontal="$2"
                            paddingVertical="$1"
                            borderRadius="$2"
                          >
                            <Text fontSize="$2" color={colors.background} fontWeight="600">
                              TEST MODE
                            </Text>
                          </View>
                        )}
                      </XStack>

                      <XStack gap="$4" flexWrap="wrap">
                        <XStack alignItems="center" gap="$1">
                          <Calendar size={16} color={colors.textSecondary} />
                          <Text color={colors.textSecondary}>
                            {dayLabels[schedule.dayOfWeek]}
                          </Text>
                        </XStack>
                        <XStack alignItems="center" gap="$1">
                          <Clock size={16} color={colors.textSecondary} />
                          <Text color={colors.textSecondary}>
                            {formatTime(schedule.time)}
                          </Text>
                        </XStack>
                        {typeStats && (
                          <XStack alignItems="center" gap="$1">
                            <Users size={16} color={statusColor} />
                            <Text color={statusColor}>
                              {typeStats.ready} ready{typeStats.processing > 0 ? `, ${typeStats.processing} processing` : ''}, {typeStats.complete} sent
                            </Text>
                          </XStack>
                        )}
                      </XStack>

                      {schedule.description && (
                        <Text color={colors.textSecondary} fontSize="$3">
                          {schedule.description}
                        </Text>
                      )}
                    </YStack>

                    <XStack gap="$3" alignItems="center">
                      {/* Enable/Disable Toggle */}
                      <YStack alignItems="center" gap="$1">
                        <Text fontSize="$2" color={colors.textSecondary} textAlign="center">
                          {schedule.enabled ? 'Auto Send: On' : 'Auto Send: Off'}
                        </Text>
                        <Switch
                          checked={schedule.enabled}
                          onCheckedChange={() => toggleSchedule(schedule.emailType)}
                          size="$4"
                          backgroundColor={schedule.enabled ? colors.success : colors.backgroundTertiary}
                          borderWidth={1}
                          borderColor={schedule.enabled ? colors.success : colors.border}
                        >
                          <Switch.Thumb
                            backgroundColor={colors.background}
                            borderWidth={1}
                            borderColor={schedule.enabled ? colors.success : colors.textSecondary}
                            animation="bouncy"
                          />
                        </Switch>
                      </YStack>
                      <Button
                        size="$3"
                        circular
                        icon={Edit}
                        onPress={() => handleEdit(schedule.emailType)}
                        backgroundColor={colors.backgroundTertiary}
                        borderColor={colors.border}
                        borderWidth={1}
                        hoverStyle={{
                          backgroundColor: colors.backgroundSecondary,
                          borderColor: colors.textSecondary,
                        }}
                        pressStyle={{
                          backgroundColor: colors.backgroundSecondary,
                          opacity: 0.8,
                        }}
                      />
                      <Button
                        size="$3"
                        circular
                        icon={Trash2}
                        onPress={() => handleDelete(schedule)}
                        backgroundColor={colors.backgroundTertiary}
                        borderColor={colors.border}
                        borderWidth={1}
                        hoverStyle={{
                          backgroundColor: colors.error,
                          borderColor: colors.error,
                        }}
                        pressStyle={{
                          backgroundColor: colors.error,
                          opacity: 0.8,
                        }}
                      />
                    </XStack>
                  </XStack>
                </Card>
              )
            })}
          </YStack>
        </YStack>
      </ScrollView>

      {/* Edit/Create Schedule Sheet */}
      <Sheet
        modal
        open={editing !== null || creating}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setEditing(null)
            setCreating(false)
            setEditForm({})
            setError(null)
          }
        }}
        snapPoints={[90]}
        position={0}
      >
        <Sheet.Overlay />
        <Sheet.Frame backgroundColor={colors.backgroundSecondary} padding="$4">
          <YStack gap="$4">
            <H3 color={colors.textPrimary}>
              {creating ? 'Create New Schedule' : `Edit ${editing ? emailTypeLabels[editing] : ''} Schedule`}
            </H3>

            {error && (
              <View
                backgroundColor={colors.error}
                padding="$3"
                borderRadius="$2"
              >
                <Text color={colors.primaryForeground} fontSize="$3">
                  {error}
                </Text>
              </View>
            )}

            <YStack gap="$3">
              {/* Email Type Display/Selector */}
              <View>
                <Text color={colors.textPrimary} marginBottom="$2">
                  Email Type {!creating && <Text color={colors.textSecondary}>(cannot be changed)</Text>}
                </Text>
                {creating ? (
                  <XStack gap="$2" flexWrap="wrap">
                    {availableTypes.map((type) => (
                      <Button
                        key={type.type}
                        size="$3"
                        onPress={() => setEditForm({ ...editForm, emailType: type.type as EmailType })}
                        backgroundColor={
                          editForm.emailType === type.type ? colors.primary : colors.backgroundTertiary
                        }
                        borderColor={editForm.emailType === type.type ? colors.primary : colors.border}
                        borderWidth={1}
                        paddingHorizontal="$3"
                        hoverStyle={{
                          backgroundColor: editForm.emailType === type.type ? colors.primary : colors.backgroundSecondary,
                          borderColor: editForm.emailType === type.type ? colors.primary : colors.textSecondary,
                          opacity: 0.9,
                        }}
                        pressStyle={{
                          backgroundColor: editForm.emailType === type.type ? colors.primary : colors.backgroundSecondary,
                          opacity: 0.8,
                        }}
                      >
                        <YStack alignItems="center">
                          <Text
                            color={
                              editForm.emailType === type.type
                                ? colors.primaryForeground
                                : colors.textPrimary
                            }
                            fontWeight="600"
                          >
                            {type.name}
                          </Text>
                          {editForm.emailType === type.type && type.description && (
                            <Text
                              fontSize="$2"
                              color={colors.primaryForeground}
                              opacity={0.8}
                              textAlign="center"
                            >
                              {type.description}
                            </Text>
                          )}
                        </YStack>
                      </Button>
                    ))}
                  </XStack>
                ) : (
                  // Read-only display when editing
                  <View
                    backgroundColor={colors.backgroundTertiary}
                    padding="$3"
                    borderRadius="$3"
                    borderWidth={1}
                    borderColor={colors.border}
                  >
                    <XStack alignItems="center" gap="$2">
                      <Mail size={20} color={colors.primary} />
                      <YStack>
                        <Text fontSize="$4" fontWeight="600" color={colors.textPrimary}>
                          {editing && getEmailTypeDisplay(editing).name}
                        </Text>
                        {editing && getEmailTypeDisplay(editing).description && (
                          <Text fontSize="$2" color={colors.textSecondary}>
                            {getEmailTypeDisplay(editing).description}
                          </Text>
                        )}
                      </YStack>
                    </XStack>
                  </View>
                )}
                {creating && !editForm.emailType && (
                  <Text fontSize="$2" color={colors.error} marginTop="$2">
                    Please select an email type
                  </Text>
                )}
              </View>

              <View>
                <Text color={colors.textPrimary} marginBottom="$2">
                  Day of Week
                </Text>
                <XStack gap="$2" flexWrap="wrap">
                  {daysOfWeek.map((day) => (
                    <Button
                      key={day}
                      size="$3"
                      onPress={() => setEditForm({ ...editForm, dayOfWeek: day })}
                      backgroundColor={
                        editForm.dayOfWeek === day ? colors.primary : colors.backgroundTertiary
                      }
                      borderColor={editForm.dayOfWeek === day ? colors.primary : colors.border}
                      borderWidth={1}
                      hoverStyle={{
                        backgroundColor: editForm.dayOfWeek === day ? colors.primary : colors.backgroundSecondary,
                        borderColor: editForm.dayOfWeek === day ? colors.primary : colors.textSecondary,
                        opacity: 0.9,
                      }}
                      pressStyle={{
                        backgroundColor: editForm.dayOfWeek === day ? colors.primary : colors.backgroundSecondary,
                        opacity: 0.8,
                      }}
                    >
                      <Text
                        color={
                          editForm.dayOfWeek === day
                            ? colors.primaryForeground
                            : colors.textPrimary
                        }
                      >
                        {dayLabels[day]}
                      </Text>
                    </Button>
                  ))}
                </XStack>
              </View>

              <View>
                <Text color={colors.textPrimary} marginBottom="$2">
                  Time (24-hour format)
                </Text>
                <Input
                  value={editForm.time || ''}
                  onChangeText={(text: string) => setEditForm({ ...editForm, time: text })}
                  placeholder="17:00"
                  backgroundColor={colors.background}
                  borderColor={colors.border}
                />
              </View>

              <View>
                <Text color={colors.textPrimary} marginBottom="$2">
                  Description
                </Text>
                <Input
                  value={editForm.description || ''}
                  onChangeText={(text: string) => setEditForm({ ...editForm, description: text })}
                  placeholder="Email description"
                  backgroundColor={colors.background}
                  borderColor={colors.border}
                />
              </View>

              <XStack alignItems="center" justifyContent="space-between">
                <YStack>
                  <Text color={colors.textPrimary}>Test Mode</Text>
                  <Text fontSize="$2" color={colors.textSecondary}>
                    {editForm.testMode ? 'Test Mode: On' : 'Test Mode: Off'}
                  </Text>
                </YStack>
                <Switch
                  checked={editForm.testMode || false}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, testMode: checked })}
                  size="$4"
                  backgroundColor={editForm.testMode ? colors.info : colors.backgroundTertiary}
                  borderWidth={1}
                  borderColor={editForm.testMode ? colors.info : colors.border}
                >
                  <Switch.Thumb
                    backgroundColor={colors.background}
                    borderWidth={1}
                    borderColor={editForm.testMode ? colors.info : colors.textSecondary}
                    animation="bouncy"
                  />
                </Switch>
              </XStack>
            </YStack>

            <XStack gap="$3" justifyContent="flex-end">
              <Button
                onPress={() => {
                  setEditing(null)
                  setCreating(false)
                  setEditForm({})
                  setError(null)
                }}
                backgroundColor={colors.backgroundTertiary}
                borderColor={colors.border}
                borderWidth={1}
                disabled={saving}
                hoverStyle={{
                  backgroundColor: colors.backgroundSecondary,
                  borderColor: colors.textSecondary,
                }}
                pressStyle={{
                  backgroundColor: colors.backgroundSecondary,
                  opacity: 0.8,
                }}
              >
                <Text color={colors.textPrimary}>Cancel</Text>
              </Button>
              <Button
                onPress={handleSave}
                backgroundColor={colors.primary}
                disabled={saving}
                opacity={saving ? 0.6 : 1}
                hoverStyle={{
                  backgroundColor: colors.primary,
                  opacity: 0.9,
                }}
                pressStyle={{
                  backgroundColor: colors.primary,
                  opacity: 0.8,
                }}
              >
                {saving ? (
                  <XStack gap="$2" alignItems="center">
                    <Spinner size="small" color={colors.primaryForeground} />
                    <Text color={colors.primaryForeground}>{creating ? 'Creating...' : 'Saving...'}</Text>
                  </XStack>
                ) : (
                  <Text color={colors.primaryForeground}>{creating ? 'Create Schedule' : 'Save Schedule'}</Text>
                )}
              </Button>
            </XStack>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </View>
  )
}