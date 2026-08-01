'use client'

import { useState } from 'react'
import { YStack, XStack, H2, Paragraph, Separator, Button, Text } from '@my/ui'
import { PostEditor, createEmptyPost } from '../post-editor'
import type { Post } from '@my/app/types/post'

/**
 * /brand showcase for the PostEditor (Consolidated CMS Phase 2a).
 *
 * The primary dev surface for the block editor, per design §3.1 ("showcased in
 * isolation in /brand"). Holds an in-memory draft Post and drives the editor via
 * the `value` / `onChange` contract only — no persistence, no data fetching — so
 * the module can be developed and reviewed in isolation. The live JSON panel is
 * the proof the editor mutates ONLY through that contract.
 */
export function PostEditorShowcase() {
  const [post, setPost] = useState<Post>(() =>
    createEmptyPost('demo-ecclesia', 'showcase@tee-admin.com')
  )

  return (
    <YStack padding="$4" gap="$4" maxWidth={860} width="100%" alignSelf="center">
      <YStack gap="$2">
        <H2>Post Editor</H2>
        <Paragraph color="$color10">
          One editor for create AND edit. This mounts an in-memory empty draft — the
          exact same component that edits a loaded post. Controlled via value/onChange
          only; nothing is persisted here.
        </Paragraph>
        <XStack>
          <Button
            size="$3"
            variant="outlined"
            onPress={() => setPost(createEmptyPost('demo-ecclesia', 'showcase@tee-admin.com'))}
          >
            Reset draft
          </Button>
        </XStack>
      </YStack>

      <PostEditor
        value={post}
        onChange={setPost}
        onPublish={(p) => {
          // Showcase only — surface the publish payload, do not persist.
          // eslint-disable-next-line no-console
          console.log('[PostEditorShowcase] publish', p)
        }}
      />

      <Separator />

      <YStack gap="$2">
        <Text fontSize="$3" fontWeight="600">
          Live Post value (the value/onChange contract)
        </Text>
        <YStack
          backgroundColor="$color2"
          borderColor="$borderColor"
          borderWidth={1}
          borderRadius="$3"
          padding="$3"
        >
          <Text fontSize="$2">{JSON.stringify(post, null, 2)}</Text>
        </YStack>
      </YStack>
    </YStack>
  )
}
