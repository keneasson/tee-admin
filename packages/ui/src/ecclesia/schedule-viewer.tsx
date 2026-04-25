import { useState, useEffect, useCallback } from 'react'
import { YStack, XStack, Text, Card, Spinner } from '@my/ui'
import { Button } from '../Button'
import { Calendar, RefreshCw } from '@tamagui/lucide-icons'
import type {
  ScheduleTypeKey,
} from '@my/app/config/schedule-fields'
import { SCHEDULE_TYPE_KEYS, mergeWithCatalogue } from '@my/app/config/schedule-fields'

interface ScheduleEntry {
  date: string
  type: ScheduleTypeKey
  data: Record<string, string>
}

interface ResolvedConfig {
  enabled: boolean
  label: string
  fields: Array<{ key: string; label: string; enabled: boolean }>
}

interface ScheduleViewerProps {
  ecclesiaName: string
  /** Raw scheduleConfig from the ecclesia record (may be undefined/partial) */
  scheduleConfig?: Record<string, any>
}

/**
 * Read-only schedule table for any ecclesia.
 * Renders only the tabs and fields configured for this ecclesia.
 * No editing — just a clean, simple table.
 */
export function ScheduleViewer({ ecclesiaName, scheduleConfig }: ScheduleViewerProps) {
  const config = mergeWithCatalogue(scheduleConfig)
  const enabledTypes = SCHEDULE_TYPE_KEYS.filter(k => config[k].enabled)

  const [activeType, setActiveType] = useState<ScheduleTypeKey>(enabledTypes[0] || 'memorial')
  const [schedules, setSchedules] = useState<ScheduleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/ecclesia/${encodeURIComponent(ecclesiaName)}/schedule?type=${activeType}&days=60`
      )
      if (res.ok) {
        const data = await res.json()
        setSchedules(data.schedules || [])
      } else {
        setError('Failed to load schedule')
      }
    } catch {
      setError('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }, [ecclesiaName, activeType])

  useEffect(() => {
    if (enabledTypes.length > 0) {
      fetchSchedules()
    } else {
      setLoading(false)
    }
  }, [fetchSchedules, enabledTypes.length])

  // Keep activeType in sync if the enabled set changes
  useEffect(() => {
    if (enabledTypes.length > 0 && !enabledTypes.includes(activeType)) {
      setActiveType(enabledTypes[0])
    }
  }, [enabledTypes, activeType])

  if (enabledTypes.length === 0) {
    return null // No schedule tabs configured — don't render
  }

  const activeConfig: ResolvedConfig = config[activeType]
  const visibleFields = activeConfig.fields.filter(f => f.enabled)

  return (
    <Card padding="$4" borderWidth={1} borderColor="$borderColor">
      <YStack gap="$3">
        {/* Header */}
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center">
            <Calendar size={16} color="$blue10" />
            <Text fontSize="$5" fontWeight="600">Schedule</Text>
          </XStack>
          <Button size="$2" icon={RefreshCw} variant="outlined" onPress={fetchSchedules}>
            Refresh
          </Button>
        </XStack>

        {/* Tabs — only show enabled types */}
        {enabledTypes.length > 1 ? (
          <XStack gap="$2" flexWrap="wrap">
            {enabledTypes.map(typeKey => (
              <Button
                key={typeKey}
                size="$2"
                variant={activeType === typeKey ? undefined : 'outlined'}
                theme={activeType === typeKey ? 'blue' : undefined}
                onPress={() => setActiveType(typeKey)}
              >
                {config[typeKey].label}
              </Button>
            ))}
          </XStack>
        ) : null}

        {error ? (
          <Text fontSize="$3" color="$red10" textAlign="center" padding="$3">{error}</Text>
        ) : null}

        {/* Table */}
        {loading ? (
          <XStack justifyContent="center" padding="$4" gap="$2">
            <Spinner size="small" width={20} height={20} />
            <Text fontSize="$3" theme="alt2">Loading...</Text>
          </XStack>
        ) : schedules.length === 0 ? (
          <Text fontSize="$3" theme="alt2" textAlign="center" padding="$3">
            No {activeConfig.label.toLowerCase()} entries in the next 60 days.
          </Text>
        ) : (
          <YStack>
            {/* Table header */}
            <XStack
              paddingVertical="$2"
              paddingHorizontal="$3"
              backgroundColor="$gray3"
              borderTopLeftRadius="$2"
              borderTopRightRadius="$2"
            >
              <Text fontSize="$2" fontWeight="700" width={100} flexShrink={0}>Date</Text>
              {visibleFields.map(field => (
                <Text
                  key={field.key}
                  fontSize="$2"
                  fontWeight="700"
                  flex={1}
                  minWidth={80}
                >
                  {field.label}
                </Text>
              ))}
            </XStack>

            {/* Table rows */}
            {schedules.map((entry, i) => {
              const dateStr = new Date(entry.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })
              return (
                <XStack
                  key={`${entry.date}-${i}`}
                  paddingVertical="$2"
                  paddingHorizontal="$3"
                  borderBottomWidth={1}
                  borderColor="$borderColor"
                  backgroundColor={i % 2 === 0 ? '$background' : '$gray2'}
                >
                  <Text fontSize="$3" fontWeight="600" width={100} flexShrink={0}>{dateStr}</Text>
                  {visibleFields.map(field => (
                    <Text
                      key={field.key}
                      fontSize="$3"
                      flex={1}
                      minWidth={80}
                    >
                      {entry.data?.[field.key] || '—'}
                    </Text>
                  ))}
                </XStack>
              )
            })}
          </YStack>
        )}
      </YStack>
    </Card>
  )
}
