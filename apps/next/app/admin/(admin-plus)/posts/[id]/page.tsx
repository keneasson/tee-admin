'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { YStack, XStack, Text, Spinner, Heading, Button } from '@my/ui'
import { PostEditor, createEmptyPost, validateForPublish } from '@my/ui/src/post-editor'
import { useAdminAccess } from '@/hooks/use-admin-access'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { getPost, createPost, updatePost, getPostSeries } from '@my/app/provider/get-data'
import { HOME_ECCLESIA } from '@my/app/config/home-ecclesia'
import type { Post } from '@my/app/types/post'

/**
 * /admin/posts/[id] — the unified Post block editor (Consolidated CMS Phase 2a).
 *
 * ONE page/component for CREATE and EDIT (the one-editor principle):
 *   - id === 'new'  → start from `createEmptyPost` (an empty draft),
 *   - otherwise     → `getPost(id)` loads the existing Post,
 * and BOTH render the SAME `<PostEditor>`. Session (author) comes from the
 * platform (`useAdminAccess`) and is passed IN — the editor never reaches out.
 *
 * Autosave: debounced PUT (POST on first save of a brand-new draft to mint the
 * id). Publish validates (title + >=1 block) then flips status → 'ready'.
 * Flag-gated at the API (owner/admin + CONSOLIDATED_CMS); the page mirrors the
 * admin-access gate the other /admin pages use.
 */
export default function AdminPostEditorPage() {
  const isHydrated = useHydrated()
  const { hasAccess, isLoading, user } = useAdminAccess()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const routeId = params?.id

  const [post, setPost] = useState<Post | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [seriesPosts, setSeriesPosts] = useState<Array<{ id: string; title: string }>>([])

  // The server-assigned id once the draft has been created (starts '' for new).
  const savedIdRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)

  const authorId = user?.email || 'unknown'

  // ---- Load (or seed an empty draft) ---------------------------------------
  useEffect(() => {
    if (!hasAccess || !routeId) return
    let cancelled = false

    if (routeId === 'new') {
      setPost(createEmptyPost(HOME_ECCLESIA.canonicalName, authorId))
      savedIdRef.current = ''
      return
    }

    getPost(routeId)
      .then((loaded) => {
        if (cancelled) return
        setPost(loaded)
        savedIdRef.current = loaded.id
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load post')
      })

    return () => {
      cancelled = true
    }
  }, [hasAccess, routeId, authorId])

  // ---- Connect/series indicator ("part of a series — N related") -----------
  useEffect(() => {
    if (!hasAccess || !post?.id || !post.seriesId) {
      setSeriesPosts([])
      return
    }
    let cancelled = false
    getPostSeries(post.id)
      .then((siblings) => {
        if (cancelled) return
        setSeriesPosts(siblings.map((s) => ({ id: s.id, title: s.title })))
      })
      .catch(() => {
        // Non-critical — the indicator simply stays hidden on failure.
        if (!cancelled) setSeriesPosts([])
      })
    return () => {
      cancelled = true
    }
  }, [hasAccess, post?.id, post?.seriesId])

  // ---- Persist (create-then-update) ----------------------------------------
  const persist = useCallback(async (next: Post): Promise<Post | null> => {
    if (inFlightRef.current) return null
    inFlightRef.current = true
    setSaveState('saving')
    try {
      let result: Post
      if (savedIdRef.current) {
        result = await updatePost(savedIdRef.current, next)
      } else {
        result = await createPost(next)
        savedIdRef.current = result.id
      }
      setSaveState('saved')
      return result
    } catch (err) {
      console.error('Post save failed:', err)
      setSaveState('error')
      return null
    } finally {
      inFlightRef.current = false
    }
  }, [])

  // ---- Controlled change → debounced autosave ------------------------------
  const handleChange = useCallback(
    (next: Post) => {
      setPost(next)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void persist(next)
      }, 1000)
    },
    [persist]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ---- Publish (validate-on-publish only) ----------------------------------
  const handlePublish = useCallback(
    async (toPublish: Post) => {
      const errors = validateForPublish(toPublish)
      if (errors.length > 0) return // editor already surfaces these inline
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const ready: Post = { ...toPublish, status: 'ready' }
      const result = await persist(ready)
      if (result) {
        // Same editor stays mounted (one-editor principle) — status is now
        // 'ready'. A dedicated posts list / router redirect is a later slice.
        setPost(result)
      }
    },
    [persist]
  )

  // ---- Gates ---------------------------------------------------------------
  if (!isHydrated || isLoading || !hasAccess) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  if (loadError) {
    return (
      <YStack flex={1} padding="$4" gap="$3">
        <Heading size="$7">Post</Heading>
        <Text color="$red10">{loadError}</Text>
        <XStack>
          <Button variant="outlined" onPress={() => router.push('/admin')}>
            Back
          </Button>
        </XStack>
      </YStack>
    )
  }

  if (!post) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="large" width={36} height={36} />
        <Text marginTop="$4">Loading post...</Text>
      </YStack>
    )
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'All changes saved'
        : saveState === 'error'
          ? 'Save failed — retrying on next edit'
          : ''

  return (
    <YStack flex={1} padding="$4" gap="$3">
      <XStack justifyContent="space-between" alignItems="center">
        <Heading size="$7">{routeId === 'new' ? 'New post' : 'Edit post'}</Heading>
        <Text
          fontSize="$2"
          color={saveState === 'error' ? '$red10' : '$color10'}
          minHeight={16}
        >
          {saveLabel}
        </Text>
      </XStack>

      <PostEditor
        value={post}
        onChange={handleChange}
        onPublish={handlePublish}
        seriesPosts={seriesPosts}
        onSeriesPostPress={(id) => router.push(`/admin/posts/${id}`)}
      />
    </YStack>
  )
}
