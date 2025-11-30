import React from 'react'
import { Link } from '@react-email/components'

// Regex to match URLs - handles http, https, and www prefixed URLs
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>[\]{}|\\^`"']+/gi

interface AutoLinkTextProps {
  text: string
  linkStyle?: React.CSSProperties
}

/**
 * Parses text and converts URLs to clickable Link components.
 * URLs starting with http://, https://, or www. will be converted to links.
 */
export const AutoLinkText: React.FC<AutoLinkTextProps> = ({ text, linkStyle }) => {
  const defaultLinkStyle: React.CSSProperties = {
    color: '#003da9',
    textDecoration: 'underline',
  }

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset regex state
  URL_REGEX.lastIndex = 0

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    // Add the URL as a link
    let url = match[0]
    // Ensure URL has protocol for href
    const href = url.startsWith('www.') ? `https://${url}` : url

    parts.push(
      <Link key={match.index} href={href} style={linkStyle || defaultLinkStyle}>
        {url}
      </Link>
    )

    lastIndex = URL_REGEX.lastIndex
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  // If no URLs found, just return the original text
  if (parts.length === 0) {
    return <>{text}</>
  }

  return <>{parts}</>
}
