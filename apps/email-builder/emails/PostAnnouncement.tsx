import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import React from 'react'
import { container, defaultText, globalCss, header, main } from '../styles'
import { FooterContent } from '../components/FooterContent'
import { EmailBrandLinkContent } from '../components/EmailBrandLinkContent'
import { AutoLinkText } from '../components/AutoLinkText'
import { PostEmailView } from '../components/PostEmailView'
import type { EmailIdentity } from '@my/app/types/brand-profile'
import type { Post } from '@my/app/types/post'

/**
 * PostAnnouncement — the full-document email shell for sending ANY {@link Post}
 * as an announcement (Consolidated CMS send bridge, epic #131). It is the
 * occasion-agnostic replacement for the per-type Funeral / Baptism / Wedding /
 * InterEcclesia templates: funeral, baptism, wedding, double-baptism, general —
 * every occasion — renders through this ONE shell with NO per-type code, because
 * `occasion` is data (it seeds blocks) and the body is just the post's blocks
 * rendered by {@link PostEmailView}.
 *
 * Modeled on `CustomEmail.tsx`: brand header + optional note + FooterContent
 * tokens. The only difference is the body — instead of a raw HTML string it wraps
 * the server-safe {@link PostEmailView}, which renders each block as email-safe
 * HTML.
 *
 * CONTRACT: `post` MUST already be redacted (`redactPost(..., { channel:
 * 'newsletter-email' })`) by the caller — this shell does NO gating / PII
 * scrubbing (identical to PostEmailView).
 *
 * SERVER-SAFE (critical): imports ONLY `@react-email/components`, the server-safe
 * `PostEmailView` / `FooterContent` / `EmailBrandLinkContent` / `AutoLinkText`,
 * pure styles, and pure types. NO `'use client'` module — so `@react-email/render`
 * can run it from an App Router server route without the "client module in a
 * server render" failure.
 */
export type PostAnnouncementProps = {
  post: Post
  /** Subject/preview line — defaults to the post title. */
  subject?: string
  /** Optional author note, rendered in the highlighted note box (like CustomEmail). */
  note?: string
  /** Brand identity for footer/header — passed as a PROP (not the client provider). */
  identity?: EmailIdentity
}

const PostAnnouncement: React.FC<PostAnnouncementProps> = ({ post, subject, note, identity }) => {
  const todaysDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Toronto',
  })

  const previewText = subject || post.title || 'Announcement'

  return (
    <Html lang="en">
      <Head>
        <style>{globalCss}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Heading>{identity?.name || 'Toronto East Communications'}</Heading>
          <Text style={defaultText}>{todaysDate}</Text>
          <Text style={defaultText}>
            This email is intended for Christadelphians and friends, whether we meet in person or on
            Zoom.
            <br />
            All plans are subject to God&apos;s will.
          </Text>
          <EmailBrandLinkContent identity={identity} />
        </Section>

        {/* Optional Note Section (mirrors CustomEmail / Newsletter). */}
        {note && note.trim() ? (
          <Section
            style={{
              backgroundColor: '#fff3cd',
              padding: '16px',
              marginTop: '20px',
              marginBottom: '20px',
              borderRadius: '4px',
            }}
          >
            <Text style={{ ...defaultText, margin: '0 0 8px 0', fontWeight: 'bold' }}>Note:</Text>
            <Text style={{ ...defaultText, margin: '0', whiteSpace: 'pre-wrap' }}>
              <AutoLinkText text={note} />
            </Text>
          </Section>
        ) : null}

        <Container style={{ ...container, marginTop: '24px' }} className="container">
          <PostEmailView post={post} />
        </Container>

        <Container>
          <Text>&nbsp;</Text>
        </Container>
        <FooterContent identity={identity} />
      </Body>
    </Html>
  )
}

export default PostAnnouncement
