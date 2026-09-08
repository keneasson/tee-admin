'use client'

/**
 * TimePicker — the progressive Date/Time widget for the document-canvas editor
 * (Consolidated CMS 2R-2). Minimal by default (a date + a time), progressive for
 * the rest — the time analogue of the Location resolver's "resolve first, disclose
 * details later" intention.
 *
 * THE DATES ARE THE DATA. `startsAt`/`endsAt` are what the lifecycle engine
 * sorts posts by and expires them on (`resolvePostNextDate`). A DESCRIBED time
 * has no `startsAt`, so it contributes no happening at all: the post cannot be
 * ordered by event date and never expires when the event ends — it falls back to
 * a flat window from publish, which is exactly the class of bug that made a
 * shower notice expire before the shower. So real dates are the default and the
 * free-text field is an explicit, warned escape hatch.
 *
 *   • Start and END are both first-class and always visible. Most posts are a
 *     single non-recurring date RANGE ("Sept 18–20"); hiding the end behind a
 *     disclosure made that unexpressible.
 *   • Times are OPTIONAL. Plenty of events simply run until they are done, so a
 *     date with no time is a first-class answer, not an incomplete one.
 *   • Timezone and reminders stay behind "More" — they have sensible defaults.
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
  const [showMore, setShowMore] = useState(false)

  const start = utcToWallParts(block.startsAt, tz)
  const end = utcToWallParts(block.endsAt, tz)

  const setStart = (date: string, time: string) => {
    if (!date) {
      onChange({ ...block, startsAt: undefined })
      return
    }
    onChange({ ...block, startsAt: wallTimeToUtc(combineWall(date, time), tz), display: undefined })
  }

  const setEnd = (date: string, time: string) => {
    if (!date) {
      onChange({ ...block, endsAt: undefined })
      return
    }
    onChange({ ...block, endsAt: wallTimeToUtc(combineWall(date, time), tz) })
  }

  const toggleReminder = (value: ReminderOffset) => {
    const current = block.remind ?? ['eve-of']
    const next = current.includes(value)
      ? current.filter((r) => r !== value)
      : [...current, value]
    onChange({ ...block, remind: next })
  }

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <Clock size={14} />
        <Text fontSize="$4" fontWeight="700">
          When is it?
        </Text>
      </XStack>

      {mode === 'precise' ? (
        <YStack gap="$3">
          {/* START — date required, time optional. */}
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Starts
            </Text>
            <XStack gap="$2">
              <input
                type="date"
                aria-label="Start date"
                style={{ ...nativeField, flex: 1.4 }}
                value={start.date}
                onChange={(e) => setStart(e.target.value, start.time)}
              />
              <input
                type="time"
                aria-label="Start time (optional)"
                style={{ ...nativeField, flex: 1 }}
                value={start.time}
                onChange={(e) => setStart(start.date, e.target.value)}
              />
            </XStack>
          </YStack>

          {/* END — first-class, not hidden. A multi-day range is the common case. */}
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Ends
            </Text>
            <XStack gap="$2">
              <input
                type="date"
                aria-label="End date"
                style={{ ...nativeField, flex: 1.4 }}
                value={end.date}
                onChange={(e) => setEnd(e.target.value, end.time)}
              />
              <input
                type="time"
                aria-label="End time (optional)"
                style={{ ...nativeField, flex: 1 }}
                value={end.time}
                onChange={(e) => setEnd(end.date, e.target.value)}
              />
            </XStack>
          </YStack>

          <Text fontSize="$2" color="$color10">
            Leave a time blank if it just runs until it is done.
          </Text>

          <Button
            size="$2"
            chromeless
            justifyContent="flex-start"
            onPress={() => {
              setMode('text')
              onChange({ ...block, startsAt: undefined, endsAt: undefined })
            }}
          >
            Can&apos;t pin a date? Describe it instead →
          </Button>
        </YStack>
      ) : (
        <YStack gap="$2">
          <Input
            value={block.display ?? ''}
            onChangeText={(t) => onChange({ ...block, display: t || undefined })}
            placeholder="e.g. 7:30pm every Wednesday"
          />
          {/* The cost of describing rather than dating, stated where it is paid. */}
          <Text fontSize="$2" color="$orange10">
            A described time can&apos;t be sorted with other posts, and won&apos;t
            clear itself once the event is over.
          </Text>
          <Button
            size="$2"
            chromeless
            justifyContent="flex-start"
            onPress={() => {
              setMode('precise')
              onChange({ ...block, display: undefined })
            }}
          >
            ← Use real dates
          </Button>
        </YStack>
      )}

      <Separator />

      <Button
        size="$2"
        chromeless
        justifyContent="flex-start"
        icon={showMore ? ChevronDown : ChevronRight}
        onPress={() => setShowMore((v) => !v)}
      >
        More (timezone, reminders)
      </Button>

      {showMore ? (
        <YStack gap="$3" paddingLeft="$2">
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
              const on = (block.remind ?? ['eve-of']).includes(r.value)
              return (
                <Button
                  key={r.value}
                  size="$2"
                  chromeless
                  justifyContent="flex-start"
                  icon={on ? CheckSquare : Square}
                  onPress={() => toggleReminder(r.value)}
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
