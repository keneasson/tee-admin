'use client'

import {
  YStack,
  XStack,
  Card,
  Text,
  H2,
  Separator,
  Image,
  Paragraph,
} from 'tamagui'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  FileImage,
  ClipboardCheck,
  Video,
} from '@tamagui/lucide-icons'
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
import { inlineSummary } from './inline-summary'
import {
  blockIndex,
  findMarkers,
  flattenMarkers,
} from '@my/app/features/post-editor/inline-markers'
import { getPlatformDisplayName } from '@my/app/types/events'
import { MarkdownLiteText } from '../markdown-lite-text'
import { ExtLink } from '../ext-link'
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
} from './post-view-format'

/**
 * PostView — the READ-ONLY display twin of {@link PostEditor} (Consolidated CMS
 * epic #131, Phase 3). Given an ALREADY-REDACTED {@link Post} it renders the
 * header (title, occasion, date facet) and each block read-only, one renderer
 * per block kind — mirroring the editor's 7-kind coverage so the two stay in
 * lock-step.
 *
 * CONTRACT: `post` MUST be the output of `redactPost(post, viewer, {channel})`.
 * PostView does NO gating and NO PII scrubbing — a surname / precise address /
 * bio is present here ONLY because the redactor chose to reveal it. This keeps
 * the display dumb and the single redaction boundary authoritative (no
 * ship-then-hide leak: what isn't in the object can't render).
 *
 * Cross-platform: only Tamagui + Lucide + the shared `MarkdownLiteText` /
 * `ExtLink` primitives; no `next-*` imports; ternary JSX only (RN-safe).
 */
export interface PostViewProps {
  post: Post
}

// ---- Per-kind block renderers -----------------------------------------------

function BlockHeader({
  icon: Icon,
  label,
}: {
  icon: React.FC<{ size?: number | string; color?: string }>
  label: string
}) {
  return (
    <XStack alignItems="center" gap="$2">
      <Icon size={16} color="$color10" />
      <Text fontSize="$3" fontWeight="600" color="$color10">
        {label}
      </Text>
    </XStack>
  )
}

/**
 * Prose, with any `{{kind:id}}` marker resolved to its value's one-line reading —
 * so "First class starts at {{time:t1}} (doors 1:30)" publishes as one sentence,
 * with the author's own words around the typed value preserved.
 *
 * A marker whose block is absent (deleted, or REDACTED AWAY for this viewer)
 * collapses to nothing rather than leaking `{{…}}`.
 */
function TextBlockView({ block, blocks }: { block: TextBlock; blocks?: Block[] }) {
  const body = flattenMarkers(
    block.body ?? '',
    inlineSummary,
    blockIndex(blocks ?? [])
  )
  if (!body.trim()) return null
  return <MarkdownLiteText text={body} fontSize="$4" color="$color12" />
}

function PersonBlockView({ block }: { block: PersonBlock }) {
  if (block.people.length === 0) return null
  return (
    <YStack gap="$2">
      <BlockHeader icon={Users} label={personRoleLabel(block.role)} />
      <YStack gap="$3">
        {block.people.map((person) => {
          const meta = personMetaLine(person)
          return (
            <YStack key={person.id} gap="$1">
              <Text fontSize="$4" fontWeight="600" color="$color12">
                {formatPersonName(person)}
              </Text>
              {meta ? (
                <Text fontSize="$2" color="$color10">
                  {meta}
                </Text>
              ) : null}
              {person.contact ? (
                <Text fontSize="$3" color="$color11">
                  {person.contact}
                </Text>
              ) : null}
              {person.bio ? (
                <Paragraph fontSize="$3" color="$color11" whiteSpace="pre-wrap">
                  {person.bio}
                </Paragraph>
              ) : null}
            </YStack>
          )
        })}
      </YStack>
    </YStack>
  )
}

