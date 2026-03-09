import { YStack, XStack, Text, Card, Heading, View, ScrollView, Spinner, Separator } from 'tamagui'
import { Button } from '../Button'
import { Church, ArrowLeft, Trash } from '@tamagui/lucide-icons'
import { brandColors } from '../branding/brand-colors'
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
  /** Delete ecclesia callback (admin/owner only) */
  onDelete?: () => void
  isDeleting?: boolean
  /** Show external links card (gated behind multi-tenant feature flag) */
  showExternalLinks?: boolean
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
  nominations,
  authProps,
  ecclesiaMembers = [],
  onNominate,
  onSecond,
  onDirectSet,
  onResend,
  onDelete,
  isDeleting = false,
  showExternalLinks = false,
}: EcclesiaDetailProps) {
  const handleSaveRb = async (email: string, name: string): Promise<boolean> => {
    if (!onUpdate) return false
    return onUpdate({
      recordingBrotherEmail: email,
      recordingBrotherName: name,
    })
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
        />

        {/* Recording Brother Manager (replaces the simple RB card in EcclesiaDetailView) */}
        <RecordingBrotherManager
          ecclesiaName={ecclesia.name}
          recordingBrotherName={ecclesia.recordingBrotherName}
          recordingBrotherEmail={ecclesia.recordingBrotherEmail}
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

        {/* Delete Ecclesia - Admin/Owner only */}
        {authProps.isAdminOrOwner && onDelete ? (
          <Card padding="$4" borderWidth={1} borderColor="$red6" backgroundColor="$red2">
            <YStack gap="$3">
              <Text fontSize="$4" fontWeight="600" color="$red10">Danger Zone</Text>
              <Separator borderColor="$red6" />
              <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
                <YStack flex={1} gap="$1">
                  <Text fontSize="$3" fontWeight="600">Delete this ecclesia</Text>
                  <Text fontSize="$3" color="$textSecondary">
                    {members.length > 0
                      ? `This ecclesia has ${members.length} member${members.length !== 1 ? 's' : ''}. You will need to transfer them first.`
                      : 'This action cannot be undone.'}
                  </Text>
                </YStack>
                <Button
                  icon={isDeleting ? <Spinner size="small" width={16} height={16} /> : Trash}
                  backgroundColor={brandColors.light.error}
                  color="white"
                  borderWidth={2}
                  borderColor={brandColors.light.error}
                  hoverStyle={{
                    backgroundColor: brandColors.light.error,
                    opacity: 0.9,
                  }}
                  onPress={onDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Ecclesia'}
                </Button>
              </XStack>
            </YStack>
          </Card>
        ) : null}
      </YStack>
    </ScrollView>
  )
}
