'use client'

import { YStack, PostView } from '@my/ui'
import type { Post } from '@my/app/types/post'

/**
 * Thin client wrapper that provides the page layout around {@link PostView}.
 * The server page does the read + redaction and passes an already-REDACTED post;
 * this only supplies the centered content column (Tamagui components must render
 * in a client boundary).
 */
export function PostViewScreen({ post }: { post: Post }) {
  return (
    <YStack flex={1} padding="$4" alignItems="center">
      <PostView post={post} />
    </YStack>
  )
}
