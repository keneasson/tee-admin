/**
 * PostDocChrome — the metadata chrome around a document-canvas editor
 * (Consolidated CMS Phase 2R-1 keystone; design doc §2 "Wiring = container
 * swap"). It is the doc-editor counterpart of the block-form {@link PostEditor}
 * and honours the SAME controlled contract (`value` / `onChange` / `onPublish` /
 * series props), so the authoring page can render either editor interchangeably
 * (the block-form editor stays a rollout fallback).
 *
 * WHAT IT OWNS: the post-level metadata chrome (title, occasion tags, visibility,
 * publish date, publish action, series indicator) — reusing the block-form
 * editor's own field primitives (`PlainSelect`, `OCCASION_OPTIONS`,
 * `VISIBILITY_OPTIONS`, `applyOccasionDefaults`, `validateForPublish`) so the two
 * editors share one field vocabulary. The block canvas is delegated to
 * {@link PostDocEditor} (Lexical). The full `Post` is RECONSTRUCTED here on every
 * change: `{ ...value, <chrome fields>, blocks: <editor output, PII-gated> }` —
 * every non-chrome field (id, tenant, authorId, sharingScope, seriesId, status,
 * timestamps, summary) is carried through from `value` untouched.
 *
 * WHY packages/ui (cross-platform): the chrome does NOT compose a canvas — it
 * takes one, through the `renderCanvas` slot. Lexical is a WEB RENDERING CHOICE,
 * not a property of post authoring, so the web app injects the Lexical canvas and
 * a future Expo app injects a native one while both reuse this identical chrome,
 * the identical field vocabulary, and the identical PII gate. Keeping the chrome
 * here is what makes the doc editor reachable from native at all.
 *
 * No next-auth / next/* dependency — session and navigation arrive as props, the
 * same contract the block-form {@link PostEditor} already honours.
 *
 * PII gate (design §2): the editor's Lexical state always holds bare, editable
 * prose; under a PII-bearing occasion the DERIVED blocks are gated to
 * members-only for persistence (see {@link gatePiiProse}). A "make prose public"
 * toggle flips that default. Per-block visibility / containsPii on typed widgets
 * round-trips losslessly through the doc ⇄ blocks bijection unchanged.
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { YStack, XStack, Text, Input, Popover, Separator } from 'tamagui'
import {
  CalendarClock,
  Eye,
  EyeOff,
  Globe,
  Layers,
  LayoutTemplate,
  Lock,
  Save,
  Trash2,
  X,
} from '@tamagui/lucide-icons'
import type { Block, OccasionTag, Post, Visibility } from '@my/app/types/post'
// Deep import, NOT the '@my/app/features/post-editor' barrel: that barrel also
// exports the screens, which import '@my/ui' — going through it would make
// packages/ui depend on packages/app depend on packages/ui. packages/ui always
// reaches into @my/app by module path (CLAUDE.md, "Avoiding Circular Dependencies").
import {
  gatePiiProse,
  occasionIsPiiBearing,
  ungatePiiProse,
} from '@my/app/features/post-editor/pii-occasion-defaults'
import { Button } from '../Button'
import { validateForPublish } from './post-reducer'
import { applyOccasionDefaults } from './occasion-defaults'
import { PlainSelect } from './plain-select'
import { PlainCheckbox } from './plain-checkbox'
import { OCCASION_OPTIONS, VISIBILITY_OPTIONS } from './options'

/**
 * What the chrome hands a canvas implementation. The canvas is mount-once and
 * re-seeds only when `canvasKey` changes (an occasion edit injects default
 * blocks); ordinary typing must never remount it.
 */
export interface PostDocCanvasProps {
  canvasKey: number
  initialBlocks: Block[]
  onBlocksChange: (blocks: Block[]) => void
}

export interface PostDocChromeProps {
  value: Post
  onChange: (next: Post) => void
  onPublish?: (post: Post) => void
  seriesPosts?: Array<{ id: string; title: string }>
  onSeriesPostPress?: (postId: string) => void
  /**
   * The document canvas to render — Lexical on web, a native editor on Expo.
   * THE cross-platform seam: everything else in this file is shared.
   */
  renderCanvas: (props: PostDocCanvasProps) => ReactNode
  /** Explicit save (the disk icon). Autosave still runs; this is the deliberate one. */
  onSave?: (post: Post) => void
  /** Autosave state text, e.g. "All changes saved". Rendered quietly in the bar. */
  saveLabel?: string
  saveIsError?: boolean
  /** Drop back to the block-form editor (the rollout fallback). */
  onSwitchEditor?: () => void
  /** Discard this draft permanently. Absent unless the post IS a draft. */
  onDiscard?: () => void
}

