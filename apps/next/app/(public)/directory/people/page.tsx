'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, Text, Spinner } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useUserRole } from '@/hooks/use-user-role'
import { DirectoryTabs } from '@my/ui/src/directory/directory-tabs'
import { PersonList } from '@my/ui/src/directory/person-list'
import { DraftReviewPanel } from '@my/ui/src/people/draft-review-panel'
import type { DirectoryMember, DraftMember } from '@my/ui/src/directory/types'

const ECCLESIA_SESSION_KEY = 'directory-selected-ecclesia'

export default function DirectoryPeoplePage() {
  const { isMemberOrHigher, isRecorderOrHigher, isAdminOrOwner, isLoading: authLoading, status } = useUserRole()
  const router = useRouter()
  const isHydrated = useHydrated()

  const [members, setMembers] = useState<DirectoryMember[]>([])
  const [ecclesias, setEcclesias] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEcclesia, setSelectedEcclesia] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return sessionStorage.getItem(ECCLESIA_SESSION_KEY)
  })
  const [viewerEcclesia, setViewerEcclesia] = useState<string | null>(null)
  const defaultApplied = useRef(false)

  // Draft review state
  const [drafts, setDrafts] = useState<DraftMember[]>([])
  const [showDraftPanel, setShowDraftPanel] = useState(false)

  // Guest count for tab badge
  const [guestCount, setGuestCount] = useState(0)

  const canReviewDrafts = isRecorderOrHigher

  // When search has 3+ chars, search all ecclesias
  const isGlobalSearch = searchQuery.length >= 3

  const fetchMembers = useCallback(async (ecclesiaOverride?: string | null) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      const ecc = ecclesiaOverride !== undefined ? ecclesiaOverride : selectedEcclesia
      if (ecc && !isGlobalSearch) params.set('ecclesia', ecc)

      const res = await fetch(`/api/people?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || [])
        setEcclesias(data.ecclesias || [])
        if (data.guestCount !== undefined) {
          setGuestCount(data.guestCount)
        }

        // On first load, use session-stored ecclesia or default to viewer's home ecclesia
        if (!defaultApplied.current && data.viewerEcclesia) {
          defaultApplied.current = true
          setViewerEcclesia(data.viewerEcclesia)
          // Only apply default if no session-stored selection exists
          if (!selectedEcclesia) {
            setSelectedEcclesia(data.viewerEcclesia)
            sessionStorage.setItem(ECCLESIA_SESSION_KEY, data.viewerEcclesia)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedEcclesia, isGlobalSearch])

  // Fetch drafts
  const fetchDrafts = useCallback(async () => {
    if (!canReviewDrafts) return
    try {
      const params = new URLSearchParams()
      if (selectedEcclesia && !isAdminOrOwner) {
        params.set('ecclesia', selectedEcclesia)
      }
      const res = await fetch(`/api/people/drafts?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDrafts(data.drafts || [])
      }
    } catch (error) {
      console.error('Error fetching drafts:', error)
    }
  }, [canReviewDrafts, isAdminOrOwner, selectedEcclesia])

  useEffect(() => {
    if (isMemberOrHigher) {
      fetchMembers()
    }
  }, [isMemberOrHigher, fetchMembers])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  const handleEcclesiaChange = useCallback((ecclesia: string | null) => {
    setSelectedEcclesia(ecclesia)
    if (ecclesia) {
      sessionStorage.setItem(ECCLESIA_SESSION_KEY, ecclesia)
    } else {
      sessionStorage.removeItem(ECCLESIA_SESSION_KEY)
    }
  }, [])

  const handleMemberClick = (id: string) => {
    router.push(`/people/${id}`)
  }

  const handleApproveDraft = async (draftId: string, ecclesia: string) => {
    const res = await fetch(`/api/people/drafts/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', ecclesia }),
    })
    if (res.ok) {
      fetchDrafts()
      fetchMembers()
    }
  }

  const handleRejectDraft = async (draftId: string, ecclesia: string, note?: string) => {
    const res = await fetch(`/api/people/drafts/${draftId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', ecclesia, note }),
    })
    if (res.ok) {
      fetchDrafts()
    }
  }

  if (!isHydrated || authLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Spinner size="small" />
        <Text marginTop="$4">Loading...</Text>
      </YStack>
    )
  }

  if (status === 'unauthenticated' || !isMemberOrHigher) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
        <Text>Please sign in to view the contact list.</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <DirectoryTabs
        activeTab="people"
        onTabChange={(tab) => {
          if (tab === 'ecclesias') router.push('/directory/ecclesias')
          if (tab === 'guests') router.push('/directory/guests')
        }}
        pendingDraftCount={drafts.length}
        guestCount={guestCount}
        showGuestTab={isRecorderOrHigher}
      />

      {/* Draft review panel */}
      {showDraftPanel && canReviewDrafts ? (
        <DraftReviewPanel
          drafts={drafts}
          onApprove={handleApproveDraft}
          onReject={handleRejectDraft}
        />
      ) : null}

      <PersonList
        members={members}
        ecclesias={ecclesias}
        loading={loading}
        defaultEcclesia={selectedEcclesia}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedEcclesia={selectedEcclesia}
        onEcclesiaChange={handleEcclesiaChange}
        onMemberClick={handleMemberClick}
        canAddMember={isMemberOrHigher}
        onAddMember={() => router.push('/directory/people/add')}
        pendingDraftCount={drafts.length}
        onShowDrafts={() => setShowDraftPanel(!showDraftPanel)}
        canReviewDrafts={canReviewDrafts}
      />
    </YStack>
  )
}
