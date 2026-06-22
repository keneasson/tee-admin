'use client'

import React from 'react'
import { Anchor, Paragraph, Text, YStack } from 'tamagui'

/**
 * Light markdown renderer for web + native, kept in lock-step with the email
 * renderer (apps/email-builder/components/AutoLinkText.tsx) so the same source
 * text formats identically in emails and on screen. Supports:
 *   - `# / ## / ###` headings
 *   - `**bold**`
 *   - `- ` or `* ` bullet lists
 *   - bare URLs / www. links (auto-linked)
 *
 * Two modes:
 *   - block (default): full layout — headings, lists, paragraphs with breaks.
 *   - inline: everything flattened into one <Paragraph> (markers like # and the
 *     bullet glyph kept, lines joined) so `numberOfLines` truncation works for
 *     card previews.
 */

// Matches **bold** OR a URL (http(s):// or www.)
const INLINE_REGEX = /\*\*(.+?)\*\*|(?:https?:\/\/|www\.)[^\s<>[\]{}|\\^`"']+/gi
const HEADING_REGEX = /^(#{1,3})\s+(.+)$/
const BULLET_REGEX = /^\s*[-*]\s+(.+)$/

type AnyProps = Record<string, any>

/** Parse inline markers (**bold** and URLs) within a single line of text. */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  INLINE_REGEX.lastIndex = 0

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined) {
      parts.push(
        <Text key={`${keyPrefix}-b-${match.index}`} fontWeight="700">
          {match[1]}
        </Text>
      )
    } else {
      const url = match[0]
      const href = url.startsWith('www.') ? `https://${url}` : url
      parts.push(
        <Anchor
          key={`${keyPrefix}-a-${match.index}`}
          href={href}
          target="_blank"
          color="$primary"
          textDecorationLine="underline"
        >
          {url}
        </Anchor>
      )
    }

    lastIndex = INLINE_REGEX.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length > 0 ? parts : [text]
}

const HEADING_PROPS: Record<number, AnyProps> = {
  1: { fontSize: '$7', fontWeight: '700', marginTop: '$3', marginBottom: '$1' },
  2: { fontSize: '$6', fontWeight: '600', marginTop: '$2', marginBottom: '$1' },
  3: { fontSize: '$5', fontWeight: '600', marginTop: '$2', marginBottom: '$1' },
}

export type MarkdownLiteTextProps = {
  text: string
  /** Flatten to a single truncatable Paragraph (for card previews). */
  inline?: boolean
  /** Passed through to the underlying Text/Paragraph (fontSize, color, lineHeight, numberOfLines…). */
  [key: string]: any
}

export function MarkdownLiteText({ text, inline = false, ...textProps }: MarkdownLiteTextProps) {
  if (!text) return null

  const lines = text.split('\n')

  // Inline mode: one Paragraph, markers flattened, so numberOfLines clamps.
  if (inline) {
    const nodes: React.ReactNode[] = []
    lines.forEach((line, i) => {
      if (i > 0) nodes.push('\n')
      const heading = line.match(HEADING_REGEX)
      const bullet = line.match(BULLET_REGEX)
      if (heading) {
        nodes.push(...parseInline(heading[2], `i${i}`))
      } else if (bullet) {
        nodes.push('• ', ...parseInline(bullet[1], `i${i}`))
      } else {
        nodes.push(...parseInline(line, `i${i}`))
      }
    })
    return (
      <Paragraph whiteSpace="pre-wrap" {...textProps}>
        {nodes}
      </Paragraph>
    )
  }

  // Block mode: group lines into heading / list / paragraph blocks.
  type Block =
    | { type: 'heading'; level: number; content: string }
    | { type: 'list'; items: string[] }
    | { type: 'para'; lines: string[] }

  const blocks: Block[] = []
  for (const line of lines) {
    const heading = line.match(HEADING_REGEX)
    const bullet = line.match(BULLET_REGEX)
    const isBlank = line.trim() === ''

    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, content: heading[2] })
    } else if (bullet) {
      const last = blocks[blocks.length - 1]
      if (last?.type === 'list') last.items.push(bullet[1])
      else blocks.push({ type: 'list', items: [bullet[1]] })
    } else if (isBlank) {
      // blank line ends the current paragraph/list (forces a new block)
      const last = blocks[blocks.length - 1]
      if (last?.type === 'para') blocks.push({ type: 'para', lines: [] })
    } else {
      const last = blocks[blocks.length - 1]
      if (last?.type === 'para') last.lines.push(line)
      else blocks.push({ type: 'para', lines: [line] })
    }
  }

  return (
    <YStack gap="$2">
      {blocks.map((block, bi) => {
        if (block.type === 'heading') {
          return (
            <Text key={bi} {...HEADING_PROPS[block.level]} {...textProps}>
              {parseInline(block.content, `h${bi}`)}
            </Text>
          )
        }
        if (block.type === 'list') {
          return (
            <YStack key={bi} gap="$1" paddingLeft="$2">
              {block.items.map((item, ii) => (
                <Paragraph key={ii} whiteSpace="pre-wrap" {...textProps}>
                  {'•  '}
                  {parseInline(item, `l${bi}-${ii}`)}
                </Paragraph>
              ))}
            </YStack>
          )
        }
        // paragraph: interleave parsed lines with newline chars (pre-wrap renders them)
        const nodes: React.ReactNode[] = []
        block.lines.forEach((line, li) => {
          if (li > 0) nodes.push('\n')
          nodes.push(...parseInline(line, `p${bi}-${li}`))
        })
        if (nodes.length === 0) return null
        return (
          <Paragraph key={bi} whiteSpace="pre-wrap" {...textProps}>
            {nodes}
          </Paragraph>
        )
      })}
    </YStack>
  )
}
