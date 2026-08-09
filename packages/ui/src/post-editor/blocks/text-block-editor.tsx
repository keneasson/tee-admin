import { YStack, XStack, Label, Text, TextArea } from 'tamagui'
import type { TextBlock, Visibility } from '@my/app/types/post'
import type { BlockEditorProps } from '../registry'
import { genId } from '../post-reducer'
import { PlainSelect } from '../plain-select'
import { PlainCheckbox } from '../plain-checkbox'
import { BLOCK_VISIBILITY_OPTIONS, INHERIT_VISIBILITY } from '../options'

/**
 * TextBlock editor — one of the two hardest shapes (free prose that can hide
 * PII the redactor can't locate; design §5). Exposes:
 *  - a multiline markdown `body`,
 *  - a per-block `visibility` OVERRIDE (so an obituary/testimony paragraph can be
 *    pinned to `members` even on a public post), and
 *  - the `containsPii` author flag that drives the save-time warning.
 *
 * Fully controlled: emits the full next block via `onChange`.
 */
export function makeTextBlock(): TextBlock {
  return { id: genId(), kind: 'text', body: '', containsPii: false }
}

export function TextBlockEditor({ block, onChange }: BlockEditorProps<TextBlock>) {
  return (
    <YStack gap="$3">
      <YStack gap="$2">
        <Label htmlFor={`${block.id}-body`} fontSize="$3" fontWeight="600">
          Body (markdown)
        </Label>
        <TextArea
          id={`${block.id}-body`}
          value={block.body}
          onChangeText={(body) => onChange({ ...block, body })}
          placeholder="Write the text… supports # headings, **bold**, and links."
          minHeight={120}
          numberOfLines={5}
        />
      </YStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="flex-end">
        <YStack minWidth={200} flex={1}>
          <PlainSelect
            id={`${block.id}-visibility`}
            label="Visibility (this block)"
            value={block.visibility ?? INHERIT_VISIBILITY}
            options={BLOCK_VISIBILITY_OPTIONS}
            onValueChange={(v) =>
              onChange({
                ...block,
                visibility: v === INHERIT_VISIBILITY ? undefined : (v as Visibility),
              })
            }
          />
        </YStack>

        <YStack minHeight={44} justifyContent="center">
          <PlainCheckbox
            checked={block.containsPii}
            onCheckedChange={(checked) => onChange({ ...block, containsPii: checked })}
            label="This text mentions people (contains PII)"
          />
        </YStack>
      </XStack>

      {block.containsPii ? (
        <Text fontSize="$2" color="$orange10">
          Flagged as containing PII — consider a Person block, or keep this block members-only.
        </Text>
      ) : null}
    </YStack>
  )
}
