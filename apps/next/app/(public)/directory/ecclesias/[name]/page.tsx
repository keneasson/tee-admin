'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { YStack, XStack, Text, Spinner, Card, Input, ScrollView } from '@my/ui'
import { useHydrated } from '@my/app/hooks/use-hydrated'
import { useUserRole } from '@/hooks/use-user-role'
import { EcclesiaDetail } from '@my/ui/src/directory/ecclesia-detail'
import type { EcclesiaDetailData } from '@my/ui/src/ecclesia/ecclesia-detail-view'
import type { DirectoryMember, Nomination, DirectoryAuthProps, EcclesiaListItem } from '@my/ui/src/directory/types'
import { Button } from '@my/ui'
import { ArrowLeft, ArrowRightLeft, Search, Users } from '@tamagui/lucide-icons'
import { Dialog } from 'tamagui'
import { brandColors } from '@my/ui/src/branding/brand-colors'

export default function DirectoryEcclesiaDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isMemberOrHigher, isRecorderOrHigher, isAdminOrOwner, isLoading: authLoading, status } = useUserRole()
  const isHydrated = useHydrated()
  const initialEdit = searchParams?.get('edit') === 'true'

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

  // Delete/transfer state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [allEcclesias, setAllEcclesias] = useState<EcclesiaListItem[]>([])
  const [targetEcclesia, setTargetEcclesia] = useState<EcclesiaListItem | null>(null)
  const [ecclesiaSearch, setEcclesiaSearch] = useState('')
  const [isTransferring, setIsTransferring] = useState(false)

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
        setMembers(data.members || [])
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
        if (res.ok) {
          router.replace(`/directory/ecclesias/${encodeURIComponent(updates.name!)}`)
          return true
        } else {
          const data = await res.json()
          console.error('Update failed:', data.error)
          return false
        }
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

  // Fetch all ecclesias for transfer target picker
  const fetchAllEcclesias = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ecclesias')
      if (res.ok) {
        const data = await res.json()
        setAllEcclesias(data.ecclesias || [])
      }
    } catch { /* ignore */ }
  }, [])

  const handleDeleteClick = () => {
    if (members.length > 0) {
      // Has members — need to transfer first
      setTargetEcclesia(null)
      setEcclesiaSearch('')
      fetchAllEcclesias()
      setTransferDialogOpen(true)
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

  const handleTransferAndDelete = async () => {
    if (!targetEcclesia) return
    setIsTransferring(true)
    try {
      const response = await fetch('/api/admin/ecclesias/transfer-and-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEcclesia: ecclesiaName,
          targetEcclesia: targetEcclesia.name,
        }),
      })
      const data = await response.json()
      if (response.ok) {
        setTransferDialogOpen(false)
        router.push('/directory/ecclesias')
      } else {
        alert(data.error || 'Transfer failed')
      }
    } catch {
      alert('Failed to transfer members and delete ecclesia')
    } finally {
      setIsTransferring(false)
    }
  }

  const transferTargetOptions = allEcclesias.filter((e) => {
    if (e.name === ecclesiaName) return false
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
      <EcclesiaDetail
        ecclesia={ecclesia}
        canEdit={canEdit}
        onUpdate={handleUpdate}
        initialEdit={initialEdit}
        onBack={() => router.push('/directory/ecclesias')}
        members={members}
        membersLoading={membersLoading}
        onMemberClick={(id) => router.push(`/people/${id}`)}
        nominations={nominations}
        authProps={authProps}
        ecclesiaMembers={ecclesiaMembers}
        onNominate={handleNominate}
        onSecond={handleSecond}
        onDirectSet={isAdminOrOwner ? handleDirectSetRB : undefined}
        onDelete={isAdminOrOwner ? handleDeleteClick : undefined}
        isDeleting={isDeleting || isTransferring}
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

      {/* Transfer Members & Delete Dialog (has members) */}
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
              {members.length} member{members.length !== 1 ? 's' : ''} in
              &quot;{ecclesiaName}&quot; — select where to transfer them before deleting.
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
                  Transfer {members.length} member{members.length !== 1 ? 's' : ''} to &quot;{targetEcclesia.name}&quot;
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
    </>
  )
}
