'use client'

/**
 * RegistrationEditor — the PROGRESSIVE Registration widget for the document-canvas
 * editor (Consolidated CMS 2R-2). Minimal up front (is it required? a link? a
 * deadline?), everything else behind "Add details" — the Location/Time "resolve
 * first, disclose later" spirit.
 *
 *   • Up front: a "Registration required?" toggle, a registration link (a bare
 *     domain is normalized on blur, like the Link widget) and a deadline date.
 *   • Add details: fee (toggle → amount + payment instructions), contact
 *     (email / phone), free-text notes, and newsletter deadline reminders.
 *
 * Web-only (native date input); the pure fee/deadline conversions live in
 * {@link registration-resolve.ts} and the URL normalizer in {@link link-resolve.ts}
 * (both unit-tested there).
 */

import { useState } from 'react'
import { YStack, XStack, Text, Button, Input, TextArea, Separator } from '@my/ui'
import {
  ClipboardCheck,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
} from '@tamagui/lucide-icons'
import type { ReminderOffset, RegistrationBlock } from '@my/app/types/post'
import { DEFAULT_TIMEZONE } from '@my/app/utils/timezone'
import { normalizeUrl } from './link-resolve'
import {
  deadlineDateToIso,
  formatFee,
  isoToDeadlineDate,
  parseFee,
} from './registration-resolve'

export interface RegistrationEditorProps {
  block: RegistrationBlock
  onChange: (next: RegistrationBlock) => void
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
  { value: 'eve-of', label: 'The Thursday before the deadline' },
  { value: 'week-before', label: 'A week earlier too' },
]

export function RegistrationEditor({ block, onChange }: RegistrationEditorProps) {
  const [showDetails, setShowDetails] = useState(false)
  // Local fee text so a mid-typing "25." isn't clobbered by the parsed number.
  const [feeText, setFeeText] = useState(() => formatFee(block.fee))
  const tz = DEFAULT_TIMEZONE

  const required = block.required ?? false
  const hasFee = block.hasFee ?? false
  const deadlineDate = isoToDeadlineDate(block.deadline, tz)

  const setDeadline = (date: string) =>
    onChange({ ...block, deadline: deadlineDateToIso(date, tz) })

  const setFee = (text: string) => {
    setFeeText(text)
    onChange({ ...block, fee: parseFee(text) })
  }

  const toggleRemind = (v: ReminderOffset) => {
    const set = new Set(block.remindDeadline ?? [])
    if (set.has(v)) set.delete(v)
    else set.add(v)
    const next = Array.from(set)
    onChange({ ...block, remindDeadline: next.length ? next : undefined })
  }

  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$2">
        <ClipboardCheck size={16} color="$color10" />
        <Text fontSize="$2" fontWeight="600" color="$color11">
          Registration
        </Text>
      </XStack>

      <Button
        size="$2"
        chromeless
        justifyContent="flex-start"
        icon={required ? CheckSquare : Square}
        theme={required ? 'blue' : undefined}
        onPress={() => onChange({ ...block, required: !required })}
      >
        Registration required
      </Button>

      <YStack gap="$1">
        <Text fontSize="$2" fontWeight="600" color="$color11">
          Registration link
        </Text>
        <Input
          value={block.registrationUrl ?? ''}
          onChangeText={(t) => onChange({ ...block, registrationUrl: t || undefined })}
          onBlur={() => {
            const normalized = normalizeUrl(block.registrationUrl ?? '')
            if (normalized !== (block.registrationUrl ?? '')) {
              onChange({ ...block, registrationUrl: normalized || undefined })
            }
          }}
          placeholder="example.com/register or https://…"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
        />
      </YStack>

      <YStack gap="$1">
        <Text fontSize="$2" fontWeight="600" color="$color11">
          Deadline (optional)
        </Text>
        <input
          type="date"
          style={nativeField}
          value={deadlineDate}
          onChange={(e) => setDeadline(e.target.value)}
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
        Add details (fee, contact, notes, reminders)
      </Button>

      {showDetails ? (
        <YStack gap="$3" paddingLeft="$2">
          {/* Fee */}
          <YStack gap="$2">
            <Button
              size="$2"
              chromeless
              justifyContent="flex-start"
              icon={hasFee ? CheckSquare : Square}
              theme={hasFee ? 'blue' : undefined}
              onPress={() => onChange({ ...block, hasFee: !hasFee })}
            >
              There is a fee
            </Button>
            {hasFee ? (
              <YStack gap="$2" paddingLeft="$2">
                <YStack gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$color11">
                    Amount
                  </Text>
                  <Input
                    value={feeText}
                    onChangeText={setFee}
                    placeholder="e.g. 25"
                    keyboardType="decimal-pad"
                    inputMode="decimal"
                  />
                </YStack>
                <YStack gap="$1">
                  <Text fontSize="$2" fontWeight="600" color="$color11">
                    Payment instructions
                  </Text>
                  <TextArea
                    value={block.paymentInstructions ?? ''}
                    onChangeText={(t) =>
                      onChange({ ...block, paymentInstructions: t || undefined })
                    }
                    placeholder="How to pay (e-transfer, at the door, etc.)"
                  />
                </YStack>
              </YStack>
            ) : null}
          </YStack>

          {/* Contact */}
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Contact email
            </Text>
            <Input
              value={block.contactEmail ?? ''}
              onChangeText={(t) => onChange({ ...block, contactEmail: t || undefined })}
              placeholder="Who to ask — shown to members"
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
          </YStack>
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Contact phone
            </Text>
            <Input
              value={block.contactPhone ?? ''}
              onChangeText={(t) => onChange({ ...block, contactPhone: t || undefined })}
              placeholder="Optional — shown to members"
              autoCapitalize="none"
            />
          </YStack>

          {/* Notes */}
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Notes
            </Text>
            <TextArea
              value={block.notes ?? ''}
              onChangeText={(t) => onChange({ ...block, notes: t || undefined })}
              placeholder="Anything else registrants should know"
            />
          </YStack>

          {/* Deadline reminders */}
          <YStack gap="$1">
            <Text fontSize="$2" fontWeight="600" color="$color11">
              Remind before the deadline
            </Text>
            {REMINDERS.map((r) => {
              const on = (block.remindDeadline ?? []).includes(r.value)
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
