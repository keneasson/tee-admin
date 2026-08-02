import { YStack, XStack, Label, Text, Input } from 'tamagui'
import type { ReminderOffset, TimeBlock } from '@my/app/types/post'
import type { BlockEditorProps } from '../registry'
import { genId } from '../post-reducer'
import { PlainSelect } from '../plain-select'
import { PlainCheckbox } from '../plain-checkbox'
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
  formatScheduleDateTime,
} from '@my/app/utils/timezone'

/**
 * TimeBlock editor — the second of the two hardest shapes. A time is what makes
 * a post "event-shaped" (a future `startsAt` drives the event facet; design §6).
 *
 * The stored value is ALWAYS UTC (`startsAt`, ISO-8601) with an IANA `timezone`
 * — the codebase's storage convention (see utils/timezone.ts). The input edits a
 * wall-clock date/time IN the selected timezone; we convert wall-clock⇄UTC here
 * so what the author types in Toronto is stored as the correct instant. Display
 * below is rendered via the shared `formatScheduleDateTime`.
 *
 * 2a keeps a plain text `YYYY-MM-DDTHH:mm` input for cross-platform safety (a
 * native date/time picker is 2b/2c polish). Fully controlled.
 */
export function makeTimeBlock(): TimeBlock {
  return { id: genId(), kind: 'time', label: '', timezone: DEFAULT_TIMEZONE }
}

/** Wall-clock 'YYYY-MM-DDTHH:mm' in `timeZone` → UTC ISO instant. */
function wallTimeToUtc(local: string, timeZone: string): string | undefined {
  if (!local) return undefined
  // Treat the wall-clock string as if it were UTC, then subtract the zone's
  // offset at that instant to get the true UTC instant.
  const asUtc = new Date(`${local}:00Z`)
  if (Number.isNaN(asUtc.getTime())) return undefined
  const inZone = new Date(asUtc.toLocaleString('en-US', { timeZone }))
  const inUtc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offset = inZone.getTime() - inUtc.getTime()
  return new Date(asUtc.getTime() - offset).toISOString()
}

/** UTC ISO instant → wall-clock 'YYYY-MM-DDTHH:mm' in `timeZone` (for the input). */
function utcToWallTime(iso: string | undefined, timeZone: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/**
 * `remind` unset ⇒ defaults to eve-of only (post-lifecycle.ts DEFAULT_TIME_REMINDERS).
 * Once the author touches either checkbox we always write an explicit array —
 * including `[]` if they uncheck everything, which the engine honours as "no
 * reminders" (does NOT fall back to the default; see post-lifecycle.ts).
 */
function toggleReminderOffset(
  current: ReminderOffset[] | undefined,
  offset: ReminderOffset,
  checked: boolean
): ReminderOffset[] {
  const effective = current ?? ['eve-of']
  return checked
    ? Array.from(new Set([...effective, offset]))
    : effective.filter((o) => o !== offset)
}

export function TimeBlockEditor({ block, onChange }: BlockEditorProps<TimeBlock>) {
  const timezone = block.timezone || DEFAULT_TIMEZONE
  const wallValue = utcToWallTime(block.startsAt, timezone)
  const effectiveRemind = block.remind ?? ['eve-of']

  const preview = block.startsAt
    ? formatScheduleDateTime({
        dateTime: block.startsAt,
        eventTimezone: timezone,
        userTimezone: timezone,
      }).fullDisplay
    : ''

  return (
    <YStack gap="$3">
      <YStack gap="$2">
        <Label htmlFor={`${block.id}-label`} fontSize="$3" fontWeight="600">
          Label
        </Label>
        <Input
          id={`${block.id}-label`}
          value={block.label ?? ''}
          onChangeText={(label) => onChange({ ...block, label })}
          placeholder="e.g. Service, Baptism, Reception"
        />
      </YStack>

      <XStack gap="$4" flexWrap="wrap">
        <YStack gap="$2" minWidth={220} flex={1}>
          <Label htmlFor={`${block.id}-starts`} fontSize="$3" fontWeight="600">
            Starts (local wall time)
          </Label>
          <Input
            id={`${block.id}-starts`}
            value={wallValue}
            onChangeText={(local) =>
              onChange({ ...block, startsAt: wallTimeToUtc(local, timezone) })
            }
            placeholder="YYYY-MM-DDTHH:mm"
            autoCapitalize="none"
          />
        </YStack>

        <YStack minWidth={200} flex={1}>
          <PlainSelect
            id={`${block.id}-tz`}
            label="Timezone"
            value={timezone}
            options={TIMEZONE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))}
            onValueChange={(tz) => {
              // Keep the same wall-clock instant the author sees; re-derive the
              // UTC value against the newly chosen zone.
              const next = block.startsAt ? wallTimeToUtc(wallValue, tz) : block.startsAt
              onChange({ ...block, timezone: tz, startsAt: next })
            }}
          />
        </YStack>
      </XStack>

      {preview ? (
        <Text fontSize="$2" color="$color10">
          Stored UTC: {block.startsAt} · Shows as: {preview}
        </Text>
      ) : (
        <Text fontSize="$2" color="$color10">
          Enter a date/time (24-hour). Stored in UTC; shown in the chosen timezone.
        </Text>
      )}

      <YStack gap="$1">
        <Label fontSize="$3" fontWeight="600">
          Reminders
        </Label>
        <PlainCheckbox
          checked={effectiveRemind.includes('eve-of')}
          onCheckedChange={(checked) =>
            onChange({ ...block, remind: toggleReminderOffset(block.remind, 'eve-of', checked) })
          }
          label="Remind the day-of week (Thursday before the event)"
        />
        <PlainCheckbox
          checked={effectiveRemind.includes('week-before')}
          onCheckedChange={(checked) =>
            onChange({
              ...block,
              remind: toggleReminderOffset(block.remind, 'week-before', checked),
            })
          }
          label="Remind the week before the event"
        />
      </YStack>
    </YStack>
  )
}
