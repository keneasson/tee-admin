import { useState } from 'react'
import { YStack, XStack, Text, Input, Card, Spinner } from 'tamagui'
import { Button } from '../Button'
import { UserPlus, ThumbsUp, Shield, User, Pencil, Clock, RefreshCw } from '@tamagui/lucide-icons'
import { PersonAutocomplete } from '../form/person-autocomplete'
import type { Nomination, DirectoryAuthProps } from './types'

interface MemberEmail {
  email: string
  emailType: string
}

interface MemberWithEmails {
  email: string
  name: string
  emails?: MemberEmail[]
}

interface RecordingBrotherManagerProps {
  ecclesiaName: string
  recordingBrotherName?: string
  recordingBrotherEmail?: string
  nominations: Nomination[]
  authProps: DirectoryAuthProps
  /** Members of this ecclesia (with email info for nomination flow) */
  members?: MemberWithEmails[]
  onNominate: (nomineeEmail: string, nomineeName: string, emailPreference: 'personal' | 'ecclesia', rbEcclesiaEmail?: string) => Promise<void>
  onSecond: (nominationId: string) => Promise<void>
  onDirectSet?: (nomineeEmail: string, nomineeName: string, emailPreference: 'personal' | 'ecclesia', rbEcclesiaEmail?: string) => Promise<void>
  /** Save RB directly via PATCH (admin editing from detail view) */
  onSaveRb?: (email: string, name: string) => Promise<boolean>
  /** Resend confirmation email for a nomination */
  onResend?: (nominationId: string) => Promise<void>
}

