'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { YStack, Spinner, Text } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useUserRole } from '@/hooks/use-user-role'
import { DirectoryTabs } from '@my/ui/src/directory/directory-tabs'
import { EcclesiaList } from '@my/ui/src/directory/ecclesia-list'
import { AddEcclesiaModal } from '@my/ui/src/form/add-ecclesia-modal'
import { Dialog } from 'tamagui'
import { Button } from '@my/ui'
import { Card, Input, ScrollView, XStack } from 'tamagui'
import { ArrowRightLeft, Search, Users } from '@tamagui/lucide-icons'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import type { EcclesiaListItem, DirectoryAuthProps } from '@my/ui/src/directory/types'

export default function DirectoryEcclesiasPage() {
  const { isMemberOrHigher, isRecorderOrHigher, isAdminOrOwner, isLoading: authLoading, status } = useUserRole()
  const isHydrated = useHydrated()
  const router = useRouter()

  const [ecclesias, setEcclesias] = useState<EcclesiaListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewerEcclesia, setViewerEcclesia] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState('')

  // Delete/transfer state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [ecclesiaToDelete, setEcclesiaToDelete] = useState<EcclesiaListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [targetEcclesia, setTargetEcclesia] = useState<EcclesiaListItem | null>(null)
  const [ecclesiaSearch, setEcclesiaSearch] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)

  // Pending draft count for tab badge
  const [pendingDraftCount, setPendingDraftCount] = useState(0)

  // Guest count for tab badge
  const [guestCount, setGuestCount] = useState(0)

  // Fetch user profile
  useEffect(() => {
    if (!isMemberOrHigher) return
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setCurrentUserEmail(data.user?.email || '')
          setViewerEcclesia(data.user?.ecclesia || null)
        }
      } catch { /* ignore */ }
    }
    fetchProfile()
  }, [isMemberOrHigher])

  // Fetch ecclesias
  const fetchEcclesias = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/ecclesias')
      if (res.ok) {
        const data = await res.json()
        setEcclesias(data.ecclesias || [])
      }
    } catch (error) {
      console.error('Error fetching ecclesias:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch draft count and guest count for badges
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
    const fetchGuestCount = async () => {
      try {
        const res = await fetch('/api/people/guests')
        if (res.ok) {
          const data = await res.json()
          setGuestCount(data.total || 0)
        }
      } catch { /* ignore */ }
    }
    fetchDrafts()
    fetchGuestCount()
  }, [isRecorderOrHigher])

  useEffect(() => {
    if (isMemberOrHigher) {
      fetchEcclesias()
    }
  }, [isMemberOrHigher, fetchEcclesias])

  const handleDeleteClick = (ecclesia: EcclesiaListItem) => {
    setEcclesiaToDelete(ecclesia)
    if (ecclesia.memberCount && ecclesia.memberCount > 0) {
      setTargetEcclesia(null)
      setEcclesiaSearch('')
      setTransferDialogOpen(true)
    } else {
      setDeleteConfirmOpen(true)
    }
  }

  const handleConfirmDelete = async () => {
    if (!ecclesiaToDelete) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/ecclesia?name=${encodeURIComponent(ecclesiaToDelete.name)}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setDeleteConfirmOpen(false)
        setEcclesiaToDelete(null)
        fetchEcclesias()
      } else {
        const data = await response.json()
        alert(`Failed to delete: ${data.error}`)
      }
    } catch (error) {
      console.error('Error deleting ecclesia:', error)
      alert('Failed to delete ecclesia')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleTransferAndDelete = async () => {
    if (!ecclesiaToDelete || !targetEcclesia) return
    setIsTransferring(true)
    try {
      const response = await fetch('/api/admin/ecclesias/transfer-and-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEcclesia: ecclesiaToDelete.name,
          targetEcclesia: targetEcclesia.name,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setTransferDialogOpen(false)
        setEcclesiaToDelete(null)
        setTargetEcclesia(null)
        fetchEcclesias()
      } else {
        alert(data.error || 'Transfer failed')
      }
    } catch {
      alert('Failed to transfer members and delete ecclesia')
    } finally {
      setIsTransferring(false)
    }
  }

  const transferTargetOptions = ecclesias.filter((e) => {
    if (!ecclesiaToDelete) return false
    if (e.name === ecclesiaToDelete.name) return false
    if (!ecclesiaSearch) return true
    const search = ecclesiaSearch.toLowerCase()
    return (
      e.name.toLowerCase().includes(search) ||
      e.city?.toLowerCase().includes(search)
    )
  })

  const authProps: DirectoryAuthProps = {
    isMemberOrHigher,
    isRecorderOrHigher,
    isAdminOrOwner,
    currentUserEmail,
    viewerEcclesia,
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
        <Text>Please sign in to view the directory.</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} padding="$4" gap="$4">
      <DirectoryTabs
        activeTab="ecclesias"
        onTabChange={(tab) => {
          if (tab === 'people') router.push('/directory/people')
          if (tab === 'guests') router.push('/directory/guests')
        }}
        pendingDraftCount={pendingDraftCount}
        guestCount={guestCount}
        showGuestTab={isRecorderOrHigher}
      />

      <EcclesiaList
        ecclesias={ecclesias}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onViewEcclesia={(name) => router.push(`/directory/ecclesias/${encodeURIComponent(name)}`)}
        onAddEcclesia={() => setModalOpen(true)}
        authProps={authProps}
      />

      {/* Add Ecclesia Modal */}
      <AddEcclesiaModal
        isOpen={modalOpen}
        onOpenChange={setModalOpen}
        mode="add"
        onEcclesiaAdded={() => fetchEcclesias()}
      />

      {/* Delete Confirmation Modal (0 members) */}
      <Dialog modal open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            key="content"
            bordered
            elevate
            animation="quick"
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
            padding="$4"
          >
            <Dialog.Title fontSize="$6" fontWeight="600">
              Confirm Deletion
            </Dialog.Title>
            <Dialog.Description fontSize="$4" color="$gray11">
              Are you sure you want to delete &quot;{ecclesiaToDelete?.name}&quot;? This action cannot be undone.
            </Dialog.Description>
            <XStack gap="$3" justifyContent="flex-end" marginTop="$2">
              <Dialog.Close asChild>
                <Button variant="outlined" borderWidth={2} borderColor="$textTertiary" disabled={isDeleting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                backgroundColor={brandColors.light.error}
                color="white"
                borderWidth={2}
                borderColor={brandColors.light.error}
                hoverStyle={{ backgroundColor: brandColors.light.error, opacity: 0.9 }}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Ecclesia'}
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {/* Transfer Members & Delete Dialog */}
      <Dialog modal open={transferDialogOpen} onOpenChange={(open) => {
        if (!isTransferring) setTransferDialogOpen(open)
      }}>
        <Dialog.Portal>
          <Dialog.Overlay
            key="transfer-overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            key="transfer-content"
            bordered
            elevate
            animation="quick"
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
            padding="$4"
            width={500}
            maxHeight="80vh"
          >
            <Dialog.Title fontSize="$6" fontWeight="600">
              <XStack gap="$2" alignItems="center">
                <ArrowRightLeft size="$1" />
                <Text fontSize="$6" fontWeight="600">Transfer Members &amp; Delete</Text>
              </XStack>
            </Dialog.Title>
            <Dialog.Description fontSize="$4" color="$gray11">
              {ecclesiaToDelete?.memberCount} member{ecclesiaToDelete?.memberCount !== 1 ? 's' : ''} in
              &quot;{ecclesiaToDelete?.name}&quot; — select where to transfer them before deleting.
            </Dialog.Description>

            <XStack gap="$2" alignItems="center">
              <Search size="$1" color="$gray11" />
              <Input
                flex={1}
                placeholder="Search ecclesias..."
                value={ecclesiaSearch}
                onChangeText={setEcclesiaSearch}
                size="$4"
              />
            </XStack>

            <ScrollView maxHeight={250}>
              <YStack gap="$2">
                {transferTargetOptions.map((e) => {
                  const isSelected = targetEcclesia?.name === e.name
                  return (
                    <Card
                      key={e.id}
                      padding="$3"
                      borderWidth={2}
                      borderColor={isSelected ? '$blue10' : '$borderColor'}
                      backgroundColor={isSelected ? '$blue2' : undefined}
                      pressStyle={{ backgroundColor: '$blue2' }}
                      cursor="pointer"
                      onPress={() => setTargetEcclesia(e)}
                    >
                      <XStack justifyContent="space-between" alignItems="center">
                        <YStack gap="$1">
                          <Text fontSize="$4" fontWeight="600">{e.name}</Text>
                          {e.city ? (
                            <Text fontSize="$3" color="$gray11">{e.city}</Text>
                          ) : null}
                        </YStack>
                        {e.memberCount ? (
                          <XStack gap="$1" alignItems="center">
                            <Users size={14} color="$gray11" />
                            <Text fontSize="$3" color="$gray11">{e.memberCount}</Text>
                          </XStack>
                        ) : null}
                      </XStack>
                    </Card>
                  )
                })}
                {transferTargetOptions.length === 0 ? (
                  <Text color="$gray11" textAlign="center" padding="$4">
                    No matching ecclesias found
                  </Text>
                ) : null}
              </YStack>
            </ScrollView>

            {targetEcclesia ? (
              <Card padding="$3" backgroundColor="$green2" borderWidth={1} borderColor="$green8">
                <Text fontSize="$3" color="$green11">
                  Transfer {ecclesiaToDelete?.memberCount} member{ecclesiaToDelete?.memberCount !== 1 ? 's' : ''} to &quot;{targetEcclesia.name}&quot;
                </Text>
              </Card>
            ) : null}

            <XStack gap="$3" justifyContent="flex-end" marginTop="$2">
              <Button
                variant="outlined"
                borderWidth={2}
                borderColor="$textTertiary"
                disabled={isTransferring}
                onPress={() => setTransferDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                backgroundColor={brandColors.light.error}
                color="white"
                borderWidth={2}
                borderColor={brandColors.light.error}
                hoverStyle={{ backgroundColor: brandColors.light.error, opacity: 0.9 }}
                onPress={handleTransferAndDelete}
                disabled={!targetEcclesia || isTransferring}
                icon={isTransferring ? <Spinner size="small" /> : ArrowRightLeft}
              >
                {isTransferring ? 'Transferring...' : 'Transfer & Delete'}
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </YStack>
  )
}
