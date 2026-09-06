'use client'

/**
 * PostEditorScreen — the whole authoring surface for one Post, minus the parts
 * only a platform can supply.
 *
 * This is the screen the route file used to BE. It owns the gates, the header,
 * the save indicator, the editor-mode toggle and the editor itself; the platform
 * hands it auth state, navigation callbacks and a document canvas, exactly the
 * prop-down contract CLAUDE.md requires of shared packages. The Next.js route is
 * now a mount point, and an Expo screen can reuse this file verbatim.
 *
 * ONE editor for CREATE and EDIT (the one-editor principle): `routeId === 'new'`
 * seeds an empty draft, anything else loads that post, and both render the same
 * editor. `renderDocEditor` supplies the document canvas (Lexical on web); when
 * it is omitted the block-form editor is the only mode — which is what a
 * platform without a canvas implementation gets, with no code change here.
 */

import { useState, type ReactNode } from 'react'
import { Text, XStack, YStack, Button, LoadingState, ErrorState, PageHeader } from '@my/ui'
import { PostEditor } from '@my/ui/src/post-editor'
import type { Post } from '../../types/post'
import { usePostEditorState, type SaveState } from './use-post-editor-state'
import { PostSendPanel } from './post-send-panel'

/** What a platform's document canvas receives — the editor's controlled contract. */
export interface PostDocEditorSlotProps {
  value: Post
  onChange: (next: Post) => void
  onPublish: (post: Post) => void
  seriesPosts: Array<{ id: string; title: string }>
  onSeriesPostPress: (postId: string) => void
}

export interface PostEditorScreenProps {
  /** Route id — `'new'` seeds an empty draft. */
  routeId: string | undefined
  /** Owning tenant for a brand-new draft. */
  tenant: string
  /** Author for a brand-new draft (signed-in user's email). */
  authorId: string
  /** Platform auth state, passed down (never read from inside a package). */
  hasAccess: boolean
  isAuthLoading: boolean
  /** Platform navigation, passed down. */
  onOpenPost: (postId: string) => void
  onBack: () => void
  /**
   * The document canvas (Lexical on web). Omit on a platform that has none —
   * the block-form editor then stands alone and the toggle is hidden.
   */
  renderDocEditor?: (props: PostDocEditorSlotProps) => ReactNode
  /**
   * Platform confirmation for the "Send announcement" panel. Omit it and the
   * panel is not rendered at all — a platform with no confirmation affordance
   * must not be able to fire a live send by accident (the send bridge is also
   * gated server-side on auth, CONSOLIDATED_CMS, `ready` status and tenant).
   */
  confirmSend?: (message: string) => boolean | Promise<boolean>
}

const SAVE_LABELS: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'All changes saved',
  error: 'Save failed — retrying on next edit',
}

export function PostEditorScreen({
  routeId,
  tenant,
  authorId,
  hasAccess,
  isAuthLoading,
  onOpenPost,
  onBack,
  renderDocEditor,
  confirmSend,
}: PostEditorScreenProps) {
  // Which editor is mounted. The document canvas is the default (Consolidated
  // CMS keystone); the block-form editor stays a one-click rollout fallback —
  // both honour the same value/onChange contract.
  const [editorMode, setEditorMode] = useState<'doc' | 'classic'>('doc')

  const { post, loadError, saveState, seriesPosts, onChange, onPublish } = usePostEditorState({
    routeId,
    tenant,
    authorId,
    enabled: hasAccess,
  })

  if (isAuthLoading || !hasAccess) return <LoadingState />
  if (loadError) {
    return (
      <ErrorState title="Post" message={loadError} actionLabel="Back" onAction={onBack} />
    )
  }
  if (!post) return <LoadingState label="post" />

  const showDoc = editorMode === 'doc' && Boolean(renderDocEditor)
  const editorProps: PostDocEditorSlotProps = {
    value: post,
    onChange,
    onPublish,
    seriesPosts,
    onSeriesPostPress: onOpenPost,
  }

  return (
    <YStack flex={1} padding="$4" gap="$3">
      <PageHeader
        title={routeId === 'new' ? 'New post' : 'Edit post'}
        actions={
          <>
            <Text
              fontSize="$2"
              color={saveState === 'error' ? '$red10' : '$color10'}
              minHeight={16}
            >
              {SAVE_LABELS[saveState]}
            </Text>
            {renderDocEditor ? (
              <Button
                size="$2"
                variant="outlined"
                onPress={() => setEditorMode((m) => (m === 'doc' ? 'classic' : 'doc'))}
              >
                {showDoc ? 'Use classic editor' : 'Use document editor'}
              </Button>
            ) : null}
          </>
        }
      />

      {showDoc ? renderDocEditor!(editorProps) : <PostEditor {...editorProps} />}

      {confirmSend ? (
        <PostSendPanel
          postId={post.id}
          ready={post.status === 'ready'}
          confirmSend={confirmSend}
        />
      ) : null}
    </YStack>
  )
}
