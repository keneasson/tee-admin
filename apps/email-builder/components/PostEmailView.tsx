import React from 'react'
import { Column, Heading, Img, Link, Row, Section, Text } from '@react-email/components'
import type {
  Block,
  FlyerBlock,
  LinkBlock,
  LocationBlock,
  PersonBlock,
  Post,
  RegistrationBlock,
  TextBlock,
  TimeBlock,
} from '@my/app/types/post'
import { getPlatformDisplayName } from '@my/app/types/events'
import {
  formatDateFacet,
  formatOccasions,
  formatPersonName,
  formatTimeBlock,
  locationAddressLines,
  locationMapsHref,
  looksLikeImage,
  personMetaLine,
  personRoleLabel,
} from '@my/ui/src/post-view/post-view-format'
import { AutoLinkText } from './AutoLinkText'

/**
 * PostEmailView — the EMAIL render twin of the web `PostView`
 * (packages/ui/src/post-view/post-view.tsx), for the Consolidated CMS newsletter
 * cutover (epic #131, Phase 4b-2). Given an ALREADY-REDACTED {@link Post} it
 * renders the header + each block as email-safe HTML, one renderer per block kind,
 * mirroring `PostView`'s 7-kind coverage so the two surfaces stay in lock-step.
 *
 * CONTRACT (identical to `PostView`): `post` MUST be the output of
 * `redactPost(post, viewer, { channel: 'newsletter-email' })`. This component does
 * NO gating and NO PII scrubbing — a surname / precise address / bio is present
 * here ONLY because the redactor chose to reveal it (the newsletter goes to the
 * member audience, so the channel reveals full PII, design §8.2).
 *
 * SERVER-SAFE (critical — the react-email `render()` runs from an App Router server
 * route: the cron newsletter). This module imports ONLY:
 *   - `@react-email/components` (server render primitives),
 *   - the sibling `AutoLinkText` (a server component — no `'use client'`),
 *   - the PURE, platform-free `post-view-format` helpers, and
 *   - pure types.
 * It imports NO `'use client'` module (provider OR hook), NO React context/hooks,
 * NO `packages/ui` React component / Tamagui — so it cannot throw the "client
 * module in a server render" failure that would silently break the live cron
 * newsletter. All data arrives as PROPS.
 */
export interface PostEmailViewProps {
  post: Post
}

// ---- shared inline styles (email-safe; mirrors the newsletter's idioms) ------

const bodyText: React.CSSProperties = { fontSize: '16px', color: '#00102c', margin: '0' }
const blockLabel: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 'bold',
  color: '#5a6472',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: '0 0 4px 0',
}
const primaryLine: React.CSSProperties = { fontSize: '16px', fontWeight: 'bold', color: '#00102c', margin: '0' }
const metaLine: React.CSSProperties = { fontSize: '13px', color: '#5a6472', margin: '2px 0 0 0' }
const subLine: React.CSSProperties = { fontSize: '14px', color: '#3a4453', margin: '2px 0 0 0' }
const inlineLink: React.CSSProperties = { color: '#003da9', textDecoration: 'underline' }
const blockSection: React.CSSProperties = { margin: '0 0 16px 0' }

// ---- per-kind block renderers (mirror PostView's coverage) -------------------

function TextBlockView({ block }: { block: TextBlock }) {
  if (!block.body.trim()) return null
  return (
    <Section style={blockSection}>
      <Text style={{ ...bodyText, whiteSpace: 'pre-wrap' }}>
        <AutoLinkText text={block.body} />
      </Text>
    </Section>
  )
}

