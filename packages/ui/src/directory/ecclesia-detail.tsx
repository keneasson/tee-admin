import { YStack, XStack, Text, Card, Heading, View, ScrollView, Spinner } from 'tamagui'
import { Button } from '../Button'
import { Church, ArrowLeft, UserPlus } from '@tamagui/lucide-icons'
import { EcclesiaDangerZone, type ClosureChange } from './ecclesia-danger-zone'
import { EcclesiaDetailView } from '../ecclesia/ecclesia-detail-view'
import type { EcclesiaDetailData } from '../ecclesia/ecclesia-detail-view'
import { RecordingBrotherManager } from './recording-brother-manager'
import { PersonCard } from './person-card'
import type { DirectoryMember, Nomination, DirectoryAuthProps } from './types'

interface MemberEmail {
  email: string
  emailType: string
}

interface MemberWithEmails {
  email: string
  name: string
  emails?: MemberEmail[]
}

interface EcclesiaDetailProps {
  ecclesia: EcclesiaDetailData
  canEdit: boolean
  onUpdate?: (updates: Partial<EcclesiaDetailData>) => Promise<boolean>
  initialEdit?: boolean
  onBack: () => void
  /** Members of this ecclesia */
  members: DirectoryMember[]
  membersLoading?: boolean
  onMemberClick: (id: string) => void
  /** Opens the add-member form for this ecclesia (with a typed name, if any); omitted, no button */
  onAddMember?: (name?: string) => void
  /** RB nomination data */
  nominations: Nomination[]
  authProps: DirectoryAuthProps
  /** Members with email info for nomination flow */
  ecclesiaMembers?: MemberWithEmails[]
  onNominate: (nomineeEmail: string, nomineeName: string) => Promise<void>
  onSecond: (nominationId: string) => Promise<void>
  onDirectSet?: (nomineeEmail: string, nomineeName: string) => Promise<void>
  /** Resend confirmation email for a nomination */
  onResend?: (nominationId: string) => Promise<void>
  /** Close / reopen the ecclesia (admin/owner only). Ecclesias are never deleted. */
  onSetClosed?: (change: ClosureChange) => Promise<boolean>
  /** Merge this duplicate record into another ecclesia (admin/owner only) */
  onMerge?: () => void
  /** Show external links card (gated behind multi-tenant feature flag) */
  showExternalLinks?: boolean
  /** Enriched nearby ecclesias from API */
  nearbyEcclesiasData?: Array<{ name: string; displayName?: string; distanceKm?: number; country?: string; province?: string }>
  nearbyLoading?: boolean
  onEcclesiaClick?: (name: string) => void
}

export function EcclesiaDetail({
  ecclesia,
  canEdit,
  onUpdate,
  initialEdit = false,
  onBack,
  members,
  membersLoading = false,
  onMemberClick,
  onAddMember,
  nominations,
  authProps,
  ecclesiaMembers = [],
  onNominate,
  onSecond,
  onDirectSet,
  onResend,
  onSetClosed,
  onMerge,
  showExternalLinks = false,
  nearbyEcclesiasData,
  nearbyLoading,
  onEcclesiaClick,
}: EcclesiaDetailProps) {
  // Nominates the RB office's holder by address ('' vacates the office); the name comes from the person.
  const handleSaveRb = async (email: string): Promise<boolean> => {
    if (!onUpdate) return false
    return onUpdate({ rbNomineeEmail: email })
  }

  return (
    <ScrollView flex={1}>
      <YStack flex={1} padding="$4" gap="$4">
        <Button
          alignSelf="flex-start"
          icon={ArrowLeft}
          onPress={onBack}
        >
          Back to Directory
        </Button>

        {/* Reuse existing EcclesiaDetailView for general info + services */}
        <EcclesiaDetailView
          ecclesia={ecclesia}
          canEdit={canEdit}
          onUpdate={onUpdate}
          initialEdit={initialEdit}
          showExternalLinks={showExternalLinks}
          nearbyEcclesiasData={nearbyEcclesiasData}
          nearbyLoading={nearbyLoading}
          onEcclesiaClick={onEcclesiaClick}
        />

        {/* Recording Brother Manager (replaces the simple RB card in EcclesiaDetailView) */}
        <RecordingBrotherManager
          ecclesiaName={ecclesia.name}
          onAddMember={onAddMember}
          recordingBrother={ecclesia.recordingBrother}
          offices={ecclesia.offices}
          nominations={nominations}
          authProps={authProps}
          members={ecclesiaMembers}
          onNominate={onNominate}
          onSecond={onSecond}
          onDirectSet={onDirectSet}
          onResend={onResend}
          onSaveRb={canEdit ? handleSaveRb : undefined}
        />

        {/* Inline Member List */}
        <Card padding="$4" borderWidth={1} borderColor="$borderColor">
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center">
              <Church size={16} color="$blue10" />
              <Text fontSize="$5" fontWeight="600">Members</Text>
              <Text fontSize="$3" theme="alt2">({members.length})</Text>
              {onAddMember ? (
                <Button size="$2" icon={UserPlus} marginLeft="auto" onPress={() => onAddMember()}>
                  Add member
                </Button>
              ) : null}
            </XStack>

            {membersLoading ? (
              <XStack justifyContent="center" padding="$4" gap="$2">
                <Spinner size="small" width={20} height={20} />
                <Text fontSize="$3" theme="alt2">Loading members...</Text>
              </XStack>
            ) : members.length === 0 ? (
              <Text fontSize="$3" theme="alt2">No members in directory for this ecclesia.</Text>
            ) : (
              <XStack flexWrap="wrap" gap="$2">
                {members.map((member) => (
                  <View key={member.id} width={260} minWidth={200} flexGrow={1} maxWidth={380}>
                    <PersonCard
                      name={member.name}
                      hideEcclesia
                      onPress={() => onMemberClick(member.id)}
                    />
                  </View>
                ))}
              </XStack>
            )}
          </YStack>
        </Card>

        {/* Danger Zone - Admin/Owner only: close / reopen, or merge a duplicate. Never delete. */}
        {authProps.isAdminOrOwner && (onSetClosed || onMerge) ? (
          <EcclesiaDangerZone ecclesia={ecclesia} onSetClosed={onSetClosed} onMerge={onMerge} />
        ) : null}
      </YStack>
    </ScrollView>
  )
}
