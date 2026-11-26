'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { YStack, XStack, Text, Spinner, Card } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useUserRole } from '@/hooks/use-user-role'
import { EcclesiaDetail } from '@my/ui/src/directory/ecclesia-detail'
import type { EcclesiaDetailData } from '@my/ui/src/ecclesia/ecclesia-detail-view'
import type { DirectoryMember, Nomination, DirectoryAuthProps, EcclesiaListItem } from '@my/ui/src/directory/types'
import { Button, Heading } from '@my/ui'
import { ArrowLeft } from '@tamagui/lucide-icons'
import { Dialog } from 'tamagui'
import { brandColors } from '@my/ui/src/branding/brand-colors'
import { MergeEcclesiaDialog } from '@/features/ecclesia-merge/merge-ecclesia-dialog'

export default function DirectoryEcclesiaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isMemberOrHigher, isRecorderOrHigher, isAdminOrOwner, isLoading: authLoading, status } = useUserRole()
  const isHydrated = useHydrated()
  const initialEdit = searchParams?.get('edit') === 'true'
  const [showMultiTenant, setShowMultiTenant] = useState(false)

  const [ecclesia, setEcclesia] = useState<EcclesiaDetailData | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Members
  const [members, setMembers] = useState<DirectoryMember[]>([])
  const [membersLoading, setMembersLoading] = useState(true)

  // RB nominations
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [viewerEcclesia, setViewerEcclesia] = useState<string | null>(null)
  const [memberEmails, setMemberEmails] = useState<Record<string, Array<{ email: string; emailType: string }>>>({})

  // Nearby ecclesias (enriched from API)
  const [nearbyEcclesias, setNearbyEcclesias] = useState<Array<{ name: string; displayName?: string; distanceKm?: number; country?: string; province?: string }>>([])
  const [nearbyLoading, setNearbyLoading] = useState(false)

  // Delete / merge state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [allEcclesias, setAllEcclesias] = useState<EcclesiaListItem[]>([])

  const ecclesiaName = decodeURIComponent((params?.name as string) || '')

  // Fetch ecclesia detail
  const fetchEcclesia = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}`)
      if (res.ok) {
        const data = await res.json()
        setEcclesia(data.ecclesia)
        setCanEdit(data.canEdit || false)
        setShowMultiTenant(data.showMultiTenant || false)
      } else if (res.status === 404) {
        setError('Ecclesia not found')
      } else {
        setError('Failed to load ecclesia')
      }
    } catch (err) {
      console.error('Error fetching ecclesia:', err)
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }, [ecclesiaName])

  // Fetch members of this ecclesia
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await fetch(`/api/people?ecclesia=${encodeURIComponent(ecclesiaName)}&includeEmails=true`)
      if (res.ok) {
        const data = await res.json()
        // A record with no name comes back named by its address: it's an
        // ecclesia mailbox or a leftover from the 2024 import, not a member.
        setMembers((data.members || []).filter((m: DirectoryMember) => m.name && m.name !== m.email))
        // Build email map for nomination panel
        const emailMap: Record<string, Array<{ email: string; emailType: string }>> = {}
        for (const m of data.members || []) {
          if (m.emails) {
            emailMap[m.email] = m.emails
          }
        }
        setMemberEmails(emailMap)
      }
    } catch (error) {
      console.error('Error fetching members:', error)
    } finally {
      setMembersLoading(false)
    }
  }, [ecclesiaName])

  // Fetch RB nominations
  const fetchNominations = useCallback(async () => {
    try {
      const res = await fetch(`/api/people/rb-nomination?ecclesia=${encodeURIComponent(ecclesiaName)}`)
      if (res.ok) {
        const data = await res.json()
        setNominations(data.nominations || [])
      }
    } catch (error) {
      console.error('Error fetching nominations:', error)
    }
  }, [ecclesiaName])

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

  useEffect(() => {
    if (isMemberOrHigher && ecclesiaName) {
      fetchEcclesia()
      fetchMembers()
      fetchNominations()
    }
  }, [isMemberOrHigher, ecclesiaName, fetchEcclesia, fetchMembers, fetchNominations])

  // Fetch nearby ecclesias (multi-tenant only)
  useEffect(() => {
    if (!showMultiTenant || !ecclesiaName) return
    let cancelled = false
    setNearbyLoading(true)
    fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}/nearby`)
      .then((r) => (r.ok ? r.json() : { nearbyEcclesias: [] }))
      .then((d) => { if (!cancelled) setNearbyEcclesias(d.nearbyEcclesias || []) })
      .catch(() => { if (!cancelled) setNearbyEcclesias([]) })
      .finally(() => { if (!cancelled) setNearbyLoading(false) })
    return () => { cancelled = true }
  }, [showMultiTenant, ecclesiaName])

  const handleUpdate = async (updates: Partial<EcclesiaDetailData>): Promise<boolean> => {
    try {
      const nameChanged = updates.name && updates.name !== ecclesiaName

      if (nameChanged) {
        const res = await fetch('/api/ecclesia', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalName: ecclesiaName,
            name: updates.name,
            country: ecclesia?.country,
            province: ecclesia?.province,
            city: ecclesia?.city,
            address: updates.address ?? ecclesia?.address,
            postalCode: updates.postalCode ?? ecclesia?.postalCode,
            venue: updates.venue ?? ecclesia?.venue,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          console.error('Update failed:', data.error)
          if (res.status === 409 && data.error) alert(data.error)
          return false
        }
        // The rename moved the record; save the rest of the edit at its new name.
        const { name: _name, address: _a, postalCode: _p, venue: _v, ...rest } = updates
        if (Object.keys(rest).length > 0) {
          const patch = await fetch(`/api/ecclesia/${encodeURIComponent(updates.name!)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rest),
          })
          if (!patch.ok) console.error('Update after rename failed:', (await patch.json().catch(() => ({}))).error)
        }
        router.replace(`/directory/ecclesias/${encodeURIComponent(updates.name!)}`)
        return true
      }

      const res = await fetch(`/api/ecclesia/${encodeURIComponent(ecclesiaName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        await fetchEcclesia()
        return true
      } else {
        const data = await res.json()
        console.error('Update failed:', data.error)
        return false
      }
    } catch (err) {
      console.error('Error updating ecclesia:', err)
      return false
    }
  }

  const handleNominate = async (nomineeEmail: string, nomineeName: string) => {
    const res = await fetch('/api/people/rb-nomination', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ecclesia: ecclesiaName, nomineeEmail, nomineeName }),
    })
    if (res.ok) {
      fetchNominations()
    }
  }

  const handleSecond = async (nominationId: string) => {
    const res = await fetch(`/api/people/rb-nomination/${nominationId}/second`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ecclesia: ecclesiaName }),
    })
    if (res.ok) {
      fetchNominations()
    }
  }

  const handleDirectSetRB = async (nomineeEmail: string, nomineeName: string) => {
    const res = await fetch('/api/people/rb-nomination', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ecclesia: ecclesiaName, nomineeEmail, nomineeName, directSet: true }),
    })
    if (res.ok) {
      fetchNominations()
      fetchEcclesia()
    }
  }

  const handleResend = async (nominationId: string) => {
    const res = await fetch(`/api/people/rb-nomination/${nominationId}/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ecclesia: ecclesiaName }),
    })
    if (res.ok) {
      fetchNominations()
    }
  }

  // Fetch all ecclesias for the merge target picker
  const fetchAllEcclesias = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ecclesias')
      if (res.ok) {
        const data = await res.json()
        setAllEcclesias(data.ecclesias || [])
      }
    } catch { /* ignore */ }
  }, [])

  const openMerge = () => {
    fetchAllEcclesias()
    setMergeDialogOpen(true)
  }

  const handleDeleteClick = () => {
    if (members.length > 0) {
      // People are attached: merge it into the ecclesia they attend instead.
      openMerge()
    } else {
      setDeleteConfirmOpen(true)
    }
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/ecclesia?name=${encodeURIComponent(ecclesiaName)}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setDeleteConfirmOpen(false)
        router.push('/directory/ecclesias')
      } else {
        const data = await response.json()
        alert(`Failed to delete: ${data.error}`)
      }
    } catch {
      alert('Failed to delete ecclesia')
    } finally {
      setIsDeleting(false)
    }
  }

  const authProps: DirectoryAuthProps = {
    isMemberOrHigher,
    isRecorderOrHigher,
    isAdminOrOwner,
    currentUserEmail,
    viewerEcclesia,
  }

  // Members with email info for nomination panel
  const ecclesiaMembers = members.map(m => ({
    email: m.email,
    name: m.name,
    emails: memberEmails[m.email],
  }))

  if (!isHydrated || authLoading || loading) {
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
        <Text>Please sign in to view ecclesia details.</Text>
      </YStack>
    )
  }

  if (error) {
    return (
      <YStack flex={1} padding="$4" gap="$4">
        <Button
          alignSelf="flex-start"
          icon={ArrowLeft}
          onPress={() => router.push('/directory/ecclesias')}
        >
          Back to Directory
        </Button>
        <Card padding="$4" backgroundColor="$red2">
          <Text fontSize="$4" color="$red10">{error}</Text>
        </Card>
      </YStack>
    )
  }

  if (!ecclesia) {
    return null
  }

  return (
    <>
      <YStack padding="$4" paddingBottom={0} gap="$1">
        <Heading size="$7" fontWeight="700">Christadelphian Directory</Heading>
        <Text fontSize="$2" color="$gray11" fontStyle="italic">
          Malachi 3:16 Then those who feared the Lord spoke with one another. The Lord paid attention and heard them, and a book of remembrance was written before him of those who feared the Lord and esteemed his name.
        </Text>
      </YStack>
      <EcclesiaDetail
        ecclesia={ecclesia}
        canEdit={canEdit}
        onUpdate={handleUpdate}
        initialEdit={initialEdit}
        onBack={() => router.push('/directory/ecclesias')}
        members={members}
        membersLoading={membersLoading}
        onMemberClick={(id) => router.push(`/people/${id}`)}
        onAddMember={(name) =>
          router.push(
            `/directory/people/add?${new URLSearchParams({ ecclesia: ecclesiaName, ...(name ? { name } : {}) })}`
          )
        }
        nominations={nominations}
        authProps={authProps}
        ecclesiaMembers={ecclesiaMembers}
        onNominate={handleNominate}
        onSecond={handleSecond}
        onDirectSet={isAdminOrOwner ? handleDirectSetRB : undefined}
        onResend={isAdminOrOwner ? handleResend : undefined}
        onDelete={isAdminOrOwner ? handleDeleteClick : undefined}
        onMerge={isAdminOrOwner ? openMerge : undefined}
        canSetClosed={isAdminOrOwner}
        isDeleting={isDeleting}
        showExternalLinks={showMultiTenant}
        nearbyEcclesiasData={nearbyEcclesias}
        nearbyLoading={nearbyLoading}
        onEcclesiaClick={(name) => router.push(`/directory/ecclesias/${encodeURIComponent(name)}`)}
      />

      {/* Delete Confirmation Dialog (0 members) */}
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
              Are you sure you want to delete &quot;{ecclesiaName}&quot;? This action cannot be undone.
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

      {/* Merge into another ecclesia */}
      <MergeEcclesiaDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
        sourceName={ecclesia.name}
        ecclesias={allEcclesias}
        onMerged={(targetName) => router.push(`/directory/ecclesias/${encodeURIComponent(targetName)}`)}
      />
    </>
  )
}
