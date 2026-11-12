import { useCallback, useEffect, useRef, useState } from 'react'
import type { ApiResult, InviteApiError } from './types'

/**
 * Who the invite pages act as (spec §6), shared by the invitation page and the
 * swap response page.
 *
 * The platform supplies the session operations as SLOTS (this package never
 * imports next-auth). The flow:
 *
 *  - The API answers SESSION_MISMATCH (signed in as someone else, but the link's
 *    token is the speaker's own): sign that session out quietly, exchange the
 *    token for a `recognized` session as the speaker, and load again. The page
 *    then shows a one-line notice. This runs once per page load, never in a loop.
 *  - SIGN_IN_REQUIRED: the page offers the normal sign-in flow, returning here.
 *  - NOT_INVITEE / NOT_FOUND: a clear message, never a blank page (ADR-0005).
 *
 * Loading is a GET and never mutates.
 */
export interface InviteIdentitySlots {
  /** Sign the current session out without navigating away. */
  signOutQuietly: () => Promise<void>
  /** Exchange the email-link token for a `recognized` session. Resolves true on success. */
  signInWithToken: (token: string) => Promise<boolean>
  /** Start the normal sign-in flow (OTP / Google), returning to `callbackUrl`. */
  startSignIn: (callbackUrl: string) => void
  /** Sign out, then start the normal sign-in flow, returning to `callbackUrl`. */
  signInAgain: (callbackUrl: string) => void
  /** Optional: tell the platform the session changed (refresh the nav). */
  onSessionChanged?: () => void
}

export type InvitePhase = 'loading' | 'ready' | 'sign-in' | 'not-invitee' | 'not-found' | 'error'

export interface InviteIdentityState<T> {
  phase: InvitePhase
  data: T | null
  error: InviteApiError | null
  /** True after this page signed someone else out and switched to the speaker. */
  switched: boolean
  setData: (data: T) => void
  reload: () => Promise<void>
  /**
   * Route an action's refusal through the same identity handling. Returns true
   * when it was an identity refusal (the hook has taken over), false otherwise.
   */
  handleRefusal: (error: InviteApiError) => Promise<boolean>
}

export function useInviteIdentity<T>({
  load,
  token,
  slots,
}: {
  load: () => Promise<ApiResult<T>>
  token: string | null
  slots: InviteIdentitySlots
}): InviteIdentityState<T> {
  const [phase, setPhase] = useState<InvitePhase>('loading')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<InviteApiError | null>(null)
  const [switched, setSwitched] = useState(false)
  const switchTried = useRef(false)
  const loadRef = useRef(load)
  loadRef.current = load
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  const switchToSpeaker = useCallback(async (): Promise<boolean> => {
    if (switchTried.current || !token) return false
    switchTried.current = true
    const s = slotsRef.current
    try {
      await s.signOutQuietly()
    } catch {
      return false
    }
    // Even if the exchange fails, the token alone still recognizes the speaker
    // on the next load (the other session is gone either way).
    await s.signInWithToken(token).catch(() => false)
    s.onSessionChanged?.()
    setSwitched(true)
    return true
  }, [token])

  const run = useCallback(async (): Promise<void> => {
    setPhase('loading')
    const res = await loadRef.current()
    if (res.ok) {
      setData(res.data)
      setError(null)
      setPhase('ready')
      return
    }
    const code = res.error.code
    if (code === 'SESSION_MISMATCH' && (await switchToSpeaker())) {
      return run()
    }
    setError(res.error)
    setPhase(
      code === 'SIGN_IN_REQUIRED'
        ? 'sign-in'
        : code === 'NOT_INVITEE' || code === 'SESSION_MISMATCH'
          ? 'not-invitee'
          : code === 'NOT_FOUND'
            ? 'not-found'
            : 'error'
    )
  }, [switchToSpeaker])

  useEffect(() => {
    void run()
  }, [run])

  const handleRefusal = useCallback(
    async (err: InviteApiError): Promise<boolean> => {
      if (err.code === 'SESSION_MISMATCH' || err.code === 'SIGN_IN_REQUIRED' || err.code === 'NOT_INVITEE') {
        if (err.code === 'SESSION_MISMATCH') switchTried.current = false
        await run()
        return true
      }
      return false
    },
    [run]
  )

  return { phase, data, error, switched, setData, reload: run, handleRefusal }
}
