'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, XStack, Card, Text, Spinner, Heading, Button, Paragraph } from '@my/ui'
import { Plus } from '@tamagui/lucide-icons'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { listPosts } from '@my/app/provider/get-data'
import type { Post } from '@my/app/types/post'

/**
 * /admin/posts — the unified Post list (Consolidated CMS Phase 2c).
 *
 * Flag-gated the same way as the editor and its API: the page mirrors the
 * other /admin/(admin-plus) list pages' admin-access gate, and the underlying
 * `GET /api/admin/posts` 404s outright when CONSOLIDATED_CMS is off — so an
 * un-flagged admin sees a load error here, not partial functionality.
 *
 * "New post" and each row navigate via route (`/admin/posts/new` |
 * `/admin/posts/{id}`) into the SAME `<PostEditor>` page (the one-editor
 * principle) — this page is purely a list + entry point.
 */
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

export default function AdminPostsPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading } = useAdminAccess()
  const router = useRouter()

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  return (
    <YStack padding="$4" gap="$4" maxWidth={900} alignSelf="center" width="100%">
      <XStack justifyContent="space-between" alignItems="center" gap="$3">
        <Heading size="$8">Posts</Heading>
        <Button
          icon={<Plus size={16} />}
          backgroundColor="$primary"
          color="white"
          hoverStyle={{ backgroundColor: '$primaryHover' }}
          onPress={() => router.push('/admin/posts/new')}
        >
          New post
        </Button>
      </XStack>

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
              onPress={() => router.push(`/admin/posts/${post.id}`)}
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
