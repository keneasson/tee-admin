import { useState } from 'react'
import { YStack, XStack, Text, Input, Card, Spinner, RadioGroup, Label } from 'tamagui'
import { Button } from '../Button'
import { UserPlus, ThumbsUp, ChevronLeft, Shield, User, Pencil, Mail, Clock } from '@tamagui/lucide-icons'
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
  /** Whether a confirmation email has been sent and we're awaiting response */
  awaitingConfirmation?: boolean
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
  awaitingConfirmation = false,
}: RecordingBrotherManagerProps) {
  const hasRb = !!(recordingBrotherName || recordingBrotherEmail)
  const isViewerEcclesia = authProps.viewerEcclesia === ecclesiaName
  const canEditRb = authProps.isAdminOrOwner || (authProps.isRecorderOrHigher && isViewerEcclesia)

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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [secondingId, setSecondingId] = useState<string | null>(null)
  const [selectedMember, setSelectedMember] = useState<MemberWithEmails | null>(null)
  const [emailPreference, setEmailPreference] = useState<'personal' | 'ecclesia'>('personal')
  const [rbEcclesiaEmail, setRbEcclesiaEmail] = useState('')
  const [confirmationSent, setConfirmationSent] = useState(awaitingConfirmation)

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

  const handleSelectMember = (member: MemberWithEmails) => {
    const memberEmails = member.emails || []
    if (memberEmails.length <= 1) {
      setNomineeEmail(member.email)
      setNomineeName(member.name)
      setSelectedMember(null)
    } else {
      setSelectedMember(member)
      setNomineeName(member.name)
      setNomineeEmail('')
    }
  }

  const handleSelectEmail = (email: string) => {
    setNomineeEmail(email)
  }

  const handleBackToMembers = () => {
    setSelectedMember(null)
    setNomineeEmail('')
    setNomineeName('')
  }

  const handleNominate = async () => {
    if (!nomineeEmail.trim() || !nomineeName.trim()) return
    if (emailPreference === 'ecclesia' && !rbEcclesiaEmail.trim()) return
    setIsSubmitting(true)
    try {
      await onNominate(
        nomineeEmail.trim(),
        nomineeName.trim(),
        emailPreference,
        emailPreference === 'ecclesia' ? rbEcclesiaEmail.trim() : undefined
      )
      setShowNominateForm(false)
      setNomineeEmail('')
      setNomineeName('')
      setSelectedMember(null)
      setEmailPreference('personal')
      setRbEcclesiaEmail('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDirectSet = async () => {
    if (!nomineeEmail.trim() || !nomineeName.trim() || !onDirectSet) return
    if (emailPreference === 'ecclesia' && !rbEcclesiaEmail.trim()) return
    setIsSubmitting(true)
    try {
      await onDirectSet(
        nomineeEmail.trim(),
        nomineeName.trim(),
        emailPreference,
        emailPreference === 'ecclesia' ? rbEcclesiaEmail.trim() : undefined
      )
      setShowDirectSetForm(false)
      setNomineeEmail('')
      setNomineeName('')
      setSelectedMember(null)
      setEmailPreference('personal')
      setRbEcclesiaEmail('')
      setConfirmationSent(true)
    } finally {
      setIsSubmitting(false)
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
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
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

        {/* Confirmation pending banner */}
        {confirmationSent ? (
          <Card bordered padding="$3" backgroundColor="$blue2" borderColor="$blue6">
            <XStack gap="$2" alignItems="center">
              <Clock size={16} color="$blue10" />
              <Text fontSize="$3" color="$blue11" fontWeight="600">
                Awaiting confirmation from nominee
              </Text>
            </XStack>
            <Text fontSize="$2" color="$textSecondary" paddingTop="$1">
              A confirmation email has been sent. The nominee must click the link to accept the Recording Brother designation.
            </Text>
          </Card>
        ) : null}

        {/* Open nominations */}
        {nominations.length > 0 ? (
          <YStack gap="$2">
            <Text fontWeight="600" fontSize="$3">Open Nominations</Text>
            {nominations.map((nom) => (
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
                        {nom.seconds.length} / {nom.secondsNeeded} seconds
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

        {/* Admin/Owner direct set */}
        {authProps.isAdminOrOwner && onDirectSet ? (
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

                {members.length > 0 && !selectedMember ? (
                  <YStack gap="$2">
                    <Text fontSize="$3" color="$textSecondary">
                      Select a member of {ecclesiaName}:
                    </Text>
                    {members.map((m) => (
                      <Button
                        key={m.email}
                        size="$3"
                        variant="outlined"
                        onPress={() => handleSelectMember(m)}
                        theme={nomineeEmail === m.email ? 'blue' : undefined}
                        borderWidth={nomineeEmail === m.email ? 2 : 1}
                      >
                        {m.name}
                      </Button>
                    ))}
                  </YStack>
                ) : selectedMember ? (
                  <YStack gap="$2">
                    <XStack gap="$2" alignItems="center">
                      <Button
                        size="$2"
                        icon={ChevronLeft}
                        chromeless
                        onPress={handleBackToMembers}
                      />
                      <Text fontSize="$3" fontWeight="600">
                        {selectedMember.name}
                      </Text>
                    </XStack>
                    <Text fontSize="$3" color="$textSecondary">
                      Select the RB email:
                    </Text>
                    {(selectedMember.emails || []).map((emailRecord) => (
                      <Button
                        key={emailRecord.email}
                        size="$3"
                        variant="outlined"
                        onPress={() => handleSelectEmail(emailRecord.email)}
                        theme={nomineeEmail === emailRecord.email ? 'blue' : undefined}
                        borderWidth={nomineeEmail === emailRecord.email ? 2 : 1}
                      >
                        <YStack alignItems="flex-start">
                          <Text fontSize="$3">{emailRecord.email}</Text>
                          <Text fontSize="$2" color="$textSecondary">
                            {emailRecord.emailType}
                          </Text>
                        </YStack>
                      </Button>
                    ))}
                  </YStack>
                ) : (
                  <YStack gap="$2">
                    <Input
                      placeholder="Member's name"
                      value={nomineeName}
                      onChangeText={setNomineeName}
                      borderWidth={1}
                      borderColor="$gray6"
                    />
                    <Input
                      placeholder="Member's email"
                      value={nomineeEmail}
                      onChangeText={setNomineeEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      borderWidth={1}
                      borderColor="$gray6"
                    />
                  </YStack>
                )}

                {/* Email preference selection */}
                {nomineeEmail.trim() ? (
                  <YStack gap="$2" paddingTop="$2">
                    <Text fontSize="$3" fontWeight="600">Email Preference</Text>
                    <Text fontSize="$2" color="$textSecondary">
                      Which email should be used for inter-ecclesia communications?
                    </Text>
                    <RadioGroup
                      value={emailPreference}
                      onValueChange={(val) => setEmailPreference(val as 'personal' | 'ecclesia')}
                    >
                      <XStack gap="$3" flexWrap="wrap">
                        <XStack gap="$2" alignItems="center">
                          <RadioGroup.Item value="personal" id="pref-personal-ds">
                            <RadioGroup.Indicator />
                          </RadioGroup.Item>
                          <Label htmlFor="pref-personal-ds" fontSize="$3">
                            Nominee's personal email
                          </Label>
                        </XStack>
                        <XStack gap="$2" alignItems="center">
                          <RadioGroup.Item value="ecclesia" id="pref-ecclesia-ds">
                            <RadioGroup.Indicator />
                          </RadioGroup.Item>
                          <Label htmlFor="pref-ecclesia-ds" fontSize="$3">
                            Ecclesia RB email
                          </Label>
                        </XStack>
                      </XStack>
                    </RadioGroup>
                    {emailPreference === 'ecclesia' ? (
                      <Input
                        placeholder="Ecclesia RB email address"
                        value={rbEcclesiaEmail}
                        onChangeText={setRbEcclesiaEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        borderWidth={1}
                        borderColor="$gray6"
                      />
                    ) : null}
                  </YStack>
                ) : null}

                <XStack gap="$2" justifyContent="flex-end">
                  <Button
                    size="$3"
                    variant="outlined"
                    onPress={() => {
                      setShowDirectSetForm(false)
                      setNomineeEmail('')
                      setNomineeName('')
                      setSelectedMember(null)
                      setEmailPreference('personal')
                      setRbEcclesiaEmail('')
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="$3"
                    theme="blue"
                    onPress={handleDirectSet}
                    disabled={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting || (emailPreference === 'ecclesia' && !rbEcclesiaEmail.trim())}
                    opacity={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting || (emailPreference === 'ecclesia' && !rbEcclesiaEmail.trim()) ? 0.5 : 1}
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

        {/* Nominate button / form */}
        {showNominateForm ? (
          <Card bordered padding="$3" backgroundColor="$background">
            <YStack gap="$3">
              <Text fontWeight="600" fontSize="$3">Nominate a Recording Brother</Text>

              {members.length > 0 && !selectedMember ? (
                <YStack gap="$2">
                  <Text fontSize="$3" color="$textSecondary">
                    Select a member of {ecclesiaName}:
                  </Text>
                  {members.map((m) => (
                    <Button
                      key={m.email}
                      size="$3"
                      variant="outlined"
                      onPress={() => handleSelectMember(m)}
                      theme={nomineeEmail === m.email ? 'blue' : undefined}
                      borderWidth={nomineeEmail === m.email ? 2 : 1}
                    >
                      {m.name}
                    </Button>
                  ))}
                </YStack>
              ) : selectedMember ? (
                <YStack gap="$2">
                  <XStack gap="$2" alignItems="center">
                    <Button
                      size="$2"
                      icon={ChevronLeft}
                      chromeless
                      onPress={handleBackToMembers}
                    />
                    <Text fontSize="$3" fontWeight="600">
                      {selectedMember.name}
                    </Text>
                  </XStack>
                  <Text fontSize="$3" color="$textSecondary">
                    Select the RB email for this nomination:
                  </Text>
                  {(selectedMember.emails || []).map((emailRecord) => (
                    <Button
                      key={emailRecord.email}
                      size="$3"
                      variant="outlined"
                      onPress={() => handleSelectEmail(emailRecord.email)}
                      theme={nomineeEmail === emailRecord.email ? 'blue' : undefined}
                      borderWidth={nomineeEmail === emailRecord.email ? 2 : 1}
                    >
                      <YStack alignItems="flex-start">
                        <Text fontSize="$3">{emailRecord.email}</Text>
                        <Text fontSize="$2" color="$textSecondary">
                          {emailRecord.emailType}
                        </Text>
                      </YStack>
                    </Button>
                  ))}
                </YStack>
              ) : (
                <YStack gap="$2">
                  <Input
                    placeholder="Nominee's name"
                    value={nomineeName}
                    onChangeText={setNomineeName}
                    borderWidth={1}
                    borderColor="$gray6"
                  />
                  <Input
                    placeholder="Nominee's email"
                    value={nomineeEmail}
                    onChangeText={setNomineeEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    borderWidth={1}
                    borderColor="$gray6"
                  />
                </YStack>
              )}

              {/* Email preference selection */}
              {nomineeEmail.trim() ? (
                <YStack gap="$2" paddingTop="$2">
                  <Text fontSize="$3" fontWeight="600">Email Preference</Text>
                  <Text fontSize="$2" color="$textSecondary">
                    Which email should be used for inter-ecclesia communications?
                  </Text>
                  <RadioGroup
                    value={emailPreference}
                    onValueChange={(val) => setEmailPreference(val as 'personal' | 'ecclesia')}
                  >
                    <XStack gap="$3" flexWrap="wrap">
                      <XStack gap="$2" alignItems="center">
                        <RadioGroup.Item value="personal" id="pref-personal-nom">
                          <RadioGroup.Indicator />
                        </RadioGroup.Item>
                        <Label htmlFor="pref-personal-nom" fontSize="$3">
                          Nominee's personal email
                        </Label>
                      </XStack>
                      <XStack gap="$2" alignItems="center">
                        <RadioGroup.Item value="ecclesia" id="pref-ecclesia-nom">
                          <RadioGroup.Indicator />
                        </RadioGroup.Item>
                        <Label htmlFor="pref-ecclesia-nom" fontSize="$3">
                          Ecclesia RB email
                        </Label>
                      </XStack>
                    </XStack>
                  </RadioGroup>
                  {emailPreference === 'ecclesia' ? (
                    <Input
                      placeholder="Ecclesia RB email address"
                      value={rbEcclesiaEmail}
                      onChangeText={setRbEcclesiaEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      borderWidth={1}
                      borderColor="$gray6"
                    />
                  ) : null}
                </YStack>
              ) : null}

              <XStack gap="$2" justifyContent="flex-end">
                <Button
                  size="$3"
                  variant="outlined"
                  onPress={() => {
                    setShowNominateForm(false)
                    setNomineeEmail('')
                    setNomineeName('')
                    setSelectedMember(null)
                    setEmailPreference('personal')
                    setRbEcclesiaEmail('')
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  size="$3"
                  theme="blue"
                  onPress={handleNominate}
                  disabled={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting || (emailPreference === 'ecclesia' && !rbEcclesiaEmail.trim())}
                  opacity={!nomineeEmail.trim() || !nomineeName.trim() || isSubmitting || (emailPreference === 'ecclesia' && !rbEcclesiaEmail.trim()) ? 0.5 : 1}
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
