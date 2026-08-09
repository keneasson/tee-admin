'use client'

import { useState } from 'react'
import { YStack, XStack, H2, Paragraph, Separator, Button, Text } from '@my/ui'
import { PostEditor, createEmptyPost } from '../post-editor'
import { PostView } from '../post-view'
import { redactPost } from '@my/app/utils/redact-post'
import type { Viewer } from '@my/app/utils/viewer-pii'
import type { Post } from '@my/app/types/post'

// Author-tier viewer: the editing author sees their own full content while
// previewing (member tier reveals all PII), so the preview mirrors what a
// member reader would see rather than the redacted public view.
const AUTHOR_VIEWER: Viewer = {
  assurance: 'authenticated',
  role: 'member',
  tenant: 'demo-ecclesia',
  email: 'showcase@tee-admin.com',
}

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
  const [showPreview, setShowPreview] = useState(false)

  // Preview the current draft through the SAME redaction boundary the public
  // page uses, at author (member) tier so the author sees their full content.
  const previewPost = showPreview
    ? redactPost(post, AUTHOR_VIEWER, { channel: 'public-web' })
    : null

  return (
    <YStack padding="$4" gap="$4" maxWidth={860} width="100%" alignSelf="center">
      <YStack gap="$2">
        <H2>Post Editor</H2>
        <Paragraph color="$color10">
          One editor for create AND edit. This mounts an in-memory empty draft — the
          exact same component that edits a loaded post. Controlled via value/onChange
          only; nothing is persisted here.
        </Paragraph>
        <XStack gap="$2">
          <Button
            size="$3"
            variant="outlined"
            onPress={() => setPost(createEmptyPost('demo-ecclesia', 'showcase@tee-admin.com'))}
          >
            Reset draft
          </Button>
          <Button
            size="$3"
            theme={showPreview ? 'blue' : undefined}
            onPress={() => setShowPreview((prev) => !prev)}
          >
            {showPreview ? 'Hide preview' : 'Preview'}
          </Button>
        </XStack>
      </YStack>

      {showPreview ? (
        <YStack gap="$2">
          <Text fontSize="$3" fontWeight="600" color="$color10">
            Live preview (read-only, redacted at member tier)
          </Text>
          <YStack
            backgroundColor="$color1"
            borderColor="$borderColor"
            borderWidth={1}
            borderRadius="$3"
            padding="$4"
          >
            {previewPost ? (
              <PostView post={previewPost} />
            ) : (
              <Text color="$color10">Nothing to preview yet.</Text>
            )}
          </YStack>
          <Separator />
        </YStack>
      ) : null}

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
