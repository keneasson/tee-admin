import { YStack, XStack, Label, Input, TextArea } from 'tamagui'
import type { RegistrationBlock } from '@my/app/types/post'
import type { BlockEditorProps } from '../registry'
import { genId } from '../post-reducer'
import { PlainCheckbox } from '../plain-checkbox'

/**
 * RegistrationBlock editor — every field the {@link RegistrationBlock}
 * interface declares: required flag, deadline, URL, contact email/phone, a
 * fee toggle (+ fee amount / payment instructions when set), and notes.
 * `contactEmail`/`contactPhone` are `pii:'contact'` (gated by the redactor at
 * read time); the editor just captures them.
 *
 * Deadline is a plain `YYYY-MM-DD` text input, matching the TimeBlock
 * editor's 2b-safe convention (no native date picker yet).
 */
export function makeRegistrationBlock(): RegistrationBlock {
  return { id: genId(), kind: 'registration' }
}

export function RegistrationBlockEditor({ block, onChange }: BlockEditorProps<RegistrationBlock>) {
  return (
    <YStack gap="$3">
      <PlainCheckbox
        checked={block.required ?? false}
        onCheckedChange={(required) => onChange({ ...block, required })}
        label="Registration required"
      />

      <XStack gap="$4" flexWrap="wrap">
        <YStack minWidth={200} flex={1} gap="$2">
          <Label htmlFor={`${block.id}-deadline`} fontSize="$3" fontWeight="600">
            Registration deadline
          </Label>
          <Input
            id={`${block.id}-deadline`}
            value={block.deadline ?? ''}
            onChangeText={(deadline) => onChange({ ...block, deadline: deadline || undefined })}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
        </YStack>

        <YStack minWidth={220} flex={1} gap="$2">
          <Label htmlFor={`${block.id}-url`} fontSize="$3" fontWeight="600">
            Registration URL
          </Label>
          <Input
            id={`${block.id}-url`}
            value={block.registrationUrl ?? ''}
            onChangeText={(registrationUrl) => onChange({ ...block, registrationUrl })}
            placeholder="https://…"
            autoCapitalize="none"
          />
        </YStack>
      </XStack>

      <XStack gap="$4" flexWrap="wrap">
        <YStack minWidth={200} flex={1} gap="$2">
          <Label htmlFor={`${block.id}-email`} fontSize="$3" fontWeight="600">
            Contact email
          </Label>
          <Input
            id={`${block.id}-email`}
            value={block.contactEmail ?? ''}
            onChangeText={(contactEmail) => onChange({ ...block, contactEmail })}
            placeholder="name@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </YStack>
        <YStack minWidth={200} flex={1} gap="$2">
          <Label htmlFor={`${block.id}-phone`} fontSize="$3" fontWeight="600">
            Contact phone
          </Label>
          <Input
            id={`${block.id}-phone`}
            value={block.contactPhone ?? ''}
            onChangeText={(contactPhone) => onChange({ ...block, contactPhone })}
            placeholder="Phone number"
            keyboardType="phone-pad"
          />
        </YStack>
      </XStack>

      <PlainCheckbox
        checked={block.hasFee ?? false}
        onCheckedChange={(hasFee) => onChange({ ...block, hasFee })}
        label="Has a registration fee"
      />

      {block.hasFee ? (
        <YStack gap="$3" paddingLeft="$4">
          <YStack minWidth={160} maxWidth={200} gap="$2">
            <Label htmlFor={`${block.id}-fee`} fontSize="$3" fontWeight="600">
              Fee
            </Label>
            <Input
              id={`${block.id}-fee`}
              value={block.fee !== undefined ? String(block.fee) : ''}
              onChangeText={(v) => {
                const fee = v.trim() === '' ? undefined : Number(v)
                onChange({ ...block, fee: fee !== undefined && Number.isNaN(fee) ? undefined : fee })
              }}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </YStack>

          <YStack gap="$2">
            <Label htmlFor={`${block.id}-payment`} fontSize="$3" fontWeight="600">
              Payment instructions
            </Label>
            <TextArea
              id={`${block.id}-payment`}
              value={block.paymentInstructions ?? ''}
              onChangeText={(paymentInstructions) => onChange({ ...block, paymentInstructions })}
              placeholder="How to pay the registration fee"
              minHeight={60}
              numberOfLines={2}
            />
          </YStack>
        </YStack>
      ) : null}

      <YStack gap="$2">
        <Label htmlFor={`${block.id}-notes`} fontSize="$3" fontWeight="600">
          Additional notes
        </Label>
        <TextArea
          id={`${block.id}-notes`}
          value={block.notes ?? ''}
          onChangeText={(notes) => onChange({ ...block, notes })}
          placeholder="Special instructions"
          minHeight={60}
          numberOfLines={2}
        />
      </YStack>
    </YStack>
  )
}
