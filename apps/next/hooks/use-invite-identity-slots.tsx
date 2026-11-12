'use client'

import { useMemo } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { InviteIdentitySlots } from '@my/app/features/speaker-invites'

/**
 * The web session operations the shared invite screens need (spec §6),
 * supplied as slots so `packages/app` never imports next-auth.
 *
 *  - signInWithToken: the existing one-click path (`/auth/signin-token`):
 *    resolve the token's email, then the `otp` provider with `ecclesiaToken`,
 *    which mints a `recognized` session.
 *  - signInAgain: sign out, then the normal sign-in page with a callbackUrl.
 */
export function useInviteIdentitySlots(): InviteIdentitySlots {
  const router = useRouter()
  const { update } = useSession()

  return useMemo<InviteIdentitySlots>(
    () => ({
      signOutQuietly: async () => {
        await signOut({ redirect: false })
      },
      signInWithToken: async (token: string) => {
        const res = await fetch(`/api/auth/resolve-signin-token?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        })
        const data = (await res.json().catch(() => null)) as { valid?: boolean; email?: string | null } | null
        if (!data?.valid || !data.email) return false
        const result = await signIn('otp', { email: data.email, ecclesiaToken: token, redirect: false })
        return !result?.error
      },
      startSignIn: (callbackUrl: string) => {
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
      },
      signInAgain: (callbackUrl: string) => {
        void signOut({ redirect: false }).finally(() => {
          router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
        })
      },
      onSessionChanged: () => {
        void update()
      },
    }),
    [router, update]
  )
}

/** Strip `token` from a path + query, for the "Sign in again" return trip. */
export function withoutToken(path: string, params: URLSearchParams | null): string {
  const next = new URLSearchParams(params?.toString() ?? '')
  next.delete('token')
  const q = next.toString()
  return q ? `${path}?${q}` : path
}
