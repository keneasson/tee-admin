'use client'

/**
 * TimePicker — the progressive Date/Time widget for the document-canvas editor
 * (Consolidated CMS 2R-2). Minimal by default (a date + a time), progressive for
 * the rest — the time analogue of the Location resolver's "resolve first, disclose
 * details later" intention.
 *
 *   • Precise mode (default): a date + time input. Stored as a UTC `startsAt` in
 *     the block's `timezone` (wall-clock⇄UTC in {@link time-resolve.ts}), so what
 *     the author types in Toronto is the correct instant across DST.
 *   • "Describe it instead": for recurring/fuzzy times, one free-text field writes
 *     `display` (e.g. "7:30pm every Wednesday") and clears the precise instant.
 *   • Add details: end time, timezone, and newsletter reminder offsets.
 *
 * Web-only (native date/time inputs); pure conversions are unit-tested in
 * {@link time-resolve.ts}.
 */

import { useState } from 'react'
import { YStack, XStack, Text, Input, Separator } from 'tamagui'
import { Button } from '../../Button'
import { Clock, CheckSquare, Square, ChevronDown, ChevronRight } from '@tamagui/lucide-icons'
import type { ReminderOffset, TimeBlock } from '@my/app/types/post'
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from '@my/app/utils/timezone'
import { combineWall, utcToWallParts, wallTimeToUtc } from '@my/app/features/post-editor/resolvers/time-resolve'

export interface TimePickerProps {
  block: TimeBlock
  onChange: (next: TimeBlock) => void
}

const nativeField: React.CSSProperties = {
  height: 38,
  padding: '0 10px',
  fontSize: 14,
  color: 'var(--color12)',
  background: 'var(--background)',
  border: '1px solid var(--borderColor)',
  borderRadius: 8,
  width: '100%',
  boxSizing: 'border-box',
}

const REMINDERS: Array<{ value: ReminderOffset; label: string }> = [
  { value: 'eve-of', label: 'The Thursday before' },
  { value: 'week-before', label: 'A week earlier too' },
]

export function TimePicker({ block, onChange }: TimePickerProps) {
  const tz = block.timezone || DEFAULT_TIMEZONE
  const [mode, setMode] = useState<'precise' | 'text'>(() =>
    block.display && !block.startsAt ? 'text' : 'precise'
  )
  const [showDetails, setShowDetails] = useState(false)

  const start = utcToWallParts(block.startsAt, tz)
  const end = utcToWallParts(block.endsAt, tz)

  const setStart = (date: string, time: string) => {
    // Writing a precise instant clears any free-text fallback.
    const startsAt = wallTimeToUtc(combineWall(date, time), tz)
    onChange({ ...block, startsAt, display: undefined })
  }
  const setEnd = (date: string, time: string) => {
    onChange({ ...block, endsAt: wallTimeToUtc(combineWall(date, time), tz) })
  }

  const toggleRemind = (v: ReminderOffset) => {
    const set = new Set(block.remind ?? [])
    if (set.has(v)) set.delete(v)
    else set.add(v)
    const next = Array.from(set)
    onChange({ ...block, remind: next.length ? next : undefined })
  }

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <Clock size={16} color="$color10" />
        <Text fontSize="$2" fontWeight="600" color="$color11">
          When is it?
        </Text>
      </XStack>

      {mode === 'precise' ? (
        <YStack gap="$2">
          <XStack gap="$2">
            <YStack flex={1.4} gap="$1">
              <Text fontSize="$2" color="$color11">
                Date
              </Text>
              <input
                type="date"
                style={nativeField}
                value={start.date}
                onChange={(e) => setStart(e.target.value, start.time)}
              />
            </YStack>
            <YStack flex={1} gap="$1">
              <Text fontSize="$2" color="$color11">
                Time
              </Text>
              <input
                type="time"
                style={nativeField}
                value={start.time}
                onChange={(e) => setStart(start.date, e.target.value)}
              />
            </YStack>
          </XStack>
          <Button
            size="$2"
            chromeless
            justifyContent="flex-start"
            onPress={() => {
              setMode('text')
              onChange({ ...block, startsAt: undefined, endsAt: undefined })
            }}
          >
            Can't pin an exact date? Describe it instead →
          </Button>
        </YStack>
      ) : (
        <YStack gap="$2">
          <Text fontSize="$2" color="$color11">
            Describe the time
          </Text>
          <Input
            value={block.display ?? ''}
            onChangeText={(t) => onChange({ ...block, display: t || undefined })}
            placeholder="e.g. 7:30pm every Wednesday"
          />
          <Button
            size="$2"
            chromeless
            justifyContent="flex-start"
            onPress={() => {
              setMode('precise')
              onChange({ ...block, display: undefined })
            }}
          >
            ← Use an exact date &amp; time
          </Button>
        </YStack>
      )}

      <YStack gap="$1">
        <Text fontSize="$2" color="$color11">
          Label (optional)
        </Text>
        <Input
          value={block.label ?? ''}
          onChangeText={(t) => onChange({ ...block, label: t || undefined })}
          placeholder="e.g. Service, Reception, Baptism"
        />
      </YStack>

      <Separator />
      <Button
        size="$2"
        chromeless
        icon={showDetails ? ChevronDown : ChevronRight}
        justifyContent="flex-start"
        onPress={() => setShowDetails((s) => !s)}
      >
        Add details (end time, timezone, reminders)
      </Button>

      {showDetails ? (
        <YStack gap="$3" paddingLeft="$2">
          {mode === 'precise' ? (
            <YStack gap="$1">
              <Text fontSize="$2" fontWeight="600" color="$color11">
                Ends (optional)
              </Text>
              <XStack gap="$2">
                <input
                  type="date"
                  style={{ ...nativeField, flex: 1.4 }}
                  value={end.date}
                  onChange={(e) => setEnd(e.target.value, end.time)}
                />
                <input
                  type="time"
                  style={{ ...nativeField, flex: 1 }}
                  value={end.time}
                  onChange={(e) => setEnd(end.date, e.target.value)}
                />
              </XStack>
            </YStack>
          ) : null}

          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Timezone
            </Text>
            <select
              style={nativeField}
              value={tz}
              onChange={(e) => onChange({ ...block, timezone: e.target.value })}
            >
              {TIMEZONE_OPTIONS.map((opt: { value: string; label: string }) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </YStack>

          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Send a reminder
            </Text>
            {REMINDERS.map((r) => {
              const on = (block.remind ?? []).includes(r.value)
              return (
                <Button
                  key={r.value}
                  size="$2"
                  chromeless
                  justifyContent="flex-start"
                  icon={on ? CheckSquare : Square}
                  theme={on ? 'blue' : undefined}
                  onPress={() => toggleRemind(r.value)}
                >
                  {r.label}
                </Button>
              )
            })}
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
