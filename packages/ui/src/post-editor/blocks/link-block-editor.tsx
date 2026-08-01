import { YStack, Label, Input } from 'tamagui'
import type { LinkBlock } from '@my/app/types/post'
import type { BlockEditorProps } from '../registry'
import { genId } from '../post-reducer'

/**
 * LinkBlock editor — the simplest shape: a URL with an optional display
 * label. Fully controlled.
 */
export function makeLinkBlock(): LinkBlock {
  return { id: genId(), kind: 'link', url: '' }
}

export function LinkBlockEditor({ block, onChange }: BlockEditorProps<LinkBlock>) {
  return (
    <YStack gap="$3">
      <YStack gap="$2">
        <Label htmlFor={`${block.id}-url`} fontSize="$3" fontWeight="600">
          URL
        </Label>
        <Input
          id={`${block.id}-url`}
          value={block.url}
          onChangeText={(url) => onChange({ ...block, url })}
          placeholder="https://…"
          autoCapitalize="none"
        />
      </YStack>

      <YStack gap="$2">
        <Label htmlFor={`${block.id}-label`} fontSize="$3" fontWeight="600">
          Label
        </Label>
        <Input
          id={`${block.id}-label`}
          value={block.label ?? ''}
          onChangeText={(label) => onChange({ ...block, label })}
          placeholder="Display text for the link"
        />
      </YStack>
    </YStack>
  )
}
