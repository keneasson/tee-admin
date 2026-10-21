'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { LoadingState } from '@my/ui'
import { WhoAreYou, type WhoAreYouChoice } from '@my/app/features/who-are-you'

function WhoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status, update } = useSession()
  const rawCallback = searchParams?.get('callbackUrl') ?? ''
  // Same-origin paths only — never an open redirect.
  const returnTo = /^\/(?![/\\])/.test(rawCallback) && !rawCallback.startsWith('/auth/') ? rawCallback : '/profile'

  const [choices, setChoices] = useState<WhoAreYouChoice[] | null>(null)
  const [current, setCurrent] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/auth/signin')
    if (status !== 'authenticated') return
    fetch('/api/auth/who')
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load')
        // Nobody to choose between: nothing to ask.
        if (data.choices.length < 2) return router.replace(returnTo)
        setChoices(data.choices)
        setCurrent(data.current)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'))
  }, [status, router, returnTo])

  const choose = async (personId: string) => {
    setSaving(personId)
    setError(null)
    try {
      const res = await fetch('/api/auth/who', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not switch')
      // The jwt callback re-checks the choice against the proven address.
      const next = await update({ personId })
      if ((next?.user as { personId?: string } | undefined)?.personId !== personId) {
        throw new Error('Could not switch')
      }
      router.replace(returnTo)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch')
      setSaving(null)
    }
  }

  return (
    <WhoAreYou
      address={(session?.user as { signInEmail?: string } | undefined)?.signInEmail ?? session?.user?.email ?? null}
      choices={choices}
      current={current}
      saving={saving}
      error={error}
      onChoose={choose}
    />
  )
}

export default function Page() {
  const isHydrated = useHydrated()
  if (!isHydrated) return <LoadingState label="sign-in" inline />
  return (
    <Suspense fallback={<LoadingState label="sign-in" inline />}>
      <WhoPage />
    </Suspense>
  )
}
