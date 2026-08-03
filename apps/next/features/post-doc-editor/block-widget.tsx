'use client'

/**
 * BlockWidget — the React form-widget a {@link PostBlockNode} decorates the
 * canvas with. It REUSES the existing Tamagui block editors from packages/ui
 * (apps → packages is allowed): for the keystone it mounts the real
 * {@link LocationBlockEditor}, so a Location dropped into the document shows its
 * fields as a clear inline form embedded in the prose flow. Editing a field calls
 * the editor's `onChange`, which writes the full next block back onto the Lexical
 * node via `setBlock` — the data model, lifecycle, redaction and rendering are
 * all untouched; this is purely a container swap for the *authoring* experience.
 *
 * The other block kinds are handled by the same registry the block-form editor
 * uses, so 2R-2 lights them up by flipping their tool to `enabled`.
 */

import { useCallback } from 'react'
import { $getNodeByKey, type NodeKey } from 'lexical'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { YStack, XStack, Text, Button } from '@my/ui'
import { Trash2, MapPin } from '@tamagui/lucide-icons'
import type { Block, LocationBlock } from '@my/app/types/post'
import { LocationBlockEditor } from '@my/ui/src/post-editor/blocks/location-block-editor'
import { $isPostBlockNode } from './post-block-node'

export interface BlockWidgetProps {
  nodeKey: NodeKey
  block: Block
}

export function BlockWidget({ nodeKey, block }: BlockWidgetProps) {
  const [editor] = useLexicalComposerContext()

  const update = useCallback(
    (next: Block) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)
        if ($isPostBlockNode(node)) node.setBlock(next)
      })
    },
    [editor, nodeKey]
  )

  const remove = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      node?.remove()
    })
  }, [editor, nodeKey])

  return (
    // Native wrapper with contentEditable=false so the form controls inside this
    // Lexical decorator receive their own focus/selection instead of the editor's.
    <div contentEditable={false} suppressContentEditableWarning>
      <YStack
        borderWidth={1}
        borderColor="$blue7"
        backgroundColor="$blue1"
        borderRadius="$4"
        padding="$3"
        marginVertical="$2"
        gap="$3"
      >
        <XStack justifyContent="space-between" alignItems="center">
        <XStack alignItems="center" gap="$2">
          <MapPin size={16} color="$blue10" />
          <Text fontSize="$3" fontWeight="700" color="$blue11">
            {labelForKind(block)}
          </Text>
        </XStack>
        <Button
          size="$2"
          theme="red"
          icon={Trash2}
          aria-label="Remove block"
          onPress={remove}
        >
          Remove
        </Button>
      </XStack>

        {block.kind === 'location' ? (
          <LocationBlockEditor block={block as LocationBlock} onChange={update} onRemove={remove} />
        ) : (
          <Text color="$color10">
            The "{block.kind}" widget lands in 2R-2. Only Location is wired for the keystone.
          </Text>
        )}
      </YStack>
    </div>
  )
}

function labelForKind(block: Block): string {
  switch (block.kind) {
    case 'location':
      return 'Location'
    default:
      return block.kind.charAt(0).toUpperCase() + block.kind.slice(1)
  }
}
