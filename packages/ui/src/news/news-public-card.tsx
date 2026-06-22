'use client'

import React from 'react'
import { Link } from 'solito/link'
import { Card, H3, XStack, YStack } from 'tamagui'
import { MarkdownLiteText } from '../markdown-lite-text'

export type NewsPublicCardProps = {
  id: string
  title: string
  body: string
  /** Optional poster preview (image URL or PDF page-1 thumbnail). */
  previewImageUrl?: string
}

export function NewsPublicCard({ id, title, body, previewImageUrl }: NewsPublicCardProps) {
  return (
    <Link href={`/news/${id}`}>
      <Card
        elevate
        padded
        bordered
        hoverStyle={{ borderColor: '$primary' }}
        cursor="pointer"
      >
        <XStack gap="$3" flexWrap="wrap">
          {previewImageUrl ? (
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
          <YStack flex={1} minWidth={200}>
            <H3
              color="$primary"
              hoverStyle={{ textDecorationLine: 'underline' }}
              marginBottom="$2"
            >
              {title}
            </H3>
            <MarkdownLiteText text={body} color="$color" />
          </YStack>
        </XStack>
      </Card>
    </Link>
  )
}
