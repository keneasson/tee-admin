'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, H1, MarkdownLiteText, Paragraph, Spinner, Text, XStack, YStack } from '@my/ui'
import { ArrowLeft, Download, FileText } from '@tamagui/lucide-icons'
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

      <MarkdownLiteText text={item.body} lineHeight="$6" />

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

      {/* PDF posters: show the generated page-1 thumbnail with a caption +
          download link (like a mail attachment), not a full embedded viewer.
          Tapping the thumbnail or Download opens the PDF; the device decides
          whether to view or save it. */}
      {(item.documents ?? [])
        .filter((doc) => doc.mimeType === 'application/pdf')
        .map((doc) => (
          <YStack key={doc.id} gap="$2" maxWidth={220} marginTop="$2">
            <XStack gap="$2" alignItems="center" justifyContent="space-between">
              <Text fontSize="$3" color="$gray11">
                See attached poster
              </Text>
              <a
                href={doc.fileUrl}
                download={doc.originalName || true}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <XStack gap="$1" alignItems="center">
                  <Download size={15} color="$primary" />
                  <Text fontSize="$3" color="$primary">
                    Download
                  </Text>
                </XStack>
              </a>
            </XStack>

            {doc.thumbnailUrl ? (
              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={doc.thumbnailUrl}
                  alt={doc.originalName || 'Poster preview'}
                  style={{
                    width: '100%',
                    height: 'auto',
                    borderRadius: 8,
                    border: '1px solid #e5e5e5',
                    display: 'block',
                  }}
                />
              </a>
            ) : null}

            <XStack gap="$2" alignItems="center">
              <FileText size={14} color="$gray10" />
              <Text fontSize="$2" color="$gray10" numberOfLines={1}>
                PDF: {doc.originalName || 'poster.pdf'}
              </Text>
            </XStack>
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