function LocationBlockView({ block }: { block: LocationBlock }) {
  const lines = locationAddressLines(block)
  const mapsHref = locationMapsHref(block)
  const online = block.onlineMeeting

  // An 'ecclesia'-mode block with no captured fields is a read-time inherit
  // placeholder — nothing to show until inheritance is resolved.
  if (lines.length === 0 && !online && block.mode === 'ecclesia') {
    return null
  }

  return (
    <YStack gap="$2">
      <BlockHeader icon={MapPin} label={block.label || 'Location'} />
      {lines.length > 0 ? (
        <YStack gap="$0.5">
          {lines.map((line, i) => (
            <Text
              key={i}
              fontSize={i === 0 ? '$4' : '$3'}
              fontWeight={i === 0 ? '600' : '400'}
              color={i === 0 ? '$color12' : '$color11'}
            >
              {line}
            </Text>
          ))}
        </YStack>
      ) : null}
      {mapsHref ? (
        <ExtLink href={mapsHref}>Get directions</ExtLink>
      ) : null}
      {block.directions ? (
        <Text fontSize="$3" color="$color11">
          {block.directions}
        </Text>
      ) : null}
      {block.parkingInfo ? (
        <Text fontSize="$3" color="$color11">
          Parking: {block.parkingInfo}
        </Text>
      ) : null}

      {online ? (
        <YStack
          gap="$1"
          marginTop="$2"
          padding="$2"
          borderRadius="$3"
          backgroundColor="$backgroundHover"
        >
          <XStack alignItems="center" gap="$2">
            <Video size={16} color="$color10" />
            <Text fontSize="$3" fontWeight="600" color="$color11">
              {online.platform ? getPlatformDisplayName(online.platform) : 'Online meeting'}
            </Text>
          </XStack>
          {online.link ? <ExtLink href={online.link}>Join online</ExtLink> : null}
          {online.meetingId ? (
            <Text fontSize="$3" color="$color11">
              Meeting ID: {online.meetingId}
            </Text>
          ) : null}
          {online.password ? (
            <Text fontSize="$3" color="$color11">
              Password: {online.password}
            </Text>
          ) : null}
          {online.dialInNumber ? (
            <Text fontSize="$3" color="$color11">
              Dial-in: {online.dialInNumber}
            </Text>
          ) : null}
          {online.additionalInfo ? (
            <Text fontSize="$3" color="$color11">
              {online.additionalInfo}
            </Text>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )
}

function TimeBlockView({ block }: { block: TimeBlock }) {
  const { label, dateLine, timeLine } = formatTimeBlock(block)
  if (!dateLine && !timeLine && !label) return null
  return (
    <YStack gap="$1">
      <BlockHeader icon={Clock} label={label || 'Date & time'} />
      {dateLine ? (
        <Text fontSize="$4" fontWeight="600" color="$color12">
          {dateLine}
        </Text>
      ) : null}
      {timeLine ? (
        <Text fontSize="$3" color="$color11">
          {timeLine}
        </Text>
      ) : null}
    </YStack>
  )
}

function FlyerBlockView({ block }: { block: FlyerBlock }) {
  const { document } = block
  const url = document.fileUrl?.trim()
  if (!url) return null

  const title = document.originalName || 'Attachment'
  const isImage = looksLikeImage(url, document.mimeType)

  // Presentation-only controls from the doc-editor's in-canvas handles. Clamp
  // defensively so a bad stored value can't blow out the layout.
  const widthPct = Math.min(100, Math.max(10, block.displayWidth ?? 100))
  const rotation = ((block.rotation ?? 0) % 360) as 0 | 90 | 180 | 270
  const rotated = rotation === 90 || rotation === 270
  const imageProps = {
    width: '100%' as const,
    height: 320,
    objectFit: 'contain' as const,
    borderRadius: '$3' as const,
    borderWidth: 1,
    borderColor: '$borderColor' as const,
    ...(rotation ? { transform: [{ rotate: `${rotation}deg` }] } : {}),
  }

  return (
    <YStack gap="$2">
      <BlockHeader icon={FileImage} label="Flyer" />
      {isImage ? (
        <YStack width={`${widthPct}%`} maxWidth={480} paddingVertical={rotated ? '$5' : 0}>
          <Image source={{ uri: url }} {...imageProps} />
        </YStack>
      ) : document.thumbnailUrl ? (
        <YStack width={`${widthPct}%`} maxWidth={480} paddingVertical={rotated ? '$5' : 0}>
          <Image source={{ uri: document.thumbnailUrl }} {...imageProps} />
        </YStack>
      ) : null}
      {document.description ? (
        <Text fontSize="$3" color="$color11">
          {document.description}
        </Text>
      ) : null}
      <ExtLink href={url}>{isImage ? `View ${title}` : `Open ${title}`}</ExtLink>
    </YStack>
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
    <YStack gap="$1">
      <BlockHeader icon={ClipboardCheck} label="Registration" />
      {block.required ? (
        <Text fontSize="$3" fontWeight="600" color="$color12">
          Registration required
        </Text>
      ) : null}
      {block.deadline ? (
        <Text fontSize="$3" color="$color11">
          Deadline: {block.deadline}
        </Text>
      ) : null}
      {block.hasFee ? (
        <Text fontSize="$3" color="$color11">
          Fee: {typeof block.fee === 'number' ? `$${block.fee}` : 'see details'}
        </Text>
      ) : null}
      {block.paymentInstructions ? (
        <Text fontSize="$3" color="$color11">
          {block.paymentInstructions}
        </Text>
      ) : null}
      {block.contactEmail ? (
        <ExtLink href={`mailto:${block.contactEmail}`}>{block.contactEmail}</ExtLink>
      ) : null}
      {block.contactPhone ? (
        <Text fontSize="$3" color="$color11">
          {block.contactPhone}
        </Text>
      ) : null}
      {block.notes ? (
        <Text fontSize="$3" color="$color11">
          {block.notes}
        </Text>
      ) : null}
      {block.registrationUrl ? (
        <ExtLink href={block.registrationUrl}>Register</ExtLink>
      ) : null}
    </YStack>
  )
}

function LinkBlockView({ block }: { block: LinkBlock }) {
  const url = block.url?.trim()
  if (!url) return null
  return <ExtLink href={url}>{block.label || url}</ExtLink>
}

/**
 * Render a single block by kind — mirrors the editor's 7-kind coverage. Exported
 * so the document-canvas editor can render each structured element's FINAL,
 * published appearance inline (the "document is the final version" contract); the
 * editor NEVER shows a form in the doc — editing happens in the floating tool.
 */
export function BlockView({
  block,
  inline = false,
  blocks,
}: {
  block: Block
  inline?: boolean
  /** Sibling blocks, so prose can resolve its inline markers. */
  blocks?: Block[]
}) {
  // Inside prose a block collapses to its one-line reading so the sentence still
  // reads as a sentence; the full stacked panel is for standalone blocks.
  if (inline) {
    return <Text>{inlineSummary(block)}</Text>
  }
  switch (block.kind) {
    case 'text':
      return <TextBlockView block={block} blocks={blocks} />
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

// ---- The post shell ---------------------------------------------------------

export function PostView({ post }: PostViewProps) {
  const dateFacet = formatDateFacet(post)
  const occasions = formatOccasions(post.occasion)

  // A block whose marker already places it inside prose must NOT also render as
  // its own card — it would publish twice. Everything else keeps its own slot,
  // which is exactly the behaviour posts authored before markers existed get.
  const placedInProse = new Set(
    post.blocks.flatMap((b) =>
      b.kind === 'text' && typeof b.body === 'string' ? findMarkers(b.body).map((m) => m.id) : []
    )
  )
  const standaloneBlocks = post.blocks.filter((b) => !placedInProse.has(b.id))

  return (
    <YStack gap="$4" maxWidth={720} width="100%">
      {/* ---- Header ---- */}
      <YStack gap="$2">
        {occasions ? (
          <Text fontSize="$2" fontWeight="600" color="$color10" textTransform="uppercase">
            {occasions}
          </Text>
        ) : null}
        <H2 color="$color12">{post.title || 'Untitled'}</H2>
        {dateFacet ? (
          <XStack alignItems="center" gap="$2">
            <Calendar size={16} color="$color10" />
            <Text fontSize="$3" color="$color11">
              {dateFacet}
            </Text>
          </XStack>
        ) : null}
        {post.summary ? (
          <Paragraph fontSize="$4" color="$color11">
            {post.summary}
          </Paragraph>
        ) : null}
      </YStack>

      <Separator />

      {/* ---- Blocks ---- */}
      {standaloneBlocks.length === 0 ? (
        <Text color="$color10">This post has no content to display.</Text>
      ) : (
        <YStack gap="$4">
          {standaloneBlocks.map((block) => (
            <Card key={block.id} bordered padding="$4">
              <BlockView block={block} blocks={post.blocks} />
            </Card>
          ))}
        </YStack>
      )}
    </YStack>
  )
}