export function PostDocChrome({
  value,
  onChange,
  onPublish,
  seriesPosts,
  onSeriesPostPress,
  renderCanvas,
  onSave,
  saveLabel,
  saveIsError,
  onSwitchEditor,
  onDiscard,
}: PostDocChromeProps) {
  // Which top-bar popover is open (only one at a time).
  const [openPanel, setOpenPanel] = useState<'publish' | 'date' | 'occasion' | 'series' | null>(null)
  // Author opt-out of the PII members-default for prose (design §2 make-public).
  const [makePublic, setMakePublic] = useState(false)

  // Remount key for the mount-once Lexical editor. Bumped only when the occasion
  // set changes (which injects occasion-default blocks / flips the PII context),
  // so the canvas re-seeds; ordinary typing and chrome edits never remount it.
  const [editorKey, setEditorKey] = useState(0)
  const remount = () => setEditorKey((k) => k + 1)

  const piiBearing = occasionIsPiiBearing(value.occasion)

  // The editor is ALWAYS seeded with bare, editable prose (auto-gating stripped);
  // the persisted post keeps the gated version. Read once per mount by PostDocEditor.
  const initialBlocks = ungatePiiProse(value.blocks, value.occasion)

  const availableOccasions = OCCASION_OPTIONS.filter((o) => !value.occasion.includes(o.value))

  // ---- Chrome field patches (never touch the block canvas) -----------------
  const patch = (partial: Partial<Post>) => onChange({ ...value, ...partial })

  // ---- Block canvas → persisted blocks (PII-gated) -------------------------
  const handleBlocksChange = useCallback(
    (editorBlocks: Block[]) => {
      onChange({ ...value, blocks: gatePiiProse(editorBlocks, value.occasion, makePublic) })
    },
    [value, makePublic, onChange]
  )

  // Keep the latest editor output so toggling make-public can re-gate in place
  // (no remount — the editor keeps holding bare prose).
  const lastEditorBlocksRef = useRef<Block[]>(initialBlocks)
  const onBlocksChange = useCallback(
    (editorBlocks: Block[]) => {
      lastEditorBlocksRef.current = editorBlocks
      handleBlocksChange(editorBlocks)
    },
    [handleBlocksChange]
  )

  // ---- Occasion tags (occasion is DATA) ------------------------------------
  const addOccasionTag = (tag: OccasionTag) => {
    const nextOccasion = [...value.occasion, tag]
    // Seed the occasion's default block set (additive; never edits existing).
    const withDefaults = applyOccasionDefaults({ ...value, occasion: nextOccasion })
    onChange({
      ...withDefaults,
      blocks: gatePiiProse(withDefaults.blocks, nextOccasion, makePublic),
    })
    remount()
  }

  const removeOccasionTag = (tag: OccasionTag) => {
    const nextOccasion = value.occasion.filter((t) => t !== tag)
    onChange({
      ...value,
      occasion: nextOccasion,
      blocks: gatePiiProse(
        ungatePiiProse(value.blocks, value.occasion),
        nextOccasion,
        makePublic
      ),
    })
    remount()
  }

  // ---- Make-public toggle (re-gate current prose in place, no remount) -----
  const toggleMakePublic = (checked: boolean) => {
    setMakePublic(checked)
    const raw = ungatePiiProse(lastEditorBlocksRef.current, value.occasion)
    onChange({ ...value, blocks: gatePiiProse(raw, value.occasion, checked) })
  }

  const publishErrors = validateForPublish(value)
  const canPublish = publishErrors.length === 0
  const isPublic = value.visibility === 'public'
  const isPublished = value.status === 'published'

  return (
    <YStack flex={1} gap="$2">
      {/* ---- Docs-style top bar ------------------------------------------- */}
      <XStack alignItems="center" gap="$2" paddingVertical="$2" flexWrap="wrap">
        {/* Title: click to edit, in place. Never a labelled form field. */}
        <Input
          id="post-title"
          flex={1}
          minWidth={180}
          maxWidth={360}
          value={value.title}
          onChangeText={(title) => patch({ title })}
          placeholder="Untitled post"
          fontSize="$5"
          fontWeight="600"
          borderWidth={0}
          backgroundColor="transparent"
          paddingHorizontal="$2"
          hoverStyle={{ backgroundColor: '$backgroundHover' }}
          focusStyle={{ backgroundColor: '$background', borderWidth: 1, borderColor: '$blue8' }}
        />

        {/* 1. DRAFT ↔ PUBLISHED — EXPOSURE, not sharing. The question this
            control answers is "does this exist for readers yet?", which is
            exactly what `status` already encodes: only 'published' is ever served
            publicly, 'draft' is a placeholder nobody sees.

            Audience ("who can see it") is a DIFFERENT axis and stays a separate
            setting below, not folded into the same word — a members-only post
            can be published, and a public post can be a draft. */}
        <ToolbarPopover
          icon={isPublished ? Eye : EyeOff}
          label={isPublished ? 'Published' : 'Draft'}
          active={isPublished}
          open={openPanel === 'publish'}
          onOpenChange={(o) => setOpenPanel(o ? 'publish' : null)}
        >
          <YStack gap="$3" minWidth={260}>
            <XStack alignItems="center" gap="$2">
              {isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
              <Text fontSize="$3" fontWeight="600">
                {isPublished ? 'Published' : 'Draft'}
              </Text>
            </XStack>
            <Text fontSize="$2" color="$color10">
              {isPublished
                ? 'Readers can see this post.'
                : 'A placeholder — nobody but editors can see this yet.'}
            </Text>

            {isPublished ? (
              <Button
                size="$2"
                variant="outlined"
                onPress={() => {
                  setOpenPanel(null)
                  patch({ status: 'draft' })
                }}
              >
                Return to draft
              </Button>
            ) : onPublish ? (
              <Button
                size="$2"
                variant="action"
                disabled={!canPublish}
                onPress={() => {
                  setOpenPanel(null)
                  onPublish(value)
                }}
              >
                Publish
              </Button>
            ) : null}
            {publishErrors.length > 0 ? (
              <Text fontSize="$2" color="$red10">
                {publishErrors.join(' · ')}
              </Text>
            ) : null}

            {/* Discard sits here because it answers the SAME question the panel
                does — should this exist at all? — and it keeps the icon row at
                four. Offered only for a draft: a published post is retired by
                archiving, never destroyed. */}
            {onDiscard ? (
              <Button
                size="$2"
                variant="danger"
                icon={Trash2}
                onPress={() => {
                  setOpenPanel(null)
                  onDiscard()
                }}
              >
                Discard draft
              </Button>
            ) : null}

            <Separator />

            {/* A separate question: exposure says WHETHER, audience says WHO. */}
            <XStack alignItems="center" gap="$2">
              {isPublic ? <Globe size={14} /> : <Lock size={14} />}
              <PlainSelect
                label="Audience"
                value={value.visibility}
                options={VISIBILITY_OPTIONS}
                onValueChange={(v) => patch({ visibility: v as Visibility })}
              />
            </XStack>
          </YStack>
        </ToolbarPopover>

        {/* 2. SCHEDULE — when it goes out. */}
        <ToolbarPopover
          icon={CalendarClock}
          label={
            value.lifecycle.publishDate
              ? `Scheduled ${value.lifecycle.publishDate}`
              : 'Schedule post'
          }
          active={Boolean(value.lifecycle.publishDate)}
          open={openPanel === 'date'}
          onOpenChange={(o) => setOpenPanel(o ? 'date' : null)}
        >
          <YStack gap="$2" minWidth={220}>
            <Text fontSize="$2" color="$color10">
              Schedule post
            </Text>
            <Input
              value={value.lifecycle.publishDate ?? ''}
              onChangeText={(publishDate) =>
                patch({
                  lifecycle: { ...value.lifecycle, publishDate: publishDate || undefined },
                })
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </YStack>
        </ToolbarPopover>

        {/* 3. SAVE — the disk, alongside the autosave indicator. */}
        <ToolbarIcon
          icon={Save}
          label="Save now"
          onPress={() => onSave?.(value)}
          disabled={!onSave}
        />

        {/* 4. OCCASION TAGS / TEMPLATES — one control, because they are one
            idea: choosing an occasion is what seeds that occasion's starting
            structure (applyOccasionDefaults). Tags sort and filter NOTHING;
            their one load-bearing job is the PII gate. */}
        <ToolbarPopover
          icon={LayoutTemplate}
          label={value.occasion.length > 0 ? value.occasion.join(', ') : 'Occasion & template'}
          active={value.occasion.length > 0}
          open={openPanel === 'occasion'}
          onOpenChange={(o) => setOpenPanel(o ? 'occasion' : null)}
        >
          <YStack gap="$2" minWidth={240}>
            <XStack gap="$2" flexWrap="wrap">
              {value.occasion.map((tag) => (
                <XStack
                  key={tag}
                  alignItems="center"
                  gap="$1"
                  paddingHorizontal="$2"
                  paddingVertical="$1"
                  borderRadius="$3"
                  backgroundColor="$blue4"
                >
                  <Text fontSize="$2">{tag}</Text>
                  <Button
                    size="$1"
                    circular
                    variant="chromeless"
                    icon={X}
                    aria-label={`Remove ${tag}`}
                    onPress={() => removeOccasionTag(tag)}
                  />
                </XStack>
              ))}
            </XStack>
            {availableOccasions.length > 0 ? (
              <PlainSelect
                value=""
                placeholder="Add a tag…"
                options={availableOccasions}
                onValueChange={(tag) => addOccasionTag(tag as OccasionTag)}
              />
            ) : null}
          </YStack>
        </ToolbarPopover>

        <XStack flex={1} minWidth={8} />

        {/* Autosave state — Docs' "All changes saved". */}
        {saveLabel ? (
          <Text fontSize="$2" color={saveIsError ? '$red10' : '$color10'}>
            {saveLabel}
          </Text>
        ) : null}

        {/* SERIES — only when the post actually belongs to one, so it costs no
            slot in the common case. The chrome rewrite had dropped this
            indicator entirely while still accepting the props. */}
        {(seriesPosts?.length ?? 0) > 0 ? (
          <ToolbarPopover
            icon={Layers}
            label={`Part of a series — ${seriesPosts!.length} related`}
            active
            open={openPanel === 'series'}
            onOpenChange={(o) => setOpenPanel(o ? 'series' : null)}
          >
            <YStack gap="$2" minWidth={220}>
              <Text fontSize="$2" color="$color10">
                Part of a series — {seriesPosts!.length} related
              </Text>
              {seriesPosts!.map((sibling) => (
                <Button
                  key={sibling.id}
                  size="$2"
                  variant="chromeless"
                  onPress={() => {
                    setOpenPanel(null)
                    onSeriesPostPress?.(sibling.id)
                  }}
                >
                  {sibling.title || 'Untitled post'}
                </Button>
              ))}
            </YStack>
          </ToolbarPopover>
        ) : null}

        {onSwitchEditor ? (
          <Button size="$2" variant="chromeless" onPress={onSwitchEditor}>
            Classic
          </Button>
        ) : null}

      </XStack>

      {/* PII notice stays visible — it changes who can read the post, so it is
          never hidden behind an icon. Compact, inline, one line. */}
      {piiBearing ? (
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius="$3"
          backgroundColor="$yellow2"
          borderColor="$yellow6"
          borderWidth={1}
        >
          <Text fontSize="$2" flex={1}>
            Sensitive occasion — your text is hidden from anonymous visitors.
          </Text>
          <PlainCheckbox
            checked={makePublic}
            onCheckedChange={toggleMakePublic}
            label="Make public"
          />
        </XStack>
      ) : null}

      {/* ---- The document ------------------------------------------------- */}
      {renderCanvas({ canvasKey: editorKey, initialBlocks, onBlocksChange })}
    </YStack>
  )
}

// ---- Top-bar affordances -----------------------------------------------------

function ToolbarIcon({
  icon: Icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: typeof Save
  label: string
  onPress?: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <Button
      size="$2"
      circular
      variant="chromeless"
      icon={<Icon size={16} />}
      aria-label={label}
      disabled={disabled}
      onPress={onPress}
      backgroundColor={active ? '$blue4' : 'transparent'}
      hoverStyle={{ backgroundColor: '$backgroundHover' }}
    />
  )
}

/**
 * An icon in the top bar that opens its settings in a small popover — the Docs
 * pattern. The document keeps the full width; metadata is one click away and
 * never occupies the page.
 */
function ToolbarPopover({
  icon: Icon,
  label,
  active,
  open,
  onOpenChange,
  children,
}: {
  icon: typeof Save
  label: string
  active?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange} placement="bottom-start">
      <Popover.Trigger asChild>
        <Button
          size="$2"
          circular
          variant="chromeless"
          icon={<Icon size={16} />}
          aria-label={label}
          backgroundColor={active ? '$blue4' : 'transparent'}
          hoverStyle={{ backgroundColor: '$backgroundHover' }}
        />
      </Popover.Trigger>
      <Popover.Content
        bordered
        elevate
        padding="$3"
        zIndex={200000}
        enterStyle={{ opacity: 0, y: -4 }}
        exitStyle={{ opacity: 0, y: -4 }}
      >
        <Popover.Arrow />
        {children}
      </Popover.Content>
    </Popover>
  )
}
