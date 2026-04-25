import { useState } from 'react'
import { YStack, XStack, Text, Input, Card, Spinner } from 'tamagui'
import { Button } from '../Button'
import { UserPlus, ThumbsUp, ChevronLeft, Shield } from '@tamagui/lucide-icons'

interface NominationSecond {
  email: string
  name: string
  at: string
}

interface Nomination {
  nominationId: string
  ecclesia: string
  nomineeEmail: string
  nomineeName: string
  nominatedBy: string
  nominatedByName: string
  seconds: NominationSecond[]
  secondsNeeded: number
  status: string
  createdAt: string
}

interface MemberEmail {
  email: string
  emailType: string
}

interface RBNominationPanelProps {
  ecclesia: string
  nominations: Nomination[]
  hasRecordingBrother: boolean
  onNominate: (nomineeEmail: string, nomineeName: string) => Promise<void>
  onSecond: (nominationId: string) => Promise<void>
  onDirectSet?: (nomineeEmail: string, nomineeName: string) => Promise<void>
  currentUserEmail: string
  isAdminOrOwner?: boolean
  members?: Array<{ email: string; name: string; emails?: MemberEmail[] }>
}

export function RBNominationPanel({
  ecclesia,
  nominations,
  hasRecordingBrother,
  onNominate,
  onSecond,
  onDirectSet,
  currentUserEmail,
  isAdminOrOwner = false,
  members = [],
}: RBNominationPanelProps) {
  const [showNominateForm, setShowNominateForm] = useState(false)
  const [showDirectSetForm, setShowDirectSetForm] = useState(false)
  const [nomineeEmail, setNomineeEmail] = useState('')
  const [nomineeName, setNomineeName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [secondingId, setSecondingId] = useState<string | null>(null)

  // Two-step nomination: first select person, then select email
  const [selectedMember, setSelectedMember] = useState<{ email: string; name: string; emails?: MemberEmail[] } | null>(null)

  // Don't show panel if ecclesia has a Recording Brother
  if (hasRecordingBrother) return null

  const handleSelectMember = (member: { email: string; name: string; emails?: MemberEmail[] }) => {
    const memberEmails = member.emails || []
    if (memberEmails.length <= 1) {
      // Only one email (or none) — skip step 2, use primary
      setNomineeEmail(member.email)
      setNomineeName(member.name)
      setSelectedMember(null)
    } else {
      // Multiple emails — show step 2
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
    setIsSubmitting(true)
    try {
      await onNominate(nomineeEmail.trim(), nomineeName.trim())
      setShowNominateForm(false)
      setNomineeEmail('')
      setNomineeName('')
      setSelectedMember(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDirectSet = async () => {
    if (!nomineeEmail.trim() || !nomineeName.trim() || !onDirectSet) return
    setIsSubmitting(true)
    try {
      await onDirectSet(nomineeEmail.trim(), nomineeName.trim())
      setShowDirectSetForm(false)
      setNomineeEmail('')
      setNomineeName('')
      setSelectedMember(null)
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
    // Cannot second own nomination
    if (nom.nominatedBy === currentUserEmail) return false
    // Cannot second twice
    if (nom.seconds.some(s => s.email === currentUserEmail)) return false
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
          {ecclesia} does not have a Recording Brother. Nominate a member — two other members must second the nomination to confirm.
        </Text>

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
        {isAdminOrOwner && onDirectSet ? (
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
                      Select a member of {ecclesia}:
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

                <XStack gap="$2" justifyContent="flex-end">
                  <Button
                    size="$3"
                    variant="outlined"
                    onPress={() => {
                      setShowDirectSetForm(false)
                      setNomineeEmail('')
                      setNomineeName('')
                      setSelectedMember(null)
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
                    {isSubmitting ? 'Setting...' : 'Set as Recording Brother'}
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
                /* Step 1: Select a member */
                <YStack gap="$2">
                  <Text fontSize="$3" color="$textSecondary">
                    Select a member of {ecclesia}:
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
                /* Step 2: Select which email to use */
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
                /* Fallback: manual input if no members list */
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

              <XStack gap="$2" justifyContent="flex-end">
                <Button
                  size="$3"
                  variant="outlined"
                  onPress={() => {
                    setShowNominateForm(false)
                    setNomineeEmail('')
                    setNomineeName('')
                    setSelectedMember(null)
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