function PersonBlockView({ block }: { block: PersonBlock }) {
  if (block.people.length === 0) return null
  return (
    <Section style={blockSection}>
      <Text style={blockLabel}>{personRoleLabel(block.role)}</Text>
      {block.people.map((person) => {
        const meta = personMetaLine(person)
        return (
          <Section key={person.id} style={{ margin: '0 0 8px 0' }}>
            <Text style={primaryLine}>{formatPersonName(person)}</Text>
            {meta ? <Text style={metaLine}>{meta}</Text> : null}
            {person.contact ? <Text style={subLine}>{person.contact}</Text> : null}
            {person.bio ? (
              <Text style={{ ...subLine, whiteSpace: 'pre-wrap' }}>
                <AutoLinkText text={person.bio} />
              </Text>
            ) : null}
          </Section>
        )
      })}
    </Section>
  )
}

function LocationBlockView({ block }: { block: LocationBlock }) {
  const lines = locationAddressLines(block)
  const mapsHref = locationMapsHref(block)
  const online = block.onlineMeeting

  // An 'ecclesia'-mode block with no captured fields is a read-time inherit
  // placeholder — nothing to show (mirrors PostView).
  if (lines.length === 0 && !online && block.mode === 'ecclesia') {
    return null
  }

  return (
    <Section style={blockSection}>
      <Text style={blockLabel}>{block.label || 'Location'}</Text>
      {lines.map((line, i) => (
        <Text key={i} style={i === 0 ? primaryLine : subLine}>
          {line}
        </Text>
      ))}
      {mapsHref ? (
        <Text style={{ ...subLine, margin: '4px 0 0 0' }}>
          <Link href={mapsHref} style={inlineLink}>
            Get directions
          </Link>
        </Text>
      ) : null}
      {block.directions ? <Text style={subLine}>{block.directions}</Text> : null}
      {block.parkingInfo ? <Text style={subLine}>Parking: {block.parkingInfo}</Text> : null}
      {online ? (
        <Section
          style={{
            margin: '8px 0 0 0',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: '#eef2f8',
          }}
        >
          <Text style={{ ...primaryLine, fontSize: '14px' }}>
            {online.platform ? getPlatformDisplayName(online.platform) : 'Online meeting'}
          </Text>
          {online.link ? (
            <Text style={{ ...subLine, margin: '4px 0 0 0' }}>
              <Link href={online.link} style={inlineLink}>
                Join online
              </Link>
            </Text>
          ) : null}
          {online.meetingId ? <Text style={subLine}>Meeting ID: {online.meetingId}</Text> : null}
          {online.password ? <Text style={subLine}>Password: {online.password}</Text> : null}
          {online.dialInNumber ? <Text style={subLine}>Dial-in: {online.dialInNumber}</Text> : null}
          {online.additionalInfo ? <Text style={subLine}>{online.additionalInfo}</Text> : null}
        </Section>
      ) : null}
    </Section>
  )
}

function TimeBlockView({ block }: { block: TimeBlock }) {
  const { label, dateLine, timeLine } = formatTimeBlock(block)
  if (!dateLine && !timeLine && !label) return null
  return (
    <Section style={blockSection}>
      <Text style={blockLabel}>{label || 'Date & time'}</Text>
      {dateLine ? <Text style={primaryLine}>{dateLine}</Text> : null}
      {timeLine ? <Text style={subLine}>{timeLine}</Text> : null}
    </Section>
  )
}

function FlyerBlockView({ block }: { block: FlyerBlock }) {
  const { document } = block
  const url = document.fileUrl?.trim()
  if (!url) return null

  const title = document.originalName || 'Attachment'
  const isImage = looksLikeImage(url, document.mimeType)
  const imageSrc = isImage ? url : document.thumbnailUrl

  return (
    <Section style={blockSection}>
      <Text style={blockLabel}>Flyer</Text>
      {imageSrc ? (
        <Img
          src={imageSrc}
          alt={title}
          style={{
            width: '100%',
            maxWidth: '480px',
            height: 'auto',
            borderRadius: '6px',
            border: '1px solid #dee2e6',
          }}
        />
      ) : null}
      {document.description ? <Text style={subLine}>{document.description}</Text> : null}
      <Text style={{ ...subLine, margin: '4px 0 0 0' }}>
        <Link href={url} style={inlineLink}>
          {isImage ? `View ${title}` : `Open ${title}`}
        </Link>
      </Text>
    </Section>
  )
}

