'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AuthSession, AuthStatus } from '@my/app/types'
import {
  Button,
  Checkbox,
  Heading,
  Input,
  Paragraph,
  Spinner,
  Text,
  XStack,
  YStack,
  Card,
  Separator,
  ScrollView
} from '@my/ui'
import { Wrapper } from '@my/app/provider/wrapper'
import { Section } from '@my/app/features/newsletter/Section'
import { LogInUser } from '@my/app/provider/auth/log-in-user'
import { ROLES } from '@my/app/provider/auth/auth-roles'
import { Check, Save, Users, UserPlus, Trash2, GripVertical } from '@tamagui/lucide-icons'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from '@dnd-kit/core'
import { DragMergeDialog } from '@my/ui/src/email/drag-merge-dialog'
import type { PersonEntry as PersonEntryType } from '@my/ui/src/email/draggable-contact-card'

type DirectoryMember = {
  pkey: string
  skey: string
  firstName: string
  lastName: string
  email: string
  ecclesia: string
  isMember?: boolean
}

type SESContact = {
  email: string
  hasMatch: boolean
  isDirectoryMember: boolean
}

type EmailRow = {
  email: string
  inSES: boolean
  inSESMembers: boolean
  skey: string  // For updating
}

type PersonEntry = {
  type: 'directory' | 'ses-only'
  // For directory entries:
  baseSkey?: string  // Base SK without #EMAIL suffix
  firstName?: string
  lastName?: string
  ecclesia?: string
  emails: EmailRow[]
  // For SES-only entries:
  sesOnlyEmail?: string
}

type EmailSyncData = {
  directoryMembers: DirectoryMember[]
  sesOnlyEmails: SESContact[]
  sesAllEmails: string[]
  sesMembersEmails: string[]
  totalDirectory: number
  totalSES: number
  totalSESMembers: number
  matched: number
  unmatched: number
}

// Draggable and Droppable Card Component
function DraggableDroppableCard({
  id,
  children,
  bgColor,
  borderColor
}: {
  id: string
  children: React.ReactNode
  bgColor: string
  borderColor: string
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id })

  // Combine refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        cursor: 'grab',
        transition: 'border-color 0.2s, background-color 0.2s',
        position: 'relative'
      }}
      {...listeners}
      {...attributes}
    >
      <Card
        padding="$3"
        backgroundColor={isOver ? '$blue3' : bgColor}
        borderWidth={isOver ? 3 : 1}
        borderColor={isOver ? '$blue10' : borderColor}
        opacity={isDragging ? 0.5 : 1}
      >
        {children}
        {isOver ? (
          <XStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            backgroundColor="$blue5"
            opacity={0.3}
            borderRadius="$3"
            pointerEvents="none"
            justifyContent="center"
            alignItems="center"
          >
            <Text color="$blue11" fontWeight="bold" fontSize="$5">Drop to Merge</Text>
          </XStack>
        ) : null}
      </Card>
    </div>
  )
}

/**
 * Props for DirectoryEmailSync component
 * Session must be passed from platform-specific wrapper
 */
export interface DirectoryEmailSyncProps {
  session: AuthSession | null
  status?: AuthStatus
}

