'use client'

import React, { useEffect, useState } from 'react'
import { H1, Paragraph, Spinner, YStack } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { NewsPublicCard } from '@my/ui/src/news/news-public-card'
import type { NewsItem } from '@my/app/types/news'

export default function NewsListPage() {
  const isHydrated = useHydrated()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
            <NewsPublicCard
              key={item.id}
              id={item.id}
              title={item.title}
              body={item.body}
            />
          ))}
        </YStack>
      )}
    </YStack>
  )
}
