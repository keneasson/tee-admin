'use client'

/**
 * /brand showcase for the document-canvas editor (Consolidated CMS Phase 2R-1
 * KEYSTONE). This is the DEV SURFACE — it mounts {@link PostDocEditor} on an
 * in-memory draft and shows a live "serialized blocks" JSON panel beside it, so
 * the doc ⇄ `Post.blocks[]` round-trip is visible as you type prose and drop in
 * Location widgets. Nothing is persisted; the live posts page and the old
 * block-form editor are untouched.
 */

import { useState } from 'react'
import { YStack, XStack, H2, H4, Paragraph, Separator, Text, Button } from '@my/ui'
import type { Block, LocationBlock, TextBlock } from '@my/app/types/post'
import { PostDocEditor } from './post-doc-editor'

// A small seed so the round-trip is visible immediately: prose → Location → prose.
function seedBlocks(): Block[] {
  const text = (body: string): TextBlock => ({
    id: `seed_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'text',
    body,
    containsPii: false,
  })
  const location: LocationBlock = {
    id: `seed_loc_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'location',
    mode: 'plain',
    label: 'Service',
    venueName: 'Toronto East Hall',
    city: 'Toronto',
    province: 'ON',
  }
  return [
    text('# Sunday Memorial Service\n\nAll are welcome to join us this week. Details below.'),
    location,
    text('Please arrive a few minutes early. **Lunch** will follow the service.'),
  ]
}

export function PostDocEditorShowcase() {
  const [seed, setSeed] = useState<Block[]>(seedBlocks)
  // `blocks` is the LIVE serialized view derived from the document on every edit.
  const [blocks, setBlocks] = useState<Block[]>(seed)
  // Remount key so "Reset" / "Empty" re-seed the (mount-once) editor state.
  const [editorKey, setEditorKey] = useState(0)

  const reseed = (next: Block[]) => {
    setSeed(next)
    setBlocks(next)
    setEditorKey((k) => k + 1)
  }

  return (
    <YStack padding="$4" gap="$4" maxWidth={1100} width="100%" alignSelf="center">
      <YStack gap="$2">
        <H2>Post Doc Editor (keystone)</H2>
        <Paragraph color="$color10">
          The Google-Docs / Notion redo of the block-form editor: write prose freely, then
          use the floating toolbar to ARM a tool and click in the document to drop a
          structured element inline as a form-widget. Structured underneath, freeform on
          top — the same unified Post model, a new authoring container. Location is wired
          for the keystone; the other tools are stubbed for 2R-2.
        </Paragraph>
        <XStack gap="$2">
          <Button size="$3" variant="outlined" onPress={() => reseed(seedBlocks())}>
            Reset draft
          </Button>
          <Button size="$3" variant="outlined" onPress={() => reseed([])}>
            Empty draft
          </Button>
        </XStack>
      </YStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={2} minWidth={420} gap="$2">
          <H4>Document canvas</H4>
          <PostDocEditor key={editorKey} initialBlocks={seed} onBlocksChange={setBlocks} />
        </YStack>

        <YStack flex={1} minWidth={300} gap="$2">
          <H4>Serialized blocks ({blocks.length})</H4>
          <Text fontSize="$2" color="$color10">
            Derived from the document via docToBlocks on every edit — the doc ⇄ blocks
            bijection.
          </Text>
          <YStack
            backgroundColor="$color2"
            borderColor="$borderColor"
            borderWidth={1}
            borderRadius="$3"
            padding="$3"
          >
            <Text fontSize="$2">{JSON.stringify(blocks, null, 2)}</Text>
          </YStack>
        </YStack>
      </XStack>

      <Separator />
      <Text fontSize="$2" color="$color10">
        Keystone / showcase only — the live posts page and the existing block-form editor
        are unchanged. Wiring this editor into /admin/posts/[id] is a later slice.
      </Text>
    </YStack>
  )
}
