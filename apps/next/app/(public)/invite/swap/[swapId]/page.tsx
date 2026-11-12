'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { LoadingState } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { SwapResponseScreen } from '@my/app/features/speaker-invites'
import { useInviteIdentitySlots, withoutToken } from '@/hooks/use-invite-identity-slots'

/** The other speaker's swap response page (spec §7). Mount point only. */
function SwapPage() {
  const isHydrated = useHydrated()
  const params = useParams()
  const searchParams = useSearchParams()
  const slots = useInviteIdentitySlots()
  const swapId = params?.swapId as string
  const path = `/invite/swap/${swapId}`
  const query = searchParams?.toString() ?? ''
  const action = searchParams?.get('action')

  if (!isHydrated) return <LoadingState label="swap request" />

  return (
    <SwapResponseScreen
      swapId={swapId}
      token={searchParams?.get('token') ?? null}
      preselectAction={action === 'accept' || action === 'decline' ? action : null}
      slots={slots}
      selfUrl={query ? `${path}?${query}` : path}
      selfUrlWithoutToken={withoutToken(path, searchParams)}
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="swap request" />}>
      <SwapPage />
    </Suspense>
  )
}
