'use client'

import { Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { LoadingState } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { InviteeInviteScreen } from '@my/app/features/speaker-invites'
import { Verify } from '@/components/verify/verify'
import { useInviteIdentitySlots, withoutToken } from '@/hooks/use-invite-identity-slots'

/** The invitee's page (spec §6, §9). Mount point only — the screen is shared. */
function InvitePage() {
  const isHydrated = useHydrated()
  const params = useParams()
  const searchParams = useSearchParams()
  const slots = useInviteIdentitySlots()
  const inviteId = params?.inviteId as string
  const path = `/invite/${inviteId}`
  const query = searchParams?.toString() ?? ''

  if (!isHydrated) return <LoadingState label="invitation" />

  return (
    <InviteeInviteScreen
      inviteId={inviteId}
      token={searchParams?.get('token') ?? null}
      preselectDate={searchParams?.get('date') ?? null}
      slots={slots}
      selfUrl={query ? `${path}?${query}` : path}
      selfUrlWithoutToken={withoutToken(path, searchParams)}
      renderStepUp={({ reason, onVerified, onCancel }) => (
        <Verify reason={reason} onVerified={onVerified} onCancel={onCancel} />
      )}
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="invitation" />}>
      <InvitePage />
    </Suspense>
  )
}