function RegistrationBlockView({ block }: { block: RegistrationBlock }) {
  const hasAnything =
    block.required ||
    block.deadline ||
    block.registrationUrl ||
    block.contactEmail ||
    block.contactPhone ||
    block.hasFee ||
    block.notes
  if (!hasAnything) return null

  return (
    <Section style={blockSection}>
      <Text style={blockLabel}>Registration</Text>
      {block.required ? <Text style={primaryLine}>Registration required</Text> : null}
      {block.deadline ? <Text style={subLine}>Deadline: {block.deadline}</Text> : null}
      {block.hasFee ? (
        <Text style={subLine}>
          Fee: {typeof block.fee === 'number' ? `$${block.fee}` : 'see details'}
        </Text>
      ) : null}
      {block.paymentInstructions ? <Text style={subLine}>{block.paymentInstructions}</Text> : null}
      {block.contactEmail ? (
        <Text style={subLine}>
          <Link href={`mailto:${block.contactEmail}`} style={inlineLink}>
            {block.contactEmail}
          </Link>
        </Text>
      ) : null}
      {block.contactPhone ? <Text style={subLine}>{block.contactPhone}</Text> : null}
      {block.notes ? <Text style={subLine}>{block.notes}</Text> : null}
      {block.registrationUrl ? (
        <Text style={{ ...subLine, margin: '4px 0 0 0' }}>
          <Link href={block.registrationUrl} style={inlineLink}>
            Register
          </Link>
        </Text>
      ) : null}
    </Section>
  )
}

function LinkBlockView({ block }: { block: LinkBlock }) {
  const url = block.url?.trim()
  if (!url) return null
  return (
    <Section style={blockSection}>
      <Text style={bodyText}>
        <Link href={url} style={inlineLink}>
          {block.label || url}
        </Link>
      </Text>
    </Section>
  )
}

/** Render a single block by kind — mirrors the editor/PostView 7-kind coverage. */
function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'text':
      return <TextBlockView block={block} />
    case 'person':
      return <PersonBlockView block={block} />
    case 'location':
      return <LocationBlockView block={block} />
    case 'time':
      return <TimeBlockView block={block} />
    case 'flyer':
      return <FlyerBlockView block={block} />
    case 'registration':
      return <RegistrationBlockView block={block} />
    case 'link':
      return <LinkBlockView block={block} />
    default:
      return null
  }
}

export function PostEmailView({ post }: PostEmailViewProps) {
  const dateFacet = formatDateFacet(post)
  const occasions = formatOccasions(post.occasion)

  return (
    <Section style={{ margin: '0 0 8px 0' }}>
      {/* ---- Header ---- */}
      {occasions ? (
        <Text
          style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#5a6472',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            margin: '0 0 2px 0',
          }}
        >
          {occasions}
        </Text>
      ) : null}
      <Heading style={{ fontSize: '20px', fontWeight: 'bold', color: '#00102c', margin: '0 0 4px 0' }}>
        {post.title || 'Untitled'}
      </Heading>
      {dateFacet ? (
        <Row>
          <Column>
            <Text style={{ fontSize: '14px', color: '#3a4453', margin: '0 0 8px 0' }}>{dateFacet}</Text>
          </Column>
        </Row>
      ) : null}
      {post.summary ? (
        <Text style={{ fontSize: '15px', color: '#3a4453', margin: '0 0 12px 0' }}>{post.summary}</Text>
      ) : null}

      {/* ---- Blocks ---- */}
      {post.blocks.length === 0 ? (
        <Text style={metaLine}>This post has no content to display.</Text>
      ) : (
        post.blocks.map((block) => <BlockView key={block.id} block={block} />)
      )}
    </Section>
  )
}

export default PostEmailView
