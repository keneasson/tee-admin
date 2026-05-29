'use client'

import React from 'react'
import Link from 'next/link'
import { Card, H3, Paragraph } from 'tamagui'

export type NewsPublicCardProps = {
  id: string
  title: string
  body: string
}

export function NewsPublicCard({ id, title, body }: NewsPublicCardProps) {
  return (
    <Link href={`/news/${id}`} style={{ textDecoration: 'none' }}>
      <Card
        elevate
        padded
        bordered
        hoverStyle={{ borderColor: '$primary' }}
        cursor="pointer"
      >
        <H3
          color="$primary"
          hoverStyle={{ textDecorationLine: 'underline' }}
          marginBottom="$2"
        >
          {title}
        </H3>
        <Paragraph whiteSpace="pre-wrap" color="$color">
          {body}
        </Paragraph>
      </Card>
    </Link>
  )
}