export const DirectoryEmailSync: React.FC<DirectoryEmailSyncProps> = ({ session, status = 'authenticated' }) => {
  const [loading, setLoading] = useState(false)
  const [syncData, setSyncData] = useState<EmailSyncData | null>(null)
  const [editingEmails, setEditingEmails] = useState<Record<string, string>>({})
  const [memberStatus, setMemberStatus] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [batchSaving, setBatchSaving] = useState(false)
  const [editingNames, setEditingNames] = useState<Record<string, { firstName: string; lastName: string }>>({})
  const [newEntryMemberStatus, setNewEntryMemberStatus] = useState<Record<string, boolean>>({})
  const [nameInputs, setNameInputs] = useState<Record<string, { firstName: string; lastName: string }>>({})
  const [addingSecondEmail, setAddingSecondEmail] = useState<string | null>(null)
  const [newSecondEmail, setNewSecondEmail] = useState('')
  const [syncingMembers, setSyncingMembers] = useState(false)
  const [syncingFromSES, setSyncingFromSES] = useState(false)
  // Drag and drop state
  const [draggedPerson, setDraggedPerson] = useState<PersonEntry | null>(null)
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false)
  const [mergeSource, setMergeSource] = useState<PersonEntry | null>(null)
  const [mergeTarget, setMergeTarget] = useState<PersonEntry | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const syncMembersToSES = async () => {
    if (!confirm('This will subscribe ALL TEE members from the Directory to the SES Members list. Continue?')) {
      return
    }

    setSyncingMembers(true)
    try {
      const response = await fetch('/api/admin/directory-email-sync/sync-members-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (response.ok) {
        alert(`Success! Synced ${result.added} TEE members to SES Members list.\n\nFailed: ${result.failed}\n\nRefreshing data...`)
        await loadSyncData()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error syncing members:', error)
      alert('Failed to sync members to SES')
    } finally {
      setSyncingMembers(false)
    }
  }

  const syncFromSESToDynamoDB = async () => {
    if (!confirm('This will sync changes from SES (like subscription updates) back to the DynamoDB Directory. Continue?')) {
      return
    }

    setSyncingFromSES(true)
    try {
      const response = await fetch('/api/admin/directory-email-sync/sync-from-ses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const result = await response.json()

      if (response.ok) {
        const { summary, orphanedContacts } = result
        let message = `Success! Synced ${summary.totalProcessed} contacts from SES.\n\n`
        message += `Updated: ${summary.updated}\n`
        message += `Skipped: ${summary.skipped}\n`
        message += `Failed: ${summary.failed}\n`
        if (summary.orphaned > 0) {
          message += `\nOrphaned (SES-only contacts): ${summary.orphaned}\n`
          if (orphanedContacts && orphanedContacts.length > 0) {
            message += '\nOrphaned emails:\n'
            orphanedContacts.slice(0, 10).forEach((contact: any) => {
              message += `- ${contact.email} ${contact.firstName ? `(${contact.firstName} ${contact.lastName})` : ''}\n`
            })
            if (orphanedContacts.length > 10) {
              message += `... and ${orphanedContacts.length - 10} more\n`
            }
          }
        }
        message += '\nRefreshing data...'
        alert(message)
        await loadSyncData()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error syncing from SES:', error)
      alert('Failed to sync from SES to Directory')
    } finally {
      setSyncingFromSES(false)
    }
  }

  const loadSyncData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/directory-email-sync', {
        cache: 'no-store',
        method: 'GET'
      })
      const data = await response.json()
      setSyncData(data)

      // Initialize editing state with current emails and member status
      const initialEdits: Record<string, string> = {}
      const initialMemberStatus: Record<string, boolean> = {}

      data.directoryMembers.forEach((member: DirectoryMember) => {
        initialEdits[member.skey] = member.email || ''
        initialMemberStatus[member.skey] = member.ecclesia?.toLowerCase() === 'tee'
      })

      setEditingEmails(initialEdits)
      setMemberStatus(initialMemberStatus)
    } catch (error) {
      console.error('Error loading sync data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateEmail = async (member: DirectoryMember, newEmail: string) => {
    setSaving(member.skey)
    try {
      const response = await fetch('/api/admin/directory-email-sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pkey: member.pkey,
          skey: member.skey,
          email: newEmail
        })
      })

      if (response.ok) {
        // Reload data to reflect changes
        await loadSyncData()
      } else {
        console.error('Failed to update email')
      }
    } catch (error) {
      console.error('Error updating email:', error)
    } finally {
      setSaving(null)
    }
  }

  const batchUpdateMemberStatus = async () => {
    setBatchSaving(true)
    try {
      // Get all members whose status has changed
      const updates = syncData?.directoryMembers
        .filter((member) => {
          const currentIsMember = member.ecclesia?.toLowerCase() === 'tee'
          const newIsMember = memberStatus[member.skey]
          return currentIsMember !== newIsMember
        })
        .map((member) => ({
          pkey: member.pkey,
          skey: member.skey,
          email: member.email,
          isMember: memberStatus[member.skey]
        })) || []

      if (updates.length === 0) {
        console.log('No member status changes to save')
        return
      }

      const response = await fetch('/api/admin/directory-email-sync/batch-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      })

      if (response.ok) {
        console.log(`✅ Updated ${updates.length} member statuses`)
        await loadSyncData()
      } else {
        console.error('Failed to batch update member status')
      }
    } catch (error) {
      console.error('Error batch updating member status:', error)
    } finally {
      setBatchSaving(false)
    }
  }

  // Memoize expensive computations
  const pendingChangesCount = useMemo(() => {
    if (!syncData) return 0
    return syncData.directoryMembers.filter((member) => {
      const currentIsMember = member.ecclesia?.toLowerCase() === 'tee'
      const newIsMember = memberStatus[member.skey]
      return currentIsMember !== newIsMember
    }).length
  }, [syncData, memberStatus])

  // Memoize combined and sorted list - grouped by person
  const combinedSortedList = useMemo((): PersonEntry[] => {
    if (!syncData) return []

    const personEntries: PersonEntry[] = []
    const sesAllEmailsSet = new Set(syncData.sesAllEmails.map(e => e.toLowerCase()))
    const sesMembersSet = new Set(syncData.sesMembersEmails.map(e => e.toLowerCase()))
    const sesOnlyEmailsSet = new Set(syncData.sesOnlyEmails.map(s => s.email.toLowerCase()))

    // Group directory members by base SK (without #EMAIL suffix)
    const personMap = new Map<string, PersonEntry>()

    syncData.directoryMembers.forEach((member) => {
      const baseSkey = member.skey.split('#EMAIL')[0]  // Remove #EMAIL1, #EMAIL2, etc.
      const email = member.email?.toLowerCase() || ''
      const inSES = sesAllEmailsSet.has(email)
      const inSESMembers = sesMembersSet.has(email)

      if (!personMap.has(baseSkey)) {
        // Create new person entry
        personMap.set(baseSkey, {
          type: 'directory',
          baseSkey,
          firstName: member.firstName,
          lastName: member.lastName,
          ecclesia: member.ecclesia,
          emails: []
        })
      }

      // Add email to this person's emails
      const person = personMap.get(baseSkey)!
      person.emails.push({
        email: member.email || '',
        inSES,
        inSESMembers,
        skey: member.skey
      })
    })

    // Add all grouped directory persons
    personEntries.push(...Array.from(personMap.values()))

    // Add remaining SES-only contacts (not in directory)
    sesOnlyEmailsSet.forEach((sesEmail) => {
      const inSESMembers = sesMembersSet.has(sesEmail)
      personEntries.push({
        type: 'ses-only',
        sesOnlyEmail: sesEmail,
        emails: [{
          email: sesEmail,
          inSES: true,
          inSESMembers,
          skey: ''
        }]
      })
    })

    // Sort by first name, then by first email
    return personEntries.sort((a, b) => {
      const aName = a.firstName || a.sesOnlyEmail || ''
      const bName = b.firstName || b.sesOnlyEmail || ''
      return aName.localeCompare(bName)
    })
  }, [syncData])

  // Memoize checkbox handler
  const handleMemberStatusChange = useCallback((skey: string, checked: boolean) => {
    setMemberStatus((prev) => ({ ...prev, [skey]: checked }))
  }, [])

  const addSecondEmail = async (baseSkey: string) => {
    if (!newSecondEmail.trim()) return

    setSaving(`${baseSkey}-add-email`)
    try {
      // Get the first email row to find the member details
      const person = combinedSortedList.find(p => p.baseSkey === baseSkey)
      if (!person || !person.emails[0]) return

      const response = await fetch('/api/admin/directory-email-sync/add-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pkey: 'DIRECTORY#MEMBERS',
          skey: baseSkey,  // Use base skey
          currentEmail: person.emails[0].email,
          newEmail: newSecondEmail.trim()
        })
      })

      if (response.ok) {
        setNewSecondEmail('')
        setAddingSecondEmail(null)
        await loadSyncData()
      } else {
        console.error('Failed to add second email')
      }
    } catch (error) {
      console.error('Error adding second email:', error)
    } finally {
      setSaving(null)
    }
  }

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const person = combinedSortedList.find(p => {
      const id = p.baseSkey || `ses-${p.sesOnlyEmail}`
      return id === active.id
    })
    setDraggedPerson(person || null)
  }, [combinedSortedList])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setDraggedPerson(null)

    if (!over || active.id === over.id) return

    // Find source and target persons
    const source = combinedSortedList.find(p => {
      const id = p.baseSkey || `ses-${p.sesOnlyEmail}`
      return id === active.id
    })
    const target = combinedSortedList.find(p => {
      const id = p.baseSkey || `ses-${p.sesOnlyEmail}`
      return id === over.id
    })

    if (source && target) {
      // Cannot merge into SES-only contact
      if (target.type === 'ses-only') {
        alert('Cannot merge into an SES-only contact. The target must be a directory entry.')
        return
      }
      setMergeSource(source)
      setMergeTarget(target)
      setMergeDialogOpen(true)
    }
  }, [combinedSortedList])

  const handleMergeConfirm = async () => {
    if (!mergeSource || !mergeTarget) return

    setIsMerging(true)
    try {
      const response = await fetch('/api/admin/email/consolidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'merge-persons',
          source: mergeSource,
          target: mergeTarget
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`Success! Merged ${result.addedEmails?.length || 0} emails into ${result.targetName}`)
        setMergeDialogOpen(false)
        setMergeSource(null)
        setMergeTarget(null)
        await loadSyncData()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error merging contacts:', error)
      alert('Failed to merge contacts')
    } finally {
      setIsMerging(false)
    }
  }

  const handleDeleteContact = async (person: PersonEntry) => {
    const name = person.firstName
      ? `${person.firstName} ${person.lastName}`
      : person.sesOnlyEmail || 'Unknown'

    if (!confirm(`Are you sure you want to delete "${name}"?\n\nThis will remove all their directory records.`)) {
      return
    }

    const personId = person.baseSkey || `ses-${person.sesOnlyEmail}`
    setIsDeleting(personId)

    try {
      const response = await fetch('/api/admin/directory-email-sync/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pkey: 'DIRECTORY#MEMBERS',
          skey: person.baseSkey || person.sesOnlyEmail,
          emails: person.emails.map(e => e.email),
          unsubscribeFromSES: false // Don't auto-unsubscribe, let admin decide
        })
      })

      const result = await response.json()

      if (response.ok) {
        alert(`Deleted ${result.deletedRecords} record(s)`)
        await loadSyncData()
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    } finally {
      setIsDeleting(null)
    }
  }

  const createDirectoryEntry = async (email: string) => {
    const names = editingNames[email]
    if (!names?.firstName || !names?.lastName) {
      console.error('First and last name required')
      return
    }

    setSaving(`create-${email}`)
    try {
      const isMember = newEntryMemberStatus[email] || false

      const response = await fetch('/api/admin/directory-email-sync/create-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName: names.firstName,
          lastName: names.lastName,
          isMember
        })
      })

      if (response.ok) {
        setEditingNames((prev) => {
          const newState = { ...prev }
          delete newState[email]
          return newState
        })
        setNewEntryMemberStatus((prev) => {
          const newState = { ...prev }
          delete newState[email]
          return newState
        })
        await loadSyncData()
      } else {
        console.error('Failed to create directory entry')
      }
    } catch (error) {
      console.error('Error creating directory entry:', error)
    } finally {
      setSaving(null)
    }
  }

  useEffect(() => {
    loadSyncData()
  }, [])

  // Auth checks - must be after all hooks
  if (!(session && session.user)) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Directory Email Sync</Heading>
          <Paragraph>To access this section of our site, please sign in.</Paragraph>
          <LogInUser />
        </Section>
      </Wrapper>
    )
  }

  // Check if user has admin or owner role
  const userRole = session.user.role
  if (userRole !== ROLES.ADMIN && userRole !== ROLES.OWNER) {
    return (
      <Wrapper>
        <Section space={'$4'}>
          <Heading size={5}>Access Denied</Heading>
          <Paragraph>You need admin or owner permissions to manage Directory Email Sync.</Paragraph>
          <Paragraph>Current role: {userRole || 'None'}</Paragraph>
        </Section>
      </Wrapper>
    )
  }

  if (loading && !syncData) {
    return (
      <Wrapper subHeader="Directory Email Sync">
        <Section gap={'$4'}>
          <YStack alignItems="center" gap="$4" paddingVertical="$8">
            <Spinner size="large" />
            <Text>Loading directory and SES data...</Text>
          </YStack>
        </Section>
      </Wrapper>
    )
  }

  return (
    <Wrapper subHeader="Directory Email Sync">
      <Section gap={'$4'}>
        <YStack gap="$4">
          {/* Header */}
          <Card elevate bordered padding="$4" backgroundColor="$background">
            <YStack gap="$3">
              <Heading size={4}>Directory Email Sync Tool</Heading>
              <Paragraph color="$gray11">
                This tool helps you identify and fix email mismatches between the Directory (DynamoDB) and SES contacts.
                Update directory emails to match the actual email addresses people use to subscribe.
              </Paragraph>

              <XStack gap="$4" flexWrap="wrap">
                <Button
                  size="$4"
                  icon={loading ? Spinner : Check}
                  onPress={loadSyncData}
                  disabled={loading}
                  theme="active"
                >
                  {loading ? 'Refreshing...' : 'Refresh Data'}
                </Button>

                {pendingChangesCount > 0 ? <Button
                    size="$4"
                    icon={batchSaving ? Spinner : Users}
                    onPress={batchUpdateMemberStatus}
                    disabled={batchSaving}
                    theme="green"
                  >
                    {batchSaving ? 'Saving...' : `Save ${pendingChangesCount} Member Status Change${pendingChangesCount > 1 ? 's' : ''}`}
                  </Button> : null}

                <Button
                  size="$4"
                  icon={syncingMembers ? Spinner : Users}
                  onPress={syncMembersToSES}
                  disabled={syncingMembers || loading || syncingFromSES}
                  theme="blue"
                >
                  {syncingMembers ? 'Syncing...' : 'Sync All TEE Members to SES'}
                </Button>

                <Button
                  size="$4"
                  icon={syncingFromSES ? Spinner : Users}
                  onPress={syncFromSESToDynamoDB}
                  disabled={syncingFromSES || loading || syncingMembers}
                  theme="green"
                >
                  {syncingFromSES ? 'Syncing...' : 'Sync from SES to Directory'}
                </Button>
              </XStack>

              {syncData ? <>
                  <Separator marginVertical="$2" />
                  <XStack gap="$6" flexWrap="wrap">
                    <YStack>
                      <Text fontSize="$2" color="$gray11">Total Directory Members</Text>
                      <Text fontSize="$6" fontWeight="bold">{syncData.totalDirectory}</Text>
                    </YStack>
                    <YStack>
                      <Text fontSize="$2" color="$gray11">Total SES Contacts</Text>
                      <Text fontSize="$6" fontWeight="bold">{syncData.totalSES}</Text>
                    </YStack>
                    <YStack>
                      <Text fontSize="$2" color="$green11">Matched</Text>
                      <Text fontSize="$6" fontWeight="bold" color="$green10">{syncData.matched}</Text>
                    </YStack>
                    <YStack>
                      <Text fontSize="$2" color="$orange11">Unmatched</Text>
                      <Text fontSize="$6" fontWeight="bold" color="$orange10">{syncData.unmatched}</Text>
                    </YStack>
                  </XStack>
                </> : null}
            </YStack>
          </Card>

          {/* Combined Directory + SES List (Alphabetically Sorted) */}
          {syncData ? <Card elevate bordered padding="$4" backgroundColor="$background">
              <YStack gap="$3">
                <XStack justifyContent="space-between" alignItems="center">
                  <Heading size={5}>All Contacts (Alphabetically Sorted by Email)</Heading>
                  <Text fontSize="$2" color="$gray11">{combinedSortedList.length} total</Text>
                </XStack>
                <Paragraph fontSize="$3" color="$gray11">
                  Green = In both Directory & SES | Yellow = Directory only (not in SES) | Blue = SES only (not in Directory)
                </Paragraph>
                <Paragraph fontSize="$2" color="$blue10" fontStyle="italic">
                  Drag one contact onto another to merge them. Use the trash icon to delete.
                </Paragraph>

                <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <ScrollView maxHeight={800}>
                  <YStack gap="$2">
                    {combinedSortedList.map((person, index) => {
                      const isDirectory = person.type === 'directory'
                      const baseSkey = person.baseSkey || ''
                      const isMemberChecked = isDirectory && memberStatus[baseSkey]
                      const anyInSES = person.emails.some(e => e.inSES)
                      const personId = isDirectory ? baseSkey : `ses-${person.sesOnlyEmail}`
                      const isDeletingThis = isDeleting === personId

                      // Color coding
                      let bgColor = '$background'
                      let borderColor = '$gray5'
                      if (isDirectory && anyInSES) {
                        bgColor = '$green2'
                        borderColor = '$green7'
                      } else if (isDirectory) {
                        bgColor = '$yellow2'
                        borderColor = '$yellow7'
                      } else {
                        bgColor = '$blue2'
                        borderColor = '$blue7'
                      }

                      return (
                        <DraggableDroppableCard
                          key={personId}
                          id={personId}
                          bgColor={bgColor}
                          borderColor={borderColor}
                        >
                          <XStack alignItems="flex-start" gap="$3">
                            {/* Drag Handle */}
                            <YStack justifyContent="center" minHeight={40} cursor="grab">
                              <GripVertical size={16} color="$gray8" />
                            </YStack>
                            {/* Column 1: Member Checkbox */}
                            <XStack minWidth={100} alignItems="center" gap="$2">
                              {isDirectory ? (
                                <>
                                  <Checkbox
                                    checked={isMemberChecked}
                                    onCheckedChange={(checked) =>
                                      handleMemberStatusChange(baseSkey, !!checked)
                                    }
                                    size="$3"
                                  >
                                    <Checkbox.Indicator>
                                      <Check />
                                    </Checkbox.Indicator>
                                  </Checkbox>
                                  <Text fontSize="$2" color="$gray11">Member</Text>
                                </>
                              ) : (
                                editingNames[person.sesOnlyEmail!]?.firstName && editingNames[person.sesOnlyEmail!]?.lastName && (
                                  <>
                                    <Checkbox
                                      checked={newEntryMemberStatus[person.sesOnlyEmail!] || false}
                                      onCheckedChange={(checked) =>
                                        setNewEntryMemberStatus((prev) => ({ ...prev, [person.sesOnlyEmail!]: !!checked }))
                                      }
                                      size="$3"
                                    >
                                      <Checkbox.Indicator>
                                        <Check />
                                      </Checkbox.Indicator>
                                    </Checkbox>
                                    <Text fontSize="$2" color="$gray11">Member</Text>
                                  </>
                                )
                              )}
                            </XStack>

                            {/* Column 2: Name */}
                            <YStack flex={1} minWidth={180} justifyContent="center">
                              {isDirectory ? (
                                <>
                                  <Text fontWeight="600" fontSize="$4">
                                    {person.firstName} {person.lastName}
                                  </Text>
                                  <Text fontSize="$2" color="$gray11">
                                    {person.ecclesia || 'No ecclesia'}
                                  </Text>
                                </>
                              ) : (
                                <>
                                  <XStack gap="$2" alignItems="center" marginBottom="$1">
                                    <Input
                                      placeholder="First Name"
                                      size="$2"
                                      defaultValue={editingNames[person.sesOnlyEmail!]?.firstName || ''}
                                      onBlur={(e) => {
                                        const text = (e.target as unknown as HTMLInputElement).value
                                        setEditingNames((prev) => ({
                                          ...prev,
                                          [person.sesOnlyEmail!]: {
                                            firstName: text,
                                            lastName: prev[person.sesOnlyEmail!]?.lastName || ''
                                          }
                                        }))
                                      }}
                                    />
                                    <Input
                                      placeholder="Last Name"
                                      size="$2"
                                      defaultValue={editingNames[person.sesOnlyEmail!]?.lastName || ''}
                                      onBlur={(e) => {
                                        const text = (e.target as unknown as HTMLInputElement).value
                                        setEditingNames((prev) => ({
                                          ...prev,
                                          [person.sesOnlyEmail!]: {
                                            firstName: prev[person.sesOnlyEmail!]?.firstName || '',
                                            lastName: text
                                          }
                                        }))
                                      }}
                                    />
                                  </XStack>
                                  <Text fontSize="$2" color="$gray11" fontStyle="italic">
                                    {editingNames[person.sesOnlyEmail!]?.firstName && editingNames[person.sesOnlyEmail!]?.lastName
                                      ? 'Ready to add to directory'
                                      : 'SES Only - Add to directory'}
                                  </Text>
                                </>
                              )}
                            </YStack>

                            {/* Column 3: Emails (can have multiple rows) */}
                            <YStack flex={2} minWidth={300} gap="$2">
                              {person.emails.map((emailRow, emailIndex) => {
                                const isEditing = isDirectory && editingEmails[emailRow.skey] !== emailRow.email
                                const isSaving = isDirectory && saving === emailRow.skey

                                return (
                                  <XStack key={emailRow.skey || emailIndex} gap="$2" alignItems="center">
                                    {isDirectory ? (
                                      <>
                                        <Input
                                          flex={1}
                                          value={editingEmails[emailRow.skey] || ''}
                                          onChangeText={(text) =>
                                            setEditingEmails((prev) => ({ ...prev, [emailRow.skey]: text }))
                                          }
                                          placeholder="Email"
                                          size="$3"
                                          disabled={isSaving}
                                        />
                                        {isEditing ? <Button
                                            size="$3"
                                            icon={isSaving ? Spinner : Save}
                                            onPress={() => updateEmail({
                                              pkey: 'DIRECTORY#MEMBERS',
                                              skey: emailRow.skey,
                                              email: emailRow.email,
                                              firstName: person.firstName!,
                                              lastName: person.lastName!,
                                              ecclesia: person.ecclesia!
                                            }, editingEmails[emailRow.skey])}
                                            disabled={isSaving}
                                            theme="active"
                                          >
                                            {isSaving ? 'Saving...' : 'Save'}
                                          </Button> : null}
                                      </>
                                    ) : (
                                      <>
                                        <Text flex={1} fontSize="$3">
                                          {emailRow.email}
                                        </Text>
                                        {editingNames[person.sesOnlyEmail!]?.firstName && editingNames[person.sesOnlyEmail!]?.lastName && emailIndex === 0 ? <Button
                                            size="$3"
                                            icon={saving === `create-${person.sesOnlyEmail}` ? Spinner : UserPlus}
                                            onPress={() => createDirectoryEntry(person.sesOnlyEmail!)}
                                            disabled={saving === `create-${person.sesOnlyEmail}`}
                                            theme="blue"
                                          >
                                            Create Entry
                                          </Button> : null}
                                      </>
                                    )}
                                  </XStack>
                                )
                              })}

                              {/* Add Second Email Button (Directory Only) */}
                              {isDirectory && person.emails.length === 1 ? <>
                                  {addingSecondEmail === baseSkey ? (
                                    <XStack gap="$2" alignItems="center">
                                      <Input
                                        flex={1}
                                        placeholder="second@email.com"
                                        size="$3"
                                        value={newSecondEmail}
                                        onChangeText={setNewSecondEmail}
                                      />
                                      <Button
                                        size="$3"
                                        icon={saving === `${baseSkey}-add-email` ? Spinner : Save}
                                        onPress={() => addSecondEmail(baseSkey)}
                                        disabled={saving === `${baseSkey}-add-email`}
                                        theme="green"
                                      >
                                        Add
                                      </Button>
                                      <Button
                                        size="$3"
                                        onPress={() => {
                                          setAddingSecondEmail(null)
                                          setNewSecondEmail('')
                                        }}
                                        variant="outlined"
                                      >
                                        Cancel
                                      </Button>
                                    </XStack>
                                  ) : (
                                    <Button
                                      size="$2"
                                      variant="outlined"
                                      onPress={() => setAddingSecondEmail(baseSkey)}
                                    >
                                      + Add Second Email
                                    </Button>
                                  )}
                                </> : null}
                            </YStack>

                            {/* Column 4: Status (per email) */}
                            <YStack minWidth={160} gap="$3">
                              {person.emails.map((emailRow, emailIndex) => (
                                <YStack key={emailRow.skey || emailIndex} gap="$1" alignItems="flex-end" minHeight={40}>
                                  {isDirectory ? <Text fontSize="$1" color="$green10">✓ In Directory</Text> : null}
                                  {!isDirectory ? <Text fontSize="$1" color="$red10">✗ Not in Directory</Text> : null}
                                  {emailRow.inSES ? (
                                    <Text fontSize="$1" color="$green10">✓ In SES</Text>
                                  ) : (
                                    <Text fontSize="$1" color="$gray10">✗ Not in SES</Text>
                                  )}
                                  {emailRow.inSESMembers ? (
                                    <Text fontSize="$1" color="$green10" fontWeight="600">✓ Members List</Text>
                                  ) : (
                                    <Text fontSize="$1" color="$gray10">✗ Not Members</Text>
                                  )}
                                </YStack>
                              ))}
                            </YStack>

                            {/* Column 5: Delete Button */}
                            {isDirectory ? (
                              <YStack justifyContent="center" minHeight={40}>
                                <Button
                                  size="$2"
                                  icon={isDeletingThis ? Spinner : Trash2}
                                  backgroundColor="$red9"
                                  color="white"
                                  hoverStyle={{ backgroundColor: '$red10' }}
                                  onPress={() => handleDeleteContact(person)}
                                  disabled={isDeletingThis}
                                >
                                  {isDeletingThis ? '' : 'Delete'}
                                </Button>
                              </YStack>
                            ) : null}
                          </XStack>
                        </DraggableDroppableCard>
                      )
                    })}
                  </YStack>
                </ScrollView>
                </DndContext>
              </YStack>
            </Card> : null}

          {/* Merge Dialog */}
          <DragMergeDialog
            open={mergeDialogOpen}
            onOpenChange={setMergeDialogOpen}
            source={mergeSource as PersonEntryType | null}
            target={mergeTarget as PersonEntryType | null}
            onConfirm={handleMergeConfirm}
            isLoading={isMerging}
          />
        </YStack>
      </Section>
    </Wrapper>
  )
}
