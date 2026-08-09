'use client'

import React, { useEffect, useState } from 'react'
import { H1, Paragraph, PostView, Spinner, YStack } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { NewsCard } from '@my/ui/src/news/news-card'
import type { NewsItem } from '@my/app/types/news'
import type { Post } from '@my/app/types/post'
import { getPreviewImageUrl } from '@my/app/types/events'

export default function NewsListPage() {
  const isHydrated = useHydrated()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Consolidated CMS #131 (Phase 4b-1): native, news-shaped Posts surfaced
  // ADDITIVELY. Empty when the CONSOLIDATED_CMS flag is OFF (server returns
  // `{ news: [] }`), so the section below renders nothing and the legacy list
  // above is byte-identical to today.
  const [nativeNews, setNativeNews] = useState<Post[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/news')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load news')
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Additive, flag-gated native Posts. Isolated from the legacy fetch above so a
  // failure here can never affect the existing news list.
  useEffect(() => {
    let cancelled = false
    fetch('/api/posts/public')
      .then((r) => (r.ok ? r.json() : { news: [] }))
      .then((data) => {
        if (!cancelled) setNativeNews(Array.isArray(data?.news) ? data.news : [])
      })
      .catch(() => {
        /* additive surface — ignore, leave native section empty */
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!isHydrated) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
      </YStack>
    )
  }

  return (
    <YStack padding="$4" gap="$4" maxWidth={900} alignSelf="center" width="100%">
      <H1>News</H1>

      {loading ? (
        <YStack alignItems="center" padding="$4">
          <Spinner size="small" width={20} height={20} />
        </YStack>
      ) : error ? (
        <Paragraph color="$error">{error}</Paragraph>
      ) : items.length === 0 ? (
        <Paragraph color="$textSecondary">No news at this time.</Paragraph>
      ) : (
        <YStack gap="$3">
          {items.map((item) => (
            <NewsCard
              key={item.id}
              variant="public"
              id={item.id}
              title={item.title}
              body={item.body}
              previewImageUrl={getPreviewImageUrl(item.documents)}
            />
          ))}
        </YStack>
      )}

      {/* Native Posts (Consolidated CMS #131) — a clearly-labelled section rather
          than interleaved: legacy news uses compact NewsCards while native posts
          render the full read-only PostView, so keeping them distinct reads far
          cleaner than mixing the two inline. Skipped entirely when the flag is
          OFF (empty array). */}
      {nativeNews.length > 0 ? (
        <YStack gap="$4">
          {nativeNews.map((post) => (
            <PostView key={post.id} post={post} />
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}
