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
import type { Block, FlyerBlock, LocationBlock, TextBlock } from '@my/app/types/post'
import { PostDocEditor } from './post-doc-editor'

const text = (body: string): TextBlock => ({
  id: `seed_${Math.random().toString(36).slice(2, 8)}`,
  kind: 'text',
  body,
  containsPii: false,
})

// A small seed so the round-trip is visible immediately: prose → Location → prose.
function seedBlocks(): Block[] {
  const location: LocationBlock = {
    id: `seed_loc_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'location',
    mode: 'plain',
    label: 'Service',
    venueName: 'Toronto East Hall',
    city: 'Toronto',
    province: 'ON',
  }
  const flyer: FlyerBlock = {
    id: `seed_fly_${Math.random().toString(36).slice(2, 8)}`,
    kind: 'flyer',
    document: {
      id: 'seed-doc',
      documentType: 'upload',
      fileName: 'android-chrome-512x512.png',
      originalName: 'Event flyer',
      fileUrl: '/android-chrome-512x512.png',
      fileSize: 0,
      mimeType: 'image/png',
      uploadedAt: new Date(0),
      uploadedBy: 'seed',
    },
  }
  return [
    text('# Sunday Memorial Service\n\nAll are welcome to join us this week. Details below.'),
    location,
    text('Please arrive a few minutes early. **Lunch** will follow the service.'),
    flyer,
    text('_Click the image above to resize, rotate, or annotate it — Google-Docs style._'),
  ]
}

// A raw-email-style blob (as if pasted) — pure prose, no widgets yet. Select the
// venue phrase and click Location in the toolbar to CONVERT the selection into a
// seeded resolver that immediately tries to match it against the directory.
function pasteBlobBlocks(): Block[] {
  return [
    text(
      'From: bro. Smith\n\nDear all, our combined study weekend will be held at ' +
        'Toronto East Ecclesial Hall starting Saturday at 10am. Lunch provided. ' +
        'Please let the arranging brother know if you can attend.'
    ),
  ]
}

export function PostDocEditorShowcase() {
  const [seed, setSeed] = useState<Block[]>(seedBlocks)
  // `blocks` is the LIVE serialized view derived from the document on every edit.
  const [blocks, setBlocks] = useState<Block[]>(seed)
  // Remount key so "Reset" / "Empty" re-seed the (mount-once) editor state.
  const [editorKey, setEditorKey] = useState(0)

  // Second, independent editor for the paste-and-distil convert-selection demo.
  const [pasteSeed, setPasteSeed] = useState<Block[]>(pasteBlobBlocks)
  const [pasteBlocks, setPasteBlocks] = useState<Block[]>(pasteSeed)
  const [pasteKey, setPasteKey] = useState(0)

  const reseed = (next: Block[]) => {
    setSeed(next)
    setBlocks(next)
    setEditorKey((k) => k + 1)
  }

  const resetPaste = () => {
    const next = pasteBlobBlocks()
    setPasteSeed(next)
    setPasteBlocks(next)
    setPasteKey((k) => k + 1)
  }

  return (
    <YStack padding="$4" gap="$4" maxWidth={1100} width="100%" alignSelf="center">
      <YStack gap="$2">
        <H2>Post Doc Editor (keystone)</H2>
        <Paragraph color="$color10">
          The Google-Docs / Notion redo of the block-form editor. The document is the
          FINAL version — a Location reads exactly as it will in the published post, no
          forms, no inline metadata. Write prose freely; ARM a tool from the floating
          toolbar and click to drop a structured element (it lands as its final display).
          Hover any element for its editor-space affordance, then "Edit this location" to
          open its editor in the FLOATING tool — the form lives in the tool, never in the
          doc. Location is wired for the keystone; the other tools are stubbed for 2R-2.
        </Paragraph>
        <Paragraph color="$color10">
          The Location widget is a PROGRESSIVE RESOLVER (2R-1b), not a form: type ~2–4
          characters to autocomplete against our ecclesia directory and pick a match (it
          becomes a compact resolved chip); with no internal match you can search Google
          Places (disabled until a key is configured) or "use as plain text". Directions /
          parking / online-meeting hide behind "Add details". Try it two ways below.
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

      {/* Demo 2 — paste-and-distil convert-selection. */}
      <YStack gap="$2">
        <H4>Paste-and-distil: convert a selection</H4>
        <Paragraph color="$color10">
          Below is a raw email pasted as prose (Lexical's default paste). SELECT the phrase{' '}
          <Text fontWeight="700">Toronto East Ecclesial Hall</Text> in the text, then click{' '}
          <Text fontWeight="700">Location</Text> in the floating toolbar. The selection is
          replaced by a Location resolver SEEDED with that text — it immediately tries to
          resolve it against the directory. (With only a caret and no selection, arming a
          tool then clicking drops a BLANK resolver instead — the original behavior.)
        </Paragraph>
        <XStack gap="$2">
          <Button size="$3" variant="outlined" onPress={resetPaste}>
            Reset email blob
          </Button>
        </XStack>
      </YStack>

      <XStack gap="$4" flexWrap="wrap" alignItems="flex-start">
        <YStack flex={2} minWidth={420} gap="$2">
          <H4>Pasted email</H4>
          <PostDocEditor key={pasteKey} initialBlocks={pasteSeed} onBlocksChange={setPasteBlocks} />
        </YStack>
        <YStack flex={1} minWidth={300} gap="$2">
          <H4>Serialized blocks ({pasteBlocks.length})</H4>
          <YStack
            backgroundColor="$color2"
            borderColor="$borderColor"
            borderWidth={1}
            borderRadius="$3"
            padding="$3"
          >
            <Text fontSize="$2">{JSON.stringify(pasteBlocks, null, 2)}</Text>
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
