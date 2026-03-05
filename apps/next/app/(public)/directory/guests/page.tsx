'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, Spinner, Text } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useUserRole } from '@/hooks/use-user-role'
import { DirectoryTabs } from '@my/ui/src/directory/directory-tabs'
import { GuestList } from '@my/ui/src/directory/guest-list'
import type { GuestUser } from '@my/ui/src/directory/types'

export default function DirectoryGuestsPage() {
  const { isMemberOrHigher, isRecorderOrHigher, isAdminOrOwner, isLoading: authLoading, status } = useUserRole()
  const isHydrated = useHydrated()
  const router = useRouter()

  const [guests, setGuests] = useState<GuestUser[]>([])
  const [loading, setLoading] = useState(true)
  const [promotingEmail, setPromotingEmail] = useState<string | null>(null)

  // Tab badge counts
  const [pendingDraftCount, setPendingDraftCount] = useState(0)

  const fetchGuests = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/people/guests')
      if (res.ok) {
        const data = await res.json()
        setGuests(data.guests || [])
      }
    } catch (error) {
      console.error('Error fetching guests:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch draft count for tab badge
  useEffect(() => {
    if (!isRecorderOrHigher) return
    const fetchDrafts = async () => {
      try {
        const res = await fetch('/api/people/drafts')
        if (res.ok) {
          const data = await res.json()
          setPendingDraftCount((data.drafts || []).length)
        }
      } catch { /* ignore */ }
    }
    fetchDrafts()
  }, [isRecorderOrHigher])

  useEffect(() => {
    if (isRecorderOrHigher) {
      fetchGuests()
    }
  }, [isRecorderOrHigher, fetchGuests])

  const handlePromoteGuest = async (email: string, name: string) => {
    const confirmed = window.confirm(
      `Promote "${name}" (${email}) to member? They will gain full member access.`
    )
    if (!confirmed) return

    setPromotingEmail(email)
    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newRole: 'member' }),
      })
      if (res.ok) {
        // Refresh guest list
        fetchGuests()
      } else {
        const data = await res.json()
        alert(`Failed to promote: ${data.error}`)
      }
    } catch (error) {
      console.error('Error promoting guest:', error)
      alert('Failed to promote guest')
    } finally {
      setPromotingEmail(null)
    }
  }

  const handleTabChange = (tab: string) => {
    if (tab === 'ecclesias') router.push('/directory/ecclesias')
    if (tab === 'people') router.push('/directory/people')
  }

  if (!isHydrated || authLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="small" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  if (status === 'unauthenticated' || !isRecorderOrHigher) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text>You need recorder access or higher to view guest users.</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <DirectoryTabs
        activeTab="guests"
        onTabChange={handleTabChange}
        pendingDraftCount={pendingDraftCount}
        guestCount={guests.length}
        showGuestTab={isRecorderOrHigher}
      />

      <GuestList
        guests={guests}
        loading={loading}
        onViewGuest={(id) => router.push(`/people/${id}`)}
        onPromoteGuest={handlePromoteGuest}
        actionLabel={isAdminOrOwner ? 'Make Member' : 'Accept'}
        promotingEmail={promotingEmail}
      />
    </YStack>
  )
}
