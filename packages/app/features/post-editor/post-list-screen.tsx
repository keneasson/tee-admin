'use client'

/**
 * PostListScreen — the unified Post list (Consolidated CMS Phase 2c).
 *
 * Shared per ADR-0003: the list, its fetch, its sort and its duplicate action are
 * platform-agnostic. Auth state and navigation arrive as props; the Next.js route
 * is only a mount point.
 *
 * "New post" and each row navigate into the SAME editor screen (the one-editor
 * principle) — this screen is purely a list + entry point.
 */

import { useEffect, useState } from 'react'
import {
  YStack,
  XStack,
  Card,
  Text,
  Button,
  Paragraph,
  Spinner,
  LoadingState,
  PageHeader,
} from '@my/ui'
import { Plus, Copy } from '@tamagui/lucide-icons'
import { listPosts, duplicatePost } from '../../provider/get-data'
import type { Post } from '../../types/post'

function formatUpdatedAt(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_COLOR: Record<Post['status'], string> = {
  draft: '$yellow4',
  ready: '$green4',
  archived: '$gray4',
}

export interface PostListScreenProps {
  /** Platform auth state, passed down (never read from inside a package). */
  hasAccess: boolean
  isAuthLoading: boolean
  /** Platform navigation, passed down. */
  onOpenPost: (postId: string) => void
  onNewPost: () => void
}

export function PostListScreen({
  hasAccess,
  isAuthLoading,
  onOpenPost,
  onNewPost,
}: PostListScreenProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!hasAccess) return
    let cancelled = false
    setLoading(true)
    listPosts()
      .then((data) => {
        if (cancelled) return
        // Newest-edited first.
        const sorted = [...data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        setPosts(sorted)
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load posts')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [hasAccess])

  // Duplicate/replicate (Consolidated CMS epic #131): clone the post's
  // structure into a fresh draft, then jump straight into editing it.
  const handleDuplicate = async (postId: string) => {
    if (duplicatingId) return
    setDuplicatingId(postId)
    setErrorMessage(null)
    try {
      const draft = await duplicatePost(postId)
      onOpenPost(draft.id)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to duplicate post')
      setDuplicatingId(null)
    }
  }

  if (isAuthLoading || !hasAccess) return <LoadingState />

  return (
    <YStack padding="$4" gap="$4" maxWidth={900} alignSelf="center" width="100%">
      <PageHeader
        title="Posts"
        actions={
          <Button
            icon={<Plus size={16} />}
            backgroundColor="$primary"
            color="white"
            hoverStyle={{ backgroundColor: '$primaryHover' }}
            onPress={onNewPost}
          >
            New post
          </Button>
        }
      />

      {errorMessage ? <Paragraph color="$error">{errorMessage}</Paragraph> : null}

      {loading ? (
        <YStack alignItems="center" padding="$4">
          <Spinner size="small" width={20} height={20} />
        </YStack>
      ) : posts.length === 0 ? (
        <Paragraph color="$textSecondary">No posts yet — create the first one.</Paragraph>
      ) : (
        <YStack gap="$2">
          {posts.map((post) => (
            <Card
              key={post.id}
              bordered
              padding="$3"
              gap="$2"
              cursor="pointer"
              pressStyle={{ opacity: 0.8 }}
              hoverStyle={{ backgroundColor: '$backgroundHover' }}
              onPress={() => onOpenPost(post.id)}
            >
              <XStack justifyContent="space-between" alignItems="center" gap="$3">
                <Text fontSize="$5" fontWeight="600" flex={1} numberOfLines={1}>
                  {post.title || 'Untitled post'}
                </Text>
                <XStack
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$3"
                  backgroundColor={STATUS_COLOR[post.status] ?? '$gray4'}
                >
                  <Text fontSize="$2" fontWeight="600" textTransform="uppercase">
                    {post.status}
                  </Text>
                </XStack>
                <Button
                  size="$2"
                  variant="outlined"
                  icon={<Copy size={14} />}
                  disabled={duplicatingId === post.id}
                  aria-label={`Duplicate ${post.title || 'Untitled post'}`}
                  onPress={(e: any) => {
                    e.stopPropagation()
                    void handleDuplicate(post.id)
                  }}
                >
                  {duplicatingId === post.id ? 'Duplicating…' : 'Duplicate'}
                </Button>
              </XStack>

              <XStack justifyContent="space-between" alignItems="center" gap="$3" flexWrap="wrap">
                <XStack gap="$2" flexWrap="wrap">
                  {post.occasion.length === 0 ? (
                    <Text fontSize="$2" color="$color10">
                      No occasion tags
                    </Text>
                  ) : (
                    post.occasion.map((tag) => (
                      <XStack
                        key={tag}
                        paddingHorizontal="$2"
                        paddingVertical="$1"
                        borderRadius="$3"
                        backgroundColor="$blue4"
                      >
                        <Text fontSize="$2">{tag}</Text>
                      </XStack>
                    ))
                  )}
                </XStack>
                <Text fontSize="$2" color="$color10">
                  Updated {formatUpdatedAt(post.updatedAt)}
                </Text>
              </XStack>
            </Card>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
