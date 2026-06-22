'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, H1, Paragraph, Spinner, Text, XStack, YStack } from '@my/ui'
import { ArrowLeft, FileText } from '@tamagui/lucide-icons'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import type { NewsItem } from '@my/app/types/news'

export default function NewsDetailPage() {
  const isHydrated = useHydrated()
  const router = useRouter()
  const params = useParams<{ newsId: string }>()
  const newsId = params?.newsId
  const [item, setItem] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!newsId) return
    let cancelled = false
    fetch(`/api/news/${newsId}`)
      .then((r) => {
        if (r.status === 404) throw new Error('News item not found')
        if (!r.ok) throw new Error('Failed to load news')
        return r.json()
      })
      .then((data) => {
        if (!cancelled) setItem(data)
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
  }, [newsId])

  if (!isHydrated || loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
      </YStack>
    )
  }

  if (error || !item) {
    return (
      <YStack padding="$4" gap="$4" maxWidth={800} alignSelf="center" width="100%">
        <Button
          icon={<ArrowLeft size={16} />}
          variant="outlined"
          alignSelf="flex-start"
          onPress={() => router.push('/news')}
        >
          Back to News
        </Button>
        <Paragraph color="$error">{error || 'News item not found'}</Paragraph>
      </YStack>
    )
  }

  return (
    <YStack padding="$4" gap="$4" maxWidth={800} alignSelf="center" width="100%">
      <Button
        icon={<ArrowLeft size={16} />}
        variant="outlined"
        alignSelf="flex-start"
        hoverStyle={{ borderColor: '$textSecondary' }}
        onPress={() => router.push('/news')}
      >
        Back to News
      </Button>

      <H1>{item.title}</H1>

      <Paragraph whiteSpace="pre-wrap" lineHeight="$6">
        {item.body}
      </Paragraph>

      {/* Posters (images + PDFs) render inline; everything else (docs, Google
          Doc links) becomes a link. Type is derived from the mimeType — most
          posters arrive as PDFs. */}
      {(item.documents ?? [])
        .filter((doc) => doc.mimeType?.startsWith('image/'))
        .map((doc) => (
          <img
            key={doc.id}
            src={doc.fileUrl}
            alt={doc.originalName || item.title}
            style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
          />
        ))}

      {(item.documents ?? [])
        .filter((doc) => doc.mimeType === 'application/pdf')
        .map((doc) => (
          <YStack key={doc.id} gap="$2">
            <iframe
              src={doc.fileUrl}
              title={doc.originalName || 'Poster'}
              style={{ width: '100%', height: '80vh', minHeight: 600, border: 0, borderRadius: 8 }}
            />
            <a
              href={doc.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none' }}
            >
              <XStack gap="$2" alignItems="center">
                <FileText size={16} color="$primary" />
                <Text color="$primary">Open {doc.originalName || 'PDF'} in a new tab</Text>
              </XStack>
            </a>
          </YStack>
        ))}

      {(item.documents ?? []).some(
        (doc) => !doc.mimeType?.startsWith('image/') && doc.mimeType !== 'application/pdf'
      ) ? (
        <YStack gap="$2" marginTop="$2">
          {(item.documents ?? [])
            .filter((doc) => !doc.mimeType?.startsWith('image/') && doc.mimeType !== 'application/pdf')
            .map((doc) => (
              <a
                key={doc.id}
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <XStack
                  gap="$2"
                  alignItems="center"
                  padding="$3"
                  borderWidth={1}
                  borderColor="$borderColor"
                  borderRadius="$4"
                  hoverStyle={{ borderColor: '$primary' }}
                >
                  <FileText size={18} color="$primary" />
                  <Text color="$primary">{doc.originalName || 'Attachment'}</Text>
                </XStack>
              </a>
            ))}
        </YStack>
      ) : null}
    </YStack>
  )
}