export function RecordingBrotherManager({
  ecclesiaName,
  recordingBrotherName,
  recordingBrotherEmail,
  nominations,
  authProps,
  members = [],
  onNominate,
  onSecond,
  onDirectSet,
  onSaveRb,
  onResend,
}: RecordingBrotherManagerProps) {
  const hasRb = !!(recordingBrotherName || recordingBrotherEmail)
  const isViewerEcclesia = authProps.viewerEcclesia === ecclesiaName
  const canEditRb = authProps.isAdminOrOwner || (authProps.isRecorderOrHigher && isViewerEcclesia)

  // Derive active nominations from data
  const confirmedNominations = nominations.filter(n => n.status === 'confirmed')
  const openNominations = nominations.filter(n => n.status === 'open')
  const hasActiveNomination = confirmedNominations.length > 0 || openNominations.length > 0

  // Edit RB state (for admin direct editing)
  const [editingRb, setEditingRb] = useState(false)
  const [editRbName, setEditRbName] = useState(recordingBrotherName || '')
  const [editRbEmail, setEditRbEmail] = useState(recordingBrotherEmail || '')
  const [savingRb, setSavingRb] = useState(false)

  // Nomination form state
  const [showNominateForm, setShowNominateForm] = useState(false)
  const [showDirectSetForm, setShowDirectSetForm] = useState(false)
  const [nomineeEmail, setNomineeEmail] = useState('')
  const [nomineeName, setNomineeName] = useState('')
  const [autocompleteValue, setAutocompleteValue] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [secondingId, setSecondingId] = useState<string | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const startEditingRb = () => {
    setEditRbName(recordingBrotherName || '')
    setEditRbEmail(recordingBrotherEmail || '')
    setEditingRb(true)
  }

  const cancelEditingRb = () => {
    setEditingRb(false)
    setEditRbName(recordingBrotherName || '')
    setEditRbEmail(recordingBrotherEmail || '')
  }

  const handleSaveRb = async () => {
    if (!onSaveRb) return
    setSavingRb(true)
    try {
      const success = await onSaveRb(editRbEmail, editRbName)
      if (success) {
        setEditingRb(false)
      }
    } finally {
      setSavingRb(false)
    }
  }

  const handleAutocompleteSelect = (person: { name: string; email: string }) => {
    setNomineeName(person.name)
    setNomineeEmail(person.email)
    setAutocompleteValue(person.name)
  }

  const resetNomineeState = () => {
    setNomineeEmail('')
    setNomineeName('')
    setAutocompleteValue('')
  }

  const handleNominate = async () => {
    if (!nomineeEmail.trim() || !nomineeName.trim()) return
    setIsSubmitting(true)
    try {
      await onNominate(nomineeEmail.trim(), nomineeName.trim(), 'personal')
      setShowNominateForm(false)
      resetNomineeState()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDirectSet = async () => {
    if (!nomineeEmail.trim() || !nomineeName.trim() || !onDirectSet) return
    setIsSubmitting(true)
    try {
      await onDirectSet(nomineeEmail.trim(), nomineeName.trim(), 'personal')
      setShowDirectSetForm(false)
      resetNomineeState()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async (nominationId: string) => {
    if (!onResend) return
    setResendingId(nominationId)
    try {
      await onResend(nominationId)
    } finally {
      setResendingId(null)
    }
  }

  const handleSecond = async (nominationId: string) => {
    setSecondingId(nominationId)
    try {
      await onSecond(nominationId)
    } finally {
      setSecondingId(null)
    }
  }

  const canSecond = (nom: Nomination) => {
    if (nom.nominatedBy === authProps.currentUserEmail) return false
    if (nom.seconds.some(s => s.email === authProps.currentUserEmail)) return false
    return true
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const daysSince = (dateStr?: string): number => {
    if (!dateStr) return Infinity
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  }

  // --- State: Has RB ---
  if (hasRb) {
    // Editing mode (admin/recorder)
    if (editingRb && onSaveRb) {
      return (
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center">
              <User size={16} color="$blue10" />
              <Text fontSize="$4" fontWeight="600">Recording Brother</Text>
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              <PersonAutocomplete
                ecclesia={ecclesiaName}
                value={editRbName}
                onChangeText={setEditRbName}
                onSelect={(person) => {
                  setEditRbName(person.name)
                  setEditRbEmail(person.email)
                }}
                label="Name"
                placeholder="Type to search members..."
                showAllEmails
              />
              <YStack gap="$1" flex={1} minWidth={200}>
                <Text fontSize="$3" fontWeight="600">Email</Text>
                <Input
                  value={editRbEmail}
                  onChangeText={setEditRbEmail}
                  placeholder="Recording brother email"
                  autoCapitalize="none"
                />
              </YStack>
            </XStack>
            <XStack gap="$2" justifyContent="flex-end">
              <Button size="$3" onPress={cancelEditingRb} disabled={savingRb}>
                Cancel
              </Button>
              <Button
                size="$3"
                theme="blue"
                onPress={handleSaveRb}
                disabled={savingRb}
              >
                {savingRb ? 'Saving...' : 'Save'}
              </Button>
            </XStack>
          </YStack>
        </Card>
      )
    }

    // Read-only card
    return (
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <YStack gap="$2">
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <XStack gap="$2" alignItems="center">
              <User size={16} color="$blue10" />
              <Text fontSize="$4" fontWeight="600">Recording Brother</Text>
            </XStack>
            {canEditRb && onSaveRb ? (
              <Button
                size="$2"
                icon={Pencil}
                chromeless
                circular
                onPress={startEditingRb}
              />
            ) : null}
          </XStack>
          <YStack gap="$1">
            {recordingBrotherName ? (
              <Text fontSize="$3">{recordingBrotherName}</Text>
            ) : null}
            {recordingBrotherEmail ? (
              <Text fontSize="$3" theme="alt2">{recordingBrotherEmail}</Text>
            ) : null}
          </YStack>
        </YStack>
      </Card>
    )
  }

  // --- State: No RB ---

  // Viewer not in this ecclesia and not admin
  if (!isViewerEcclesia && !authProps.isAdminOrOwner) {
    return (
      <Card padding="$4" borderWidth={1} borderColor="$borderColor">
        <YStack gap="$2">
          <XStack gap="$2" alignItems="center">
            <User size={16} color="$gray10" />
            <Text fontSize="$4" fontWeight="600">Recording Brother</Text>
          </XStack>
          <Text fontSize="$3" theme="alt2">No Recording Brother assigned.</Text>
        </YStack>
      </Card>
    )
  }

  // Nomination panel (viewer is member of ecclesia or admin)
  return (
    <Card bordered padding="$3" backgroundColor="$orange2" borderColor="$orange6">
      <YStack gap="$3">
        <XStack alignItems="center" gap="$2">
          <UserPlus size={18} color="$orange10" />
          <Text fontWeight="600" fontSize="$4" color="$orange11">
            No Recording Brother
          </Text>
        </XStack>

        <Text fontSize="$3" color="$textSecondary">
          {ecclesiaName} does not have a Recording Brother. Nominate a member — two other members must second the nomination to confirm.
        </Text>

        {/* Confirmed nominations — verification sent, awaiting acceptance */}
        {confirmedNominations.map((nom) => (
          <Card key={nom.nominationId} bordered padding="$3" backgroundColor="$blue2" borderColor="$blue6">
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center">
                <Clock size={16} color="$blue10" />
                <Text fontSize="$3" color="$blue11" fontWeight="600">
                  Recording Brother Verification Sent
                </Text>
              </XStack>
              <Text fontSize="$3">{nom.nomineeName}</Text>
              <Text fontSize="$2" color="$textSecondary">
                Sent {nom.confirmationSentAt ? formatDate(nom.confirmationSentAt) : formatDate(nom.createdAt)}
                {nom.directSet ? ' (admin direct set)' : ` — nominated by ${nom.nominatedByName}`}
              </Text>
              <Text fontSize="$2" color="$textSecondary">
                Awaiting confirmation from nominee.
              </Text>
              {authProps.isAdminOrOwner && onResend && daysSince(nom.confirmationSentAt) >= 7 ? (
                <XStack justifyContent="flex-end">
                  <Button
                    size="$3"
                    theme="blue"
                    icon={resendingId === nom.nominationId ? <Spinner size="small" width={16} height={16} /> : RefreshCw}
                    onPress={() => handleResend(nom.nominationId)}
                    disabled={resendingId !== null}
                  >
                    {resendingId === nom.nominationId ? 'Resending...' : 'Resend Verification'}
                  </Button>
                </XStack>
              ) : null}
            </YStack>
          </Card>
        ))}

        {/* Open nominations — needs seconders */}
        {openNominations.length > 0 ? (
          <YStack gap="$2">
            <Text fontWeight="600" fontSize="$3">Nominations Awaiting Seconds</Text>
            {openNominations.map((nom) => (
              <Card key={nom.nominationId} bordered padding="$3" backgroundColor="$background">
                <YStack gap="$2">
                  <XStack justifyContent="space-between" alignItems="center">
                    <YStack>
                      <Text fontWeight="600">{nom.nomineeName}</Text>
                      <Text fontSize="$2" color="$textSecondary">
                        Nominated by {nom.nominatedByName} on {formatDate(nom.createdAt)}
                      </Text>
                    </YStack>
                    <XStack
                      backgroundColor="$orange4"
                      borderRadius="$4"
                      paddingHorizontal="$2"
                      paddingVertical="$1"
                    >
                      <Text fontSize="$2" fontWeight="600" color="$orange11">
                        Needs {nom.secondsNeeded - nom.seconds.length} more second{nom.secondsNeeded - nom.seconds.length !== 1 ? 's' : ''}
                      </Text>
                    </XStack>
                  </XStack>

                  {nom.seconds.length > 0 ? (
                    <Text fontSize="$2" color="$textSecondary">
                      Seconded by: {nom.seconds.map(s => s.name).join(', ')}
                    </Text>
                  ) : null}

                  {canSecond(nom) ? (
                    <XStack justifyContent="flex-end">
                      <Button
                        size="$3"
                        theme="blue"
                        icon={secondingId === nom.nominationId ? <Spinner size="small" width={16} height={16} /> : ThumbsUp}
                        onPress={() => handleSecond(nom.nominationId)}
                        disabled={secondingId !== null}
                      >
                        Second this nomination
                      </Button>
                    </XStack>
                  ) : null}
                </YStack>
              </Card>
            ))}
          </YStack>
        ) : null}

        {/* Admin/Owner direct set — hidden when active nomination exists */}
        {authProps.isAdminOrOwner && onDirectSet && !hasActiveNomination ? (
          showDirectSetForm ? (
            <Card bordered padding="$3" backgroundColor="$blue2" borderColor="$blue6">
              <YStack gap="$3">
                <XStack alignItems="center" gap="$2">
                  <Shield size={16} color="$blue10" />
                  <Text fontWeight="600" fontSize="$3" color="$blue11">Set Recording Brother Directly</Text>
                </XStack>
                <Text fontSize="$2" color="$textSecondary">
                  Admin override — bypasses nomination and seconder process.
                </Text>

                <PersonAutocomplete
                  ecclesia={ecclesiaName}
                  value={autocompleteValue}
                  onChangeText={(text) => {
                    setAutocompleteValue(text)
                    if (!text) resetNomineeState()
                  }}
                  onSelect={handleAutocompleteSelect}
                  label="Search member by name"
                  placeholder="Type a name to search..."
                  showAllEmails
                />

                {nomineeEmail ? (
                  <Card padding="$2" backgroundColor="$green2" borderWidth={1} borderColor="$green8">
                    <Text fontSize="$2" color="$green11">
                      Selected: {nomineeName} ({nomineeEmail})
                    </Text>
                  </Card>
                ) : null}

                <XStack gap="$2" justifyContent="flex-end">
                  <Button
                    size="$3"
                    variant="outlined"
                    onPress={() => {
                      setShowDirectSetForm(false)
                      resetNomineeState()
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="$3"
                    theme="blue"
                    onPress={handleDirectSet}
                    disabled={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting}
                    opacity={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting ? 0.5 : 1}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Confirmation Email'}
                  </Button>
                </XStack>
              </YStack>
            </Card>
          ) : (
            <Button
              size="$3"
              theme="blue"
              icon={Shield}
              alignSelf="flex-start"
              onPress={() => {
                setShowDirectSetForm(true)
                setShowNominateForm(false)
              }}
            >
              Set Recording Brother Directly
            </Button>
          )
        ) : null}

        {/* Nominate button / form — hidden when active nomination exists */}
        {hasActiveNomination ? null : showNominateForm ? (
          <Card bordered padding="$3" backgroundColor="$background">
            <YStack gap="$3">
              <Text fontWeight="600" fontSize="$3">Nominate a Recording Brother</Text>

              <PersonAutocomplete
                ecclesia={ecclesiaName}
                value={autocompleteValue}
                onChangeText={(text) => {
                  setAutocompleteValue(text)
                  if (!text) resetNomineeState()
                }}
                onSelect={handleAutocompleteSelect}
                label="Search member by name"
                placeholder="Type a name to search..."
                showAllEmails
              />

              {nomineeEmail ? (
                <Card padding="$2" backgroundColor="$green2" borderWidth={1} borderColor="$green8">
                  <Text fontSize="$2" color="$green11">
                    Selected: {nomineeName} ({nomineeEmail})
                  </Text>
                </Card>
              ) : null}

              <XStack gap="$2" justifyContent="flex-end">
                <Button
                  size="$3"
                  variant="outlined"
                  onPress={() => {
                    setShowNominateForm(false)
                    resetNomineeState()
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  size="$3"
                  theme="blue"
                  onPress={handleNominate}
                  disabled={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting}
                  opacity={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting ? 0.5 : 1}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Nomination'}
                </Button>
              </XStack>
            </YStack>
          </Card>
        ) : (
          <Button
            size="$3"
            theme="orange"
            icon={UserPlus}
            alignSelf="flex-start"
            onPress={() => {
              setShowNominateForm(true)
              setShowDirectSetForm(false)
            }}
          >
            Nominate Recording Brother
          </Button>
        )}
      </YStack>
    </Card>
  )
}
