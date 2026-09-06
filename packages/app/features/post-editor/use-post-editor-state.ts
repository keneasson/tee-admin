'use client'

/**
 * The post authoring STATE MACHINE — load / seed, series lookup, debounced
 * autosave (create-then-update) and publish.
 *
 * WHY IT IS HERE AND NOT IN THE PAGE: none of this is web-specific. It is the
 * rules of editing a Post — when a draft mints its id, how often edits flush,
 * what publish validates — and an Expo screen needs exactly the same rules. It
 * had been inlined in `apps/next/app/admin/posts/[id]/page.tsx`, which made the
 * route file 240 lines and put the behaviour out of reach of native.
 *
 * Cross-platform: React + the shared data provider only — no next/navigation,
 * no next-auth, no DOM. Auth (`authorId`, `enabled`) is passed IN by the
 * platform, per the package rules in CLAUDE.md.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createEmptyPost, validateForPublish } from '@my/ui/src/post-editor'
import { getPost, createPost, updatePost, getPostSeries } from '../../provider/get-data'
import type { Post } from '../../types/post'

/** How long edits settle before a save is flushed. */
export const AUTOSAVE_DEBOUNCE_MS = 1000

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface UsePostEditorStateOptions {
  /** Route id — `'new'` seeds an empty draft, anything else loads that post. */
  routeId: string | undefined
  /** Owning tenant for a brand-new draft. */
  tenant: string
  /** Author for a brand-new draft (the signed-in user's email). */
  authorId: string
  /** Gate: stays idle until the platform confirms the user may edit. */
  enabled: boolean
}

export interface PostEditorState {
  post: Post | null
  loadError: string | null
  saveState: SaveState
  seriesPosts: Array<{ id: string; title: string }>
  onChange: (next: Post) => void
  onPublish: (toPublish: Post) => Promise<void>
}

export function usePostEditorState({
  routeId,
  tenant,
  authorId,
  enabled,
}: UsePostEditorStateOptions): PostEditorState {
  const [post, setPost] = useState<Post | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [seriesPosts, setSeriesPosts] = useState<Array<{ id: string; title: string }>>([])

  // The server-assigned id once the draft has been created (starts '' for new).
  const savedIdRef = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)

  // ---- Load (or seed an empty draft) ---------------------------------------
  useEffect(() => {
    if (!enabled || !routeId) return
    let cancelled = false

    if (routeId === 'new') {
      setPost(createEmptyPost(tenant, authorId))
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
  }, [enabled, routeId, tenant, authorId])

  // ---- Connect/series indicator ("part of a series — N related") -----------
  useEffect(() => {
    if (!enabled || !post?.id || !post.seriesId) {
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
  }, [enabled, post?.id, post?.seriesId])

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
  const onChange = useCallback(
    (next: Post) => {
      setPost(next)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void persist(next)
      }, AUTOSAVE_DEBOUNCE_MS)
    },
    [persist]
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // ---- Publish (validate-on-publish only) ----------------------------------
  const onPublish = useCallback(
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

  return { post, loadError, saveState, seriesPosts, onChange, onPublish }
}
