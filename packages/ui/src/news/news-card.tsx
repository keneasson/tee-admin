'use client'

import React from 'react'
import { Card, H3, Paragraph, XStack, YStack } from 'tamagui'

export type NewsCardProps = {
  title: string
  body: string
  category?: 'medical' | 'general' | 'announcement'
  publishedAt: Date | string
  expiresAt?: Date | string
  expired?: boolean
  emailBlastSentAt?: Date | string
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
  title,
  body,
  category,
  publishedAt,
  expiresAt,
  expired = false,
  emailBlastSentAt,
  onPress,
}: NewsCardProps) {
  const snippet = body.length > 200 ? `${body.slice(0, 200)}…` : body

  return (
    <Card
      elevate
      padded
      bordered
      hoverStyle={onPress ? { borderColor: '$primary' } : undefined}
      cursor={onPress ? 'pointer' : undefined}
      onPress={onPress}
      opacity={expired ? 0.6 : 1}
    >
      <YStack gap="$2">
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
          <Paragraph fontSize="$2" color="$textSecondary">
            {formatDate(publishedAt)}
          </Paragraph>
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
        <H3>{title}</H3>
        <Paragraph whiteSpace="pre-wrap" numberOfLines={3}>
          {snippet}
        </Paragraph>
      </YStack>
    </Card>
  )
}
