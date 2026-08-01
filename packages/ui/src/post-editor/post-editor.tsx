import { YStack, XStack, Card, Text, Label, Input, Separator, H3 } from 'tamagui'
import { Plus, Trash2, ChevronUp, ChevronDown, X } from '@tamagui/lucide-icons'
import type { OccasionTag, Post, Visibility } from '@my/app/types/post'
import { Button } from '../Button'
import { postReducer, validateForPublish, type PostAction } from './post-reducer'
import { getBlockDef, listBlockDefs } from './registry'
import { registerDefaultBlocks } from './register-default-blocks'
import { PlainSelect } from './plain-select'
import { OCCASION_OPTIONS, VISIBILITY_OPTIONS } from './options'

// Ensure the reference block editors are available the moment the module loads.
registerDefaultBlocks()

/**
 * PostEditor — the ARCHITECTURE KEYSTONE of the Consolidated CMS (epic #131).
 *
 * ONE editor for CREATE and EDIT. It takes a {@link Post} — a fresh empty draft
 * (`createEmptyPost`) or a loaded existing one — and edits it. There is no
 * separate create-form vs edit-view; a Post *is* its ordered `blocks`.
 *
 * PURE CONTROLLED COMPONENT. The ONLY contract to the page is `value` /
 * `onChange` (+ optional `onPublish`); it fetches nothing and holds no post
 * state. Every action is applied through the pure {@link postReducer}, so the
 * page (or the /brand showcase, or native) owns persistence and the editor is
 * a self-contained module (design §3.1). Cross-platform: no next-auth / next/*.
 */
export interface PostEditorProps {
  value: Post
  onChange: (next: Post) => void
  onPublish?: (post: Post) => void
}

export function PostEditor({ value, onChange, onPublish }: PostEditorProps) {
  const dispatch = (action: PostAction) => onChange(postReducer(value, action))

  const publishErrors = validateForPublish(value)
  const canPublish = publishErrors.length === 0

  const availableOccasions = OCCASION_OPTIONS.filter((o) => !value.occasion.includes(o.value))

  return (
    <YStack gap="$4">
      {/* ---- Post header ---------------------------------------------------- */}
      <Card bordered padding="$4" gap="$3">
        <H3>Post</H3>

        <YStack gap="$2">
          <Label htmlFor="post-title" fontSize="$3" fontWeight="600">
            Title
          </Label>
          <Input
            id="post-title"
            value={value.title}
            onChangeText={(title) => dispatch({ type: 'patch-post', patch: { title } })}
            placeholder="Post title"
          />
        </YStack>

        {/* Occasion tags — occasion is DATA (free-combining tags). */}
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
                  chromeless
                  icon={X}
                  aria-label={`Remove ${tag}`}
                  onPress={() =>
                    dispatch({
                      type: 'patch-post',
                      patch: { occasion: value.occasion.filter((t) => t !== tag) },
                    })
                  }
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
                onValueChange={(tag) =>
                  dispatch({
                    type: 'patch-post',
                    patch: { occasion: [...value.occasion, tag as OccasionTag] },
                  })
                }
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
              onValueChange={(v) =>
                dispatch({ type: 'patch-post', patch: { visibility: v as Visibility } })
              }
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
                dispatch({
                  type: 'patch-post',
                  patch: {
                    lifecycle: { ...value.lifecycle, publishDate: publishDate || undefined },
                  },
                })
              }
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />
          </YStack>
        </XStack>
      </Card>

      {/* ---- Block canvas --------------------------------------------------- */}
      <YStack gap="$3">
        <H3>Blocks</H3>
        {value.blocks.length === 0 ? (
          <Text color="$color10">No blocks yet. Add one from the toolbar below.</Text>
        ) : (
          value.blocks.map((block, index) => {
            const def = getBlockDef(block.kind)
            const Editor = def?.Editor
            return (
              <Card key={block.id} bordered padding="$3" gap="$3">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="$4" fontWeight="600">
                    {def?.label ?? block.kind}
                  </Text>
                  <XStack gap="$2">
                    <Button
                      size="$2"
                      icon={ChevronUp}
                      disabled={index === 0}
                      aria-label="Move block up"
                      onPress={() =>
                        dispatch({ type: 'move-block', id: block.id, direction: 'up' })
                      }
                    />
                    <Button
                      size="$2"
                      icon={ChevronDown}
                      disabled={index === value.blocks.length - 1}
                      aria-label="Move block down"
                      onPress={() =>
                        dispatch({ type: 'move-block', id: block.id, direction: 'down' })
                      }
                    />
                    <Button
                      size="$2"
                      theme="red"
                      icon={Trash2}
                      aria-label="Remove block"
                      onPress={() => dispatch({ type: 'remove-block', id: block.id })}
                    />
                  </XStack>
                </XStack>
                <Separator />
                {Editor ? (
                  <Editor
                    block={block}
                    onChange={(next) =>
                      dispatch({ type: 'patch-block', id: block.id, patch: next })
                    }
                    onRemove={() => dispatch({ type: 'remove-block', id: block.id })}
                  />
                ) : (
                  <Text color="$red10">No editor registered for block kind "{block.kind}"</Text>
                )}
              </Card>
            )
          })
        )}
      </YStack>

      {/* ---- Toolbar (add blocks) ------------------------------------------ */}
      <Card bordered padding="$3" gap="$2" backgroundColor="$backgroundHover">
        <Text fontSize="$3" fontWeight="600">
          Add a block
        </Text>
        <XStack gap="$2" flexWrap="wrap">
          {listBlockDefs().map((def) => (
            <Button
              key={def.kind}
              size="$3"
              icon={def.icon ?? Plus}
              onPress={() => dispatch({ type: 'add-block', block: def.make() })}
            >
              {def.label}
            </Button>
          ))}
        </XStack>
      </Card>

      {/* ---- Publish (validate-on-publish only) ---------------------------- */}
      {onPublish ? (
        <YStack gap="$2">
          {publishErrors.length > 0 ? (
            <Text fontSize="$3" color="$red10">
              {publishErrors.join(' · ')}
            </Text>
          ) : null}
          <XStack>
            <Button theme="green" disabled={!canPublish} onPress={() => onPublish(value)}>
              Publish
            </Button>
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  )
}
