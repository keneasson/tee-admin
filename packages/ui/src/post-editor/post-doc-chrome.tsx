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
import { YStack, XStack, Card, Text, Input, Label, Separator, H3, Paragraph } from 'tamagui'
import { X } from '@tamagui/lucide-icons'
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
}

export function PostDocChrome({
  value,
  onChange,
  onPublish,
  seriesPosts,
  onSeriesPostPress,
  renderCanvas,
}: PostDocChromeProps) {
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

  return (
    <YStack gap="$4">
      {/* ---- Post metadata chrome ------------------------------------------ */}
      <Card bordered padding="$4" gap="$3">
        <H3>Post</H3>

        <YStack gap="$2">
          <Label htmlFor="post-title" fontSize="$3" fontWeight="600">
            Title
          </Label>
          <Input
            id="post-title"
            value={value.title}
            onChangeText={(title) => patch({ title })}
            placeholder="Post title"
          />
        </YStack>

        {/* Occasion tags — free-combining DATA, not a code path. */}
        <YStack gap="$2">
          <Label fontSize="$3" fontWeight="600">
            Occasion tags
          </Label>
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
            <XStack maxWidth={260}>
              <PlainSelect
                value=""
                placeholder="Add a tag…"
                options={availableOccasions}
                onValueChange={(tag) => addOccasionTag(tag as OccasionTag)}
              />
            </XStack>
          ) : null}
        </YStack>

        <XStack gap="$4" flexWrap="wrap">
          <YStack minWidth={200} flex={1}>
            <PlainSelect
              label="Visibility"
              value={value.visibility}
              options={VISIBILITY_OPTIONS}
              onValueChange={(v) => patch({ visibility: v as Visibility })}
            />
          </YStack>

          <YStack gap="$2" minWidth={200} flex={1}>
            <Label htmlFor="post-publish-date" fontSize="$3" fontWeight="600">
              Publish date
            </Label>
            <Input
              id="post-publish-date"
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
        </XStack>

        {/* PII gate notice + make-public opt-out (design §2). */}
        {piiBearing ? (
          <YStack
            gap="$1"
            padding="$3"
            borderRadius="$3"
            backgroundColor="$yellow2"
            borderColor="$yellow6"
            borderWidth={1}
          >
            <Text fontSize="$3" fontWeight="600">
              Sensitive occasion — prose is members-only by default
            </Text>
            <Paragraph fontSize="$2" color="$color10">
              Because this post carries a sensitive occasion tag (e.g. funeral,
              medical, baptism), text you write on the canvas is hidden from
              anonymous visitors (members-only) so obituary / testimony / medical
              detail is never exposed publicly. Structured widgets keep their own
              per-block visibility.
            </Paragraph>
            <PlainCheckbox
              checked={makePublic}
              onCheckedChange={toggleMakePublic}
              label="Make this post's prose public (I have confirmed there is no sensitive detail)"
            />
          </YStack>
        ) : null}
      </Card>

      {/* ---- Connect/series indicator -------------------------------------- */}
      {(seriesPosts?.length ?? 0) > 0 ? (
        <Card bordered padding="$3" gap="$2" backgroundColor="$blue2">
          <Text fontSize="$3" fontWeight="600">
            Part of a series — {seriesPosts!.length} related
          </Text>
          <XStack gap="$2" flexWrap="wrap">
            {seriesPosts!.map((sibling) => (
              <Button
                key={sibling.id}
                size="$2"
                variant="chromeless"
                onPress={() => onSeriesPostPress?.(sibling.id)}
              >
                {sibling.title || 'Untitled post'}
              </Button>
            ))}
          </XStack>
        </Card>
      ) : null}

      {/* ---- Document canvas (Lexical) ------------------------------------- */}
      <YStack gap="$2">
        <H3>Document</H3>
        <Text fontSize="$2" color="$color10">
          Write freely. Arm a tool from the floating toolbar to drop in a Location,
          Speaker, Date, Image, Link or Registration where you place the caret.
        </Text>
        {renderCanvas({ canvasKey: editorKey, initialBlocks, onBlocksChange })}
      </YStack>

      <Separator />

      {/* ---- Publish (validate-on-publish only) ---------------------------- */}
      {onPublish ? (
        <YStack gap="$2">
          {publishErrors.length > 0 ? (
            <Text fontSize="$3" color="$red10">
              {publishErrors.join(' · ')}
            </Text>
          ) : null}
          <XStack>
            <Button variant="action" disabled={!canPublish} onPress={() => onPublish(value)}>
              Publish
            </Button>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
