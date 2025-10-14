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
import { Edit3 as Edit, Clock, Mail, Calendar, Users } from '@tamagui/lucide-icons'
import { EmailType, EmailSchedule, QueueSummary, DayOfWeek } from '@my/app/types/send-queue'

interface ScheduleEmailsProps {}

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
    emailType: 'memorial',
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
  memorial: 'Memorial Service',
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EmailType | null>(null)
  const [editForm, setEditForm] = useState<Partial<EmailSchedule>>({})

  useEffect(() => {
    loadSchedules()
    loadQueueSummary()
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

  const handleEdit = (emailType: EmailType) => {
    const schedule = schedules.find(s => s.emailType === emailType)
    if (schedule) {
      setEditForm(schedule)
      setEditing(emailType)
    }
  }

  const handleSave = async () => {
    if (!editing || !editForm) return

    try {
      setSaving(true)
      setError(null)

      // Validate form data
      if (!editForm.dayOfWeek || !editForm.time) {
        throw new Error('Day of week and time are required')
      }

      // Validate time format
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
      if (!timeRegex.test(editForm.time)) {
        throw new Error('Time must be in HH:MM format (24-hour)')
      }

      // Update via API
      const response = await fetch('/api/email-schedules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailType: editing, ...editForm }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save schedule')
      }

      // Reload schedules to get updated data
      await loadSchedules()
      setEditing(null)
      setEditForm({})
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save schedule')
      console.error('Failed to save schedule:', error)
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
            <H3 color={colors.textPrimary}>Email Schedules</H3>
            {schedules.map((schedule) => {
              const typeStats = queueSummary?.byType[schedule.emailType]
              const statusColor = typeStats ? getStatusColor(typeStats.ready, typeStats.processing, typeStats.failed) : colors.textSecondary

              return (
                <Card
                  key={schedule.emailType}
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
                        backgroundColor="transparent"
                        borderColor={colors.border}
                      />
                    </XStack>
                  </XStack>
                </Card>
              )
            })}
          </YStack>
        </YStack>
      </ScrollView>

      {/* Edit Schedule Sheet */}
      <Sheet
        modal
        open={editing !== null}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setEditing(null)
            setEditForm({})
          }
        }}
        snapPoints={[90]}
        position={0}
      >
        <Sheet.Overlay />
        <Sheet.Frame backgroundColor={colors.backgroundSecondary} padding="$4">
          <YStack gap="$4">
            <H3 color={colors.textPrimary}>
              Edit {editing ? emailTypeLabels[editing] : ''} Schedule
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
                        editForm.dayOfWeek === day ? colors.primary : 'transparent'
                      }
                      borderColor={colors.border}
                      borderWidth={1}
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
                  setEditForm({})
                  setError(null)
                }}
                backgroundColor="transparent"
                borderColor={colors.border}
                borderWidth={1}
                disabled={saving}
              >
                <Text color={colors.textPrimary}>Cancel</Text>
              </Button>
              <Button
                onPress={handleSave}
                backgroundColor={colors.primary}
                disabled={saving}
                opacity={saving ? 0.6 : 1}
              >
                {saving ? (
                  <XStack gap="$2" alignItems="center">
                    <Spinner size="small" color={colors.primaryForeground} />
                    <Text color={colors.primaryForeground}>Saving...</Text>
                  </XStack>
                ) : (
                  <Text color={colors.primaryForeground}>Save Schedule</Text>
                )}
              </Button>
            </XStack>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </View>
  )
}