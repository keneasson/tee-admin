'use client'

import React from 'react'
import { Link } from 'solito/link'
import { Card, H3, Paragraph, Text, XStack, YStack } from 'tamagui'
import { MarkdownLiteText } from '../markdown-lite-text'

export type NewsCardVariant = 'admin' | 'public'

export type NewsCardProps = {
  /** 'admin' = management list (metadata + tap-to-edit). 'public' = reader list (thumbnail + Read more). */
  variant?: NewsCardVariant
  title: string
  body: string
  /** Required by the 'public' variant — used to link the title / "Read more" to the detail page. */
  id?: string
  /** Poster preview (image URL or PDF page-1 thumbnail). 'public' variant only. */
  previewImageUrl?: string
  category?: 'medical' | 'general' | 'announcement'
  publishedAt?: Date | string
  expiresAt?: Date | string
  expired?: boolean
  emailBlastSentAt?: Date | string
  /** Tap handler for the 'admin' variant (opens the editor). */
  onPress?: () => void
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const CATEGORY_LABELS: Record<NonNullable<NewsCardProps['category']>, string> = {
  medical: 'Medical',
  general: 'General',
  announcement: 'Announcement',
}

export function NewsCard({
  variant = 'admin',
  title,
  body,
  id,
  previewImageUrl,
  category,
  publishedAt,
  expiresAt,
  expired = false,
  emailBlastSentAt,
  onPress,
}: NewsCardProps) {
  const isPublic = variant === 'public'
  const href = id ? `/news/${id}` : undefined

  return (
    <Card
      elevate
      padded
      bordered
      hoverStyle={onPress || isPublic ? { borderColor: '$primary' } : undefined}
      cursor={onPress ? 'pointer' : undefined}
      onPress={isPublic ? undefined : onPress}
      opacity={expired ? 0.6 : 1}
    >
      <XStack gap="$3" flexWrap="wrap">
        {isPublic && previewImageUrl ? (
          <img
            src={previewImageUrl}
            alt=""
            style={{
              width: 96,
              height: 96,
              objectFit: 'cover',
              borderRadius: 8,
              flexShrink: 0,
            }}
          />
        ) : null}

        <YStack flex={1} minWidth={200} gap="$2">
          {/* Admin metadata: category / dates / alert badge */}
          {!isPublic ? (
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              {category ? (
                <Paragraph
                  fontSize="$2"
                  fontWeight="600"
                  color="$primary"
                  textTransform="uppercase"
                  letterSpacing={0.5}
                >
                  {CATEGORY_LABELS[category]}
                </Paragraph>
              ) : null}
              {publishedAt ? (
                <Paragraph fontSize="$2" color="$textSecondary">
                  {formatDate(publishedAt)}
                </Paragraph>
              ) : null}
              {expired ? (
                <Paragraph fontSize="$2" color="$textTertiary" fontStyle="italic">
                  (expired)
                </Paragraph>
              ) : expiresAt ? (
                <Paragraph fontSize="$2" color="$textTertiary">
                  until {formatDate(expiresAt)}
                </Paragraph>
              ) : null}
              {emailBlastSentAt ? (
                <Paragraph fontSize="$2" color="$info">
                  alert sent
                </Paragraph>
              ) : null}
            </XStack>
          ) : null}

          {/* Title — linked on the public variant, plain on admin */}
          {isPublic && href ? (
            <Link href={href} style={{ textDecoration: 'none' }}>
              <H3 color="$primary" hoverStyle={{ textDecorationLine: 'underline' }}>
                {title}
              </H3>
            </Link>
          ) : (
            <H3>{title}</H3>
          )}

          {/* Body preview (markdown-lite, clamped) — identical on both variants */}
          <MarkdownLiteText text={body} inline numberOfLines={3} color="$color" />

          {/* Public "Read more" affordance */}
          {isPublic && href ? (
            <Link href={href} style={{ textDecoration: 'none' }}>
              <Text
                fontSize="$3"
                color="$primary"
                fontWeight="600"
                hoverStyle={{ textDecorationLine: 'underline' }}
              >
                Read more →
              </Text>
            </Link>
          ) : null}
        </YStack>
      </XStack>
    </Card>
  )
}
