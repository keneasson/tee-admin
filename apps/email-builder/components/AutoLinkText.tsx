import React from 'react'
import { Link } from '@react-email/components'

// Inline regex: matches **bold** markers OR URLs
const INLINE_REGEX = /\*\*(.+?)\*\*|(?:https?:\/\/|www\.)[^\s<>[\]{}|\\^`"']+/gi

// Heading regex: matches lines starting with # (up to ###)
const HEADING_REGEX = /^(#{1,3})\s+(.+)$/

interface AutoLinkTextProps {
  text: string
  linkStyle?: React.CSSProperties
}

/** Parse inline markers (**bold** and URLs) within a single line of text */
function parseInline(text: string, linkStyle: React.CSSProperties, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  INLINE_REGEX.lastIndex = 0

  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-${match.index}`}>{match[1]}</strong>)
    } else {
      const url = match[0]
      const href = url.startsWith('www.') ? `https://${url}` : url
      parts.push(
        <Link key={`${keyPrefix}-${match.index}`} href={href} style={linkStyle}>
          {url}
        </Link>
      )
    }

    lastIndex = INLINE_REGEX.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  if (parts.length === 0) {
    return [text]
  }

  return parts
}

const headingStyles: Record<number, React.CSSProperties> = {
  1: { fontSize: '22px', fontWeight: 'bold', margin: '16px 0 8px 0' },
  2: { fontSize: '18px', fontWeight: '600', margin: '14px 0 6px 0' },
  3: { fontSize: '16px', fontWeight: '600', margin: '12px 0 4px 0' },
}

/**
 * Parses text with light markdown support:
 * - # Heading 1, ## Heading 2, ### Heading 3
 * - **bold** → <strong>
 * - URLs → clickable <Link>
 */
export const AutoLinkText: React.FC<AutoLinkTextProps> = ({ text, linkStyle }) => {
  const defaultLinkStyle: React.CSSProperties = {
    color: '#003da9',
    textDecoration: 'underline',
  }

  const style = linkStyle || defaultLinkStyle

  // Check if text contains any newlines — if not, skip line splitting for performance
  if (!text.includes('\n')) {
    const headingMatch = text.match(HEADING_REGEX)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      const content = headingMatch[2]
      return <span style={headingStyles[level]}>{...parseInline(content, style, 'h')}</span>
    }
    const inlined = parseInline(text, style, 'i')
    return <>{inlined}</>
  }

  // Multi-line: process each line for headings, then inline parse
  const lines = text.split('\n')
  const result: React.ReactNode[] = []

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      result.push(<br key={`br-${lineIdx}`} />)
    }

    const headingMatch = line.match(HEADING_REGEX)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      const content = headingMatch[2]
      result.push(
        <span key={`h-${lineIdx}`} style={headingStyles[level]}>
          {...parseInline(content, style, `h${lineIdx}`)}
        </span>
      )
    } else {
      result.push(...parseInline(line, style, `l${lineIdx}`))
    }
  })

  return <>{result}</>
}
